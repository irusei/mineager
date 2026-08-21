use std::sync::{LazyLock, Mutex};

use serde::{Deserialize, Serialize};
use tauri::{Emitter, Manager, WindowEvent};

use crate::{
    manager::{
        ban::{BanEntry, IpBanEntry},
        cron,
        operators::OperatorEntry,
        process,
        servers::{get_cloned_servers, import_server, Server},
        whitelist::WhitelistEntry,
    },
    minecraft::versions::{get_paper_versions, get_vanilla_versions},
};

mod java;
mod manager;
mod minecraft;
mod utils;

static MAIN_HANDLE: LazyLock<Mutex<Option<tauri::AppHandle>>> = LazyLock::new(|| Mutex::new(None));

#[derive(Serialize, Deserialize, Clone)]
struct FrontendServer {
    server: Server,
    status: process::ServerStatus,
}

fn try_emit<T: Serialize + Clone>(event: &str, payload: T) {
    if let Ok(handle) = MAIN_HANDLE.lock() {
        if let Some(handle) = handle.as_ref() {
            if let Some(window) = handle.app_handle().get_webview_window("main") {
                let _ = window.emit(event, payload);
            }
        }
    }
}

fn get_frontend_servers() -> Result<Vec<FrontendServer>, Box<dyn std::error::Error>> {
    Ok(get_cloned_servers()?
        .iter()
        .filter_map(|server| {
            Some(FrontendServer {
                server: server.clone(),
                status: process::get_status(&server.server_id).ok()?,
            })
        })
        .collect::<Vec<FrontendServer>>())
}

fn update_frontend() -> Result<(), Box<dyn std::error::Error>> {
    try_emit::<Vec<FrontendServer>>("update-local-servers", get_frontend_servers()?);

    Ok(())
}

#[tauri::command]
fn init_window_properties(app: tauri::AppHandle) -> Result<Vec<FrontendServer>, String> {
    // set handle so we can use it later
    if let Ok(mut handle) = MAIN_HANDLE.lock() {
        *handle = Some(app);
    }

    get_frontend_servers().map_err(|e| e.to_string())
}

#[tauri::command]
async fn fetch_versions(server_type: String) -> Vec<String> {
    match server_type.as_str() {
        "Vanilla" => get_vanilla_versions().await.unwrap_or_else(|_| Vec::new()),
        "Paper" => get_paper_versions().await.unwrap_or_else(|_| Vec::new()),
        _ => vec![],
    }
}

#[tauri::command(async)]
async fn create_server(
    server_name: String,
    server_type: String,
    version: String,
) -> Result<(), String> {
    crate::manager::servers::create_server(server_name, server_type, version)
        .await
        .map_err(|e| e.to_string())?;

    update_frontend().map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command(async)]
async fn create_server_from_archive(
    server_name: String,
    archive_path: String,
) -> Result<(), String> {
    import_server(server_name, archive_path)
        .await
        .map_err(|e| e.to_string())?;
    update_frontend().map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command(async)]
async fn update_server(server: Server) -> Result<(), String> {
    server.update().await.map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command(async)]
fn start_server(server_id: &str) {
    let servers = get_cloned_servers();
    if let Ok(servers) = servers {
        let server = servers.iter().find(|s| s.server_id == server_id).cloned();
        process::start_server(server_id).expect("Failed to launch server");
        if let Some(server) = server {
            if server.auto_backup_on_start {
                if let Err(e) = server.create_backup() {
                    eprintln!(
                        "Failed to create backup on startup for server {}: {}",
                        server.server_id, e
                    );
                }
            }
        }
    }
}

#[tauri::command(async)]
fn get_stdout(server_id: &str) -> Vec<String> {
    process::get_stdout(server_id)
}

