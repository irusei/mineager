use std::sync::{Arc, LazyLock, Mutex};

use tokio_cron_scheduler::{Job, JobScheduler};
use uuid::Uuid;

use crate::manager::{backups, servers};

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

pub async fn remove_backup_job(uuid: &Uuid) {
    let scheduler = get_or_create_scheduler().await.unwrap();
    let _ = scheduler.remove(uuid).await;
}

// convert crons to crons containing seconds
fn normalize_cron(interval: &str) -> String {
    let parts: Vec<&str> = interval.trim().split_whitespace().collect();
    match parts.len() {
        5 => format!("0 {}", interval.trim()), // prepend seconds
        _ => interval.to_string(),
    }
}

pub async fn add_backup_job(server_id: &str, interval: &str) {
    let server_id_owned: String = server_id.to_owned();
    let normalized = normalize_cron(interval);

    let uuid = {
        JOB_IDS.lock().unwrap().iter().filter(|j| j.0 == server_id).map(|j| j.1.clone()).collect::<Vec<Uuid>>()
    };

    if uuid.len() > 0 {
        remove_backup_job(&uuid.first().unwrap()).await;
    }

    let scheduler: Arc<JobScheduler> = get_or_create_scheduler().await.unwrap();

    let job = match Job::new(&normalized, move |_uuid, _l| {
            let servers = servers::get_cloned_servers();
            if let Some(server) = servers.iter().find(|s| s.server_id == server_id_owned) {
                backups::create_backup(&server).expect("Failed to create backup");
            }
        }) {
            Ok(j) => j,
            Err(e) => {
                eprintln!("Failed to parse cron schedule '{}': {}", normalized, e);
                return;
            }
        };

    let job_uuid = scheduler.add(job).await.unwrap();

    println!("Added backup job of interval {normalized} for server id {server_id}");
    JOB_IDS.lock().unwrap().insert(server_id.to_owned(), job_uuid);
}

pub async fn init_backup_jobs() {
    let servers = servers::get_cloned_servers();
    for server in &servers {
        if server.auto_backups {
            add_backup_job(&server.server_id, &server.auto_backup_interval).await;
        }
    }
}
