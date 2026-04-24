use std::sync::{Arc, LazyLock, Mutex};

use tokio_cron_scheduler::{Job, JobScheduler};
use uuid::Uuid;

use crate::manager::{process::{ServerStatus, get_status}, servers::{self, Server}};

static BACKUP_JOB_SCHEDULER: LazyLock<Mutex<Option<Arc<JobScheduler>>>> = LazyLock::new(|| {
    Mutex::new(None)
});

static JOB_IDS: LazyLock<Mutex<std::collections::HashMap<String, Uuid>>> = LazyLock::new(|| {
    Mutex::new(std::collections::HashMap::new())
});

async fn get_or_create_scheduler() -> Result<Arc<JobScheduler>, Box<dyn std::error::Error>> {
    {
        let sched_guard = BACKUP_JOB_SCHEDULER.lock().unwrap();
        if let Some(sched) = sched_guard.as_ref() {
            return Ok(sched.clone());
        }
    }
    let new_scheduler = JobScheduler::new().await?;
    let scheduler = Arc::new(new_scheduler);
    if let Err(e) = scheduler.start().await {
        eprintln!("Failed to start scheduler: {}", e);
    }
    BACKUP_JOB_SCHEDULER.lock().unwrap().replace(scheduler.clone());
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
    pub async fn add_backup_job(&self, interval: &str) {
        let normalized = normalize_cron(interval);
        
        self.remove_backup_job().await;

        let scheduler: Arc<JobScheduler> = get_or_create_scheduler().await.unwrap();

        let server_id_clone = self.server_id.clone();
        let job = match Job::new(&normalized, move |_uuid, _l| {
                let servers = servers::get_cloned_servers();
                if let Some(server) = servers.iter().find(|s| s.server_id == server_id_clone) {
                    if get_status(&server_id_clone) == ServerStatus::Online {
                        server.create_backup().expect("Failed to create backup");
                    }
                }
            }) {
                Ok(j) => j,
                Err(e) => {
                    eprintln!("Failed to parse cron schedule '{}': {}", normalized, e);
                    return;
                }
            };

        let job_uuid = scheduler.add(job).await.unwrap();

        let server_id = self.server_id.clone();
        println!("Added backup job of interval {normalized} for server id {server_id}");
        JOB_IDS.lock().unwrap().insert(server_id, job_uuid);
    }

    pub async fn remove_backup_job(&self) {
        let uuid = {
            JOB_IDS.lock().unwrap().iter().filter(|j| j.0 == &self.server_id).map(|j| j.1.clone()).collect::<Vec<Uuid>>()
        };

        if uuid.len() > 0 {
            let server_id = self.server_id.clone();
            println!("Removing backup job for server id {server_id}");
            JOB_IDS.lock().unwrap().remove(&server_id);
            let scheduler = get_or_create_scheduler().await.unwrap();
            let _ = scheduler.remove(uuid.first().unwrap()).await;
        }
    }
}

pub async fn init_backup_jobs() {
    let servers = servers::get_cloned_servers();
    for server in &servers {
        if server.auto_backups {
            server.add_backup_job(&server.auto_backup_interval).await;
        }
    }
}