#[tauri::command(async)]
fn get_eula_accepted(server_id: &str) -> Result<bool, String> {
    let servers = get_cloned_servers();

    if let Ok(servers) = servers {
        let server = servers
            .into_iter()
            .find(|s| s.server_id == server_id)
            .expect("server not found");

        return server.get_eula_accepted().map_err(|e| e.to_string());
    }

    Ok(false)
}

#[tauri::command(async)]
fn set_eula_accepted(server_id: &str, accepted: bool) {
    let servers = get_cloned_servers();

    if let Ok(servers) = servers {
        let server = servers
            .into_iter()
            .find(|s| s.server_id == server_id)
            .expect("server not found");
        server.set_eula_accepted(accepted);
    }
}

#[tauri::command(async)]
fn write_stdin(server_id: &str, string: &str) -> Result<(), String> {
    process::write_stdin(server_id, string).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command(async)]
fn read_properties_lines(server_id: &str) -> Result<Vec<String>, String> {
    let server = get_cloned_servers()
        .map_err(|e| e.to_string())?
        .into_iter()
        .find(|s| s.server_id == server_id)
        .expect("server not found");

    Ok(server
        .read_properties_lines()
        .expect("failed to read server.properties"))
}

#[tauri::command(async)]
fn write_properties(server_id: &str, new_properties: &str) -> Result<(), String> {
    let servers = get_cloned_servers().map_err(|e| e.to_string())?;

    let server = servers
        .into_iter()
        .find(|s| s.server_id == server_id)
        .ok_or("server not found")?;
    server
        .write_properties(new_properties)
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command(async)]
fn remove_server(server_id: &str) -> Result<(), String> {
    let servers = get_cloned_servers().map_err(|e| e.to_string())?;

    let server = servers
        .into_iter()
        .find(|s| s.server_id == server_id)
        .ok_or("server not found")?;
    server.remove().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn get_backups(server_id: &str) -> Result<Vec<crate::manager::backups::BackupEntry>, String> {
    let server = get_cloned_servers()
        .map_err(|e| e.to_string())?
        .into_iter()
        .find(|s| s.server_id == server_id)
        .expect("server not found");

    server.list_backups().map_err(|e| e.to_string())
}

#[tauri::command]
fn create_backup(server_id: &str) {
    let servers = get_cloned_servers();

    if let Ok(servers) = servers {
        let server = servers
            .into_iter()
            .find(|s| s.server_id == server_id)
            .expect("server not found");
        if let Err(e) = server.create_backup() {
            eprintln!("Failed to create backup: {}", e);
        }
    }
}

#[tauri::command]
fn delete_backup(server_id: &str, backup_name: &str) {
    let servers = get_cloned_servers();

    if let Ok(servers) = servers {
        let server = servers
            .into_iter()
            .find(|s| s.server_id == server_id)
            .expect("server not found");
        if let Err(e) = server.delete_backup(backup_name) {
            eprintln!("Failed to delete backup: {}", e);
        }
    }
}

#[tauri::command]
async fn restore_backup(server_id: &str, backup_name: &str) -> Result<(), String> {
    let server = get_cloned_servers()
        .map_err(|e| e.to_string())?
        .into_iter()
        .find(|s| s.server_id == server_id)
        .ok_or("server not found")?;
    server
        .restore_backup(backup_name)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn update_auto_backup(
    server_id: &str,
    enabled: bool,
    interval: String,
    on_start: bool,
) -> Result<(), String> {
    let servers = get_cloned_servers().map_err(|e| e.to_string())?;
    if let Some(server) = servers.iter().find(|s| s.server_id == server_id) {
        server
            .set_auto_backup(enabled, interval.clone(), on_start)
            .map_err(|e| e.to_string())?;
        if enabled {
            server
                .add_backup_job(&interval)
                .await
                .map_err(|e| e.to_string())?;
        } else {
            server
                .remove_backup_job()
                .await
                .map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[tauri::command]
fn open_server_folder(server_id: &str) {
    use tauri_plugin_opener::OpenerExt;
    let servers = get_cloned_servers();
    if let Ok(servers) = servers {
        if let Some(server) = servers.iter().find(|s| s.server_id == server_id) {
            let path = server.get_server_path();
            if let Ok(handle) = MAIN_HANDLE.lock() {
                if let Some(handle) = handle.as_ref() {
                    let _ = handle
                        .app_handle()
                        .opener()
                        .open_path(path.to_string_lossy().to_string(), None::<&str>);
                }
            }
        }
    }
}

#[tauri::command]
fn open_backup_folder(server_id: &str) {
    use tauri_plugin_opener::OpenerExt;
    let servers = get_cloned_servers();
    if let Ok(servers) = servers {
        if let Some(server) = servers.iter().find(|s| s.server_id == server_id) {
            let path = server.ensure_backup_path();
            if let Ok(path) = path {
                if let Ok(handle) = MAIN_HANDLE.lock() {
                    if let Some(handle) = handle.as_ref() {
                        let _ = handle
                            .app_handle()
                            .opener()
                            .open_path(path.to_string_lossy().to_string(), None::<&str>);
                    }
                }
            }
        }
    }
}

#[tauri::command(async)]
async fn add_whitelist_entry(server_id: &str, username: &str) -> Result<(), String> {
    let servers = get_cloned_servers().map_err(|e| e.to_string())?;
    if let Some(server) = servers.iter().find(|s| s.server_id == server_id) {
        server
            .add_whitelist_entry(username)
            .await
            .map_err(|e| e.to_string())
    } else {
        Ok(())
    }
}

#[tauri::command]
fn list_whitelist_entries(server_id: &str) -> Result<Vec<WhitelistEntry>, String> {
    let servers = get_cloned_servers().map_err(|e| e.to_string())?;
    if let Some(server) = servers.iter().find(|s| s.server_id == server_id) {
        server.read_whitelist().map_err(|e| e.to_string())
    } else {
        Ok(vec![])
    }
}

#[tauri::command(async)]
fn remove_whitelist_entry(server_id: &str, entry: WhitelistEntry) -> Result<(), String> {
    let servers = get_cloned_servers().map_err(|e| e.to_string())?;
    if let Some(server) = servers.iter().find(|s| s.server_id == server_id) {
        server
            .remove_whitelist_entry(&entry)
            .map_err(|e| e.to_string())
    } else {
        Ok(())
    }
}

#[tauri::command]
fn set_whitelist_enabled(server_id: &str, enabled: bool) -> Result<(), String> {
    let servers = get_cloned_servers().map_err(|e| e.to_string())?;
    if let Some(server) = servers.iter().find(|s| s.server_id == server_id) {
        server
            .set_whitelist_enabled(enabled)
            .map_err(|e| e.to_string())
    } else {
        Ok(())
    }
}

#[tauri::command]
fn is_whitelist_enabled(server_id: &str) -> bool {
    let servers = get_cloned_servers();
    if let Ok(servers) = servers {
        if let Some(server) = servers.iter().find(|s| s.server_id == server_id) {
            return server.is_whitelist_enabled();
        } else {
            return false;
        }
    }

    false
}

#[tauri::command(async)]
async fn ban_player(server_id: &str, username: &str, reason: &str) -> Result<(), String> {
    let servers = get_cloned_servers().map_err(|e| e.to_string())?;
    if let Some(server) = servers.iter().find(|s| s.server_id == server_id) {
        server
            .ban_player(username, reason)
            .await
            .map_err(|e| e.to_string())
    } else {
        Ok(())
    }
}

#[tauri::command(async)]
async fn ban_ip(server_id: &str, ip: &str, reason: &str) -> Result<(), String> {
    let servers = get_cloned_servers().map_err(|e| e.to_string())?;
    if let Some(server) = servers.iter().find(|s| s.server_id == server_id) {
        server.ban_ip(ip, reason).await.map_err(|e| e.to_string())
    } else {
        Ok(())
    }
}

#[tauri::command(async)]
fn read_banned_players(server_id: &str) -> Result<Vec<BanEntry>, String> {
    let servers = get_cloned_servers().map_err(|e| e.to_string())?;
    if let Some(server) = servers.iter().find(|s| s.server_id == server_id) {
        server.read_banned_players().map_err(|e| e.to_string())
    } else {
        Ok(vec![])
    }
}

#[tauri::command(async)]
fn read_banned_ips(server_id: &str) -> Result<Vec<IpBanEntry>, String> {
    let servers = get_cloned_servers().map_err(|e| e.to_string())?;
    if let Some(server) = servers.iter().find(|s| s.server_id == server_id) {
        server.read_banned_ips().map_err(|e| e.to_string())
    } else {
        Ok(vec![])
    }
}

#[tauri::command(async)]
fn unban_player(server_id: &str, entry: BanEntry) -> Result<(), String> {
    let servers = get_cloned_servers().map_err(|e| e.to_string())?;
    if let Some(server) = servers.iter().find(|s| s.server_id == server_id) {
        server.unban_player(entry).map_err(|e| e.to_string())
    } else {
        Ok(())
    }
}

#[tauri::command(async)]
fn unban_ip(server_id: &str, entry: IpBanEntry) -> Result<(), String> {
    let servers = get_cloned_servers().map_err(|e| e.to_string())?;
    if let Some(server) = servers.iter().find(|s| s.server_id == server_id) {
        server.unban_ip(entry).map_err(|e| e.to_string())
    } else {
        Ok(())
    }
}

#[tauri::command(async)]
async fn add_operator(server_id: &str, username: &str) -> Result<(), String> {
    let servers = get_cloned_servers().map_err(|e| e.to_string())?;
    if let Some(server) = servers.iter().find(|s| s.server_id == server_id) {
        server
            .add_operator(username)
            .await
            .map_err(|e| e.to_string())
    } else {
        Ok(())
    }
}

#[tauri::command]
fn remove_operator(server_id: &str, entry: OperatorEntry) -> Result<(), String> {
    let servers = get_cloned_servers().map_err(|e| e.to_string())?;
    if let Some(server) = servers.iter().find(|s| s.server_id == server_id) {
        server.remove_operator(&entry).map_err(|e| e.to_string())
    } else {
        Ok(())
    }
}

#[tauri::command]
fn list_operator_entries(server_id: &str) -> Result<Vec<OperatorEntry>, String> {
    let servers = get_cloned_servers().map_err(|e| e.to_string())?;
    if let Some(server) = servers.iter().find(|s| s.server_id == server_id) {
        server.read_operators().map_err(|e| e.to_string())
    } else {
        Ok(vec![])
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // run cron jobs
    tauri::async_runtime::spawn(async {
        let _ = cron::init_backup_jobs().await;
    });

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .on_window_event(|_window, event| match event {
            WindowEvent::CloseRequested { api: _, .. } => {
                let _ = process::stop_all_servers();
            }
            _ => (),
        })
        .invoke_handler(tauri::generate_handler![
            init_window_properties,
            fetch_versions,
            create_server,
            create_server_from_archive,
            update_server,
            start_server,
            get_stdout,
            get_eula_accepted,
            set_eula_accepted,
            write_stdin,
            read_properties_lines,
            write_properties,
            remove_server,
            get_backups,
            create_backup,
            delete_backup,
            restore_backup,
            update_auto_backup,
            open_server_folder,
            open_backup_folder,
            add_whitelist_entry,
            remove_whitelist_entry,
            list_whitelist_entries,
            set_whitelist_enabled,
            is_whitelist_enabled,
            ban_player,
            ban_ip,
            read_banned_players,
            read_banned_ips,
            unban_player,
            unban_ip,
            add_operator,
            remove_operator,
            list_operator_entries
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
