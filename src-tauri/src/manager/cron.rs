use std::sync::{Arc, LazyLock, Mutex};

use tokio_cron_scheduler::{Job, JobScheduler};
use uuid::Uuid;

use crate::manager::{
    process::{get_status, ServerStatus},
    servers::{self, save_servers, Server},
};

static BACKUP_JOB_SCHEDULER: LazyLock<Mutex<Option<Arc<JobScheduler>>>> =
    LazyLock::new(|| Mutex::new(None));

static JOB_IDS: LazyLock<Mutex<std::collections::HashMap<String, Uuid>>> =
    LazyLock::new(|| Mutex::new(std::collections::HashMap::new()));

async fn get_or_create_scheduler() -> Result<Arc<JobScheduler>, Box<dyn std::error::Error>> {
    {
        let sched_guard = BACKUP_JOB_SCHEDULER.lock()?;
        if let Some(sched) = sched_guard.as_ref() {
            return Ok(sched.clone());
        }
    }

    let new_scheduler = JobScheduler::new().await?;
    let scheduler = Arc::new(new_scheduler);
    scheduler.start().await?;

    BACKUP_JOB_SCHEDULER.lock()?.replace(scheduler.clone());

    Ok(scheduler)
}

// convert crons to crons containing seconds
fn normalize_cron(interval: &str) -> String {
    let parts: Vec<&str> = interval.trim().split_whitespace().collect();
    match parts.len() {
        5 => format!("0 {}", interval.trim()), // prepend seconds
        _ => interval.to_string(),
    }
}

impl Server {
    pub async fn add_backup_job(&self, interval: &str) -> Result<(), Box<dyn std::error::Error>> {
        let normalized = normalize_cron(interval);

        let scheduler: Arc<JobScheduler> = get_or_create_scheduler().await?;

        let server_id_clone = self.server_id.clone();
        let job = match Job::new(&normalized, move |_uuid, _l| {
            {
                let servers = servers::get_servers_mut();
                if let Ok(mut servers) = servers {
                    if let Some(server) =
                        servers.iter_mut().find(|s| s.server_id == server_id_clone)
                    {
                        let status = get_status(&server_id_clone);
                        if let Ok(status) = status {
                            if status == ServerStatus::Online {
                                server.create_backup().expect("Failed to create backup");
                            }
                        }
                    }
                }
            }

            let _ = save_servers(); // when server backs up, must save result
        }) {
            Ok(j) => j,
            Err(e) => {
                return Err(
                    format!("Failed to parse cron schedule '{}': {}", normalized, e).into(),
                );
            }
        };

        let job_uuid = scheduler.add(job).await?;

        let server_id = self.server_id.clone();
        println!("Added backup job of interval {normalized} for server id {server_id}");

        {
            JOB_IDS.lock()?.insert(server_id, job_uuid);
        }

        self.remove_backup_job(Some(&job_uuid)).await?;

        Ok(())
    }

    pub async fn remove_backup_job(
        &self,
        exception: Option<&Uuid>,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let uuids = {
            JOB_IDS
                .lock()?
                .iter()
                .filter(|(key, uuid)| {
                    *key == &self.server_id && exception.is_none_or(|x_uuid| x_uuid != *uuid)
                })
                .map(|(_, uuid)| uuid.clone())
                .collect::<Vec<Uuid>>()
        };

        for job_uuid in uuids {
            let server_id = self.server_id.clone();
            println!("Removing backup job for server id {server_id}");
            JOB_IDS.lock()?.remove(&server_id);
            let scheduler = get_or_create_scheduler().await?;
            scheduler.remove(&job_uuid).await?;
        }

        Ok(())
    }
}

pub async fn init_backup_jobs() -> Result<(), Box<dyn std::error::Error>> {
    let servers = servers::get_cloned_servers()?;
    for server in &servers {
        if server.backup_settings.auto_backups {
            server
                .add_backup_job(&server.backup_settings.auto_backup_interval)
                .await?;
        }
    }

    Ok(())
}
