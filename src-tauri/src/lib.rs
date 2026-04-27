use std::sync::{LazyLock, Mutex};

use serde::{Deserialize, Serialize};
use tauri::{Emitter, Manager, WindowEvent};

use crate::{java::detector::get_jre_version, manager::{ban::{BanEntry, IpBanEntry}, cron, process, servers::{Server, get_cloned_servers}, whitelist::WhitelistEntry}, minecraft::versions::{get_paper_versions, get_vanilla_versions}, utils::path::sanitize_name};

mod minecraft;
mod manager;
mod java;
mod utils;

static MAIN_HANDLE: LazyLock<Mutex<Option<tauri::AppHandle>>> = LazyLock::new(|| { Mutex::new(None) });

#[derive(Serialize, Deserialize, Clone)]
struct FrontendServer {
    server: Server,
    status: process::ServerStatus
}

fn try_emit<T: Serialize + Clone>(event: &str, payload: T) {
    if let Some(handle) = MAIN_HANDLE.lock().unwrap().as_ref() {
        if let Some(window) = handle.app_handle().get_webview_window("main") {
            window.emit(event, payload).unwrap();
        }
    }
}

fn get_frontend_servers() -> Vec<FrontendServer> {
    get_cloned_servers()
        .iter()
        .map(|server|
            FrontendServer {
                server: server.clone(),
                status: process::get_status(&server.server_id)
            })
        .collect::<Vec<FrontendServer>>()
}
fn update_frontend() {
    try_emit::<Vec<FrontendServer>>("update-local-servers", get_frontend_servers());
}

#[tauri::command]
fn init_window_properties(app: tauri::AppHandle) -> Vec<FrontendServer> {
    *MAIN_HANDLE.lock().unwrap() = Some(app);
    get_frontend_servers()
}

#[tauri::command]
async fn fetch_versions(server_type: String) -> Vec<String> {
    match server_type.as_str() {
        "Vanilla" => get_vanilla_versions().await.unwrap(),
        "Paper" => get_paper_versions().await.unwrap(),
        _ => vec![],
    }
}

#[tauri::command(async)]
async fn create_server(server_name: String, server_type: String, version: String) {
    // create server
    let server_id: String = uuid::Uuid::new_v4().to_string();

    // download java
    try_emit("update-create-button-text", "Downloading Java...");
    let jre_version = &get_jre_version(&version);
    let java_path = jre_version.download().await.map(|result| result.to_string_lossy().into_owned()).unwrap_or(String::from(""));

    let server = Server {
        server_id,
        server_name: sanitize_name(&server_name),
        server_type: server_type.clone(), // avoid moving
        server_version: version,
        launch_args: String::from(""),
        allocated_ram: String::from("4096M"),
        java_path: java_path,
        backups: Vec::new(),
        auto_backups: false,
        auto_backup_on_start: false,
        auto_backup_interval: String::from("0 * * * *")
    };

    // add server
    server.add();

    // install server
    try_emit("update-create-button-text", "Installing server...");
    match server.install().await {
        Ok(_) => update_frontend(),
        Err(ref err) => try_emit::<String>("alert", format!("{}", err)),
    }
}

#[tauri::command(async)]
async fn update_server(server: Server) {
    server.update().await;
}

#[tauri::command(async)]
fn start_server(server_id: &str) {
    let servers = get_cloned_servers();
    let server = servers.iter().find(|s| s.server_id == server_id).cloned();
    process::start_server(server_id).expect("Failed to launch server");
    if let Some(server) = server {
        if server.auto_backup_on_start {
            if let Err(e) = server.create_backup() {
                eprintln!("Failed to create backup on startup for server {}: {}", server.server_id, e);
            }
        }
    }
}

#[tauri::command(async)]
fn get_stdout(server_id: &str) -> Vec<String> {
    process::get_stdout(server_id)
}

#[tauri::command(async)]
fn set_eula_accepted(server_id: &str, accepted: bool) {
    let server = get_cloned_servers().into_iter().find(|s| s.server_id == server_id).expect("server not found");
    server.set_eula_accepted(accepted);
}

#[tauri::command(async)]
fn write_stdin(server_id: &str, string: &str) {
    process::write_stdin(server_id, string);
}

#[tauri::command(async)]
fn read_properties_lines(server_id: &str) -> Vec<String> {
    let server = get_cloned_servers().into_iter().find(|s| s.server_id == server_id).expect("server not found");
    server.read_properties_lines().expect("failed to read server.properties")
}

#[tauri::command(async)]
fn write_properties(server_id: &str, new_properties: &str) {
    let server = get_cloned_servers().into_iter().find(|s| s.server_id == server_id).expect("server not found");
    server.write_properties(new_properties);
}

#[tauri::command(async)]
fn remove_server(server_id: &str) {
    let server = get_cloned_servers().into_iter().find(|s| s.server_id == server_id).expect("server not found");
    server.remove();
}

#[tauri::command]
fn get_backups(server_id: &str) -> Vec<crate::manager::backups::BackupEntry> {
    let server = get_cloned_servers().into_iter().find(|s| s.server_id == server_id).expect("server not found");
    server.list_backups()
}

#[tauri::command]
fn create_backup(server_id: &str) {
    let server = get_cloned_servers().into_iter().find(|s| s.server_id == server_id).expect("server not found");
    if let Err(e) = server.create_backup() {
        eprintln!("Failed to create backup: {}", e);
    }
}

#[tauri::command]
fn delete_backup(server_id: &str, backup_name: &str) {
    let server = get_cloned_servers().into_iter().find(|s| s.server_id == server_id).expect("server not found");
    if let Err(e) = server.delete_backup(backup_name) {
        eprintln!("Failed to delete backup: {}", e);
    }
}

#[tauri::command]
async fn restore_backup(server_id: &str, backup_name: &str) -> Result<(), String> {
    let server = get_cloned_servers().into_iter().find(|s| s.server_id == server_id).ok_or("server not found")?;
    server.restore_backup(backup_name).await.map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn update_auto_backup(server_id: &str, enabled: bool, interval: String, on_start: bool) -> Result<(), String> {
    let servers = get_cloned_servers();
    if let Some(server) = servers.iter().find(|s| s.server_id == server_id) {
        server.set_auto_backup(enabled, interval.clone(), on_start);
        if enabled {
            server.add_backup_job(&interval).await;
        } else {
            server.remove_backup_job().await;
        }
    }
    Ok(())
}

#[tauri::command]
fn open_server_folder(server_id: &str) {
    use tauri_plugin_opener::OpenerExt;
    let servers = get_cloned_servers();
    if let Some(server) = servers.iter().find(|s| s.server_id == server_id) {
        let path = server.get_server_path();
        if let Some(handle) = MAIN_HANDLE.lock().unwrap().as_ref() {
            let _ = handle.app_handle().opener().open_path(path.to_string_lossy().to_string(), None::<&str>);
        }
    }
}

#[tauri::command]
fn open_backup_folder(server_id: &str) {
    use tauri_plugin_opener::OpenerExt;
    let servers = get_cloned_servers();
    if let Some(server) = servers.iter().find(|s| s.server_id == server_id) {
        let path = server.ensure_backup_path();
        if let Some(handle) = MAIN_HANDLE.lock().unwrap().as_ref() {
            let _ = handle.app_handle().opener().open_path(path.to_string_lossy().to_string(), None::<&str>);
        }
    }
}

#[tauri::command(async)]
async fn add_whitelist_entry(server_id: &str, username: &str) -> Result<(), String> {
    let servers = get_cloned_servers();
    if let Some(server) = servers.iter().find(|s| s.server_id == server_id) {
        server.add_whitelist_entry(username).await.map_err(|e| e.to_string())
    } else {
        Ok(())
    }
}

#[tauri::command]
fn list_whitelist_entries(server_id: &str) -> Result<Vec<WhitelistEntry>, String> {
    let servers = get_cloned_servers();
    if let Some(server) = servers.iter().find(|s| s.server_id == server_id) {
        server.read_whitelist().map_err(|e| e.to_string())
    } else {
        Ok(vec![])
    }
}

#[tauri::command(async)]
fn remove_whitelist_entry(server_id: &str, entry: WhitelistEntry) -> Result<(), String> {
    let servers = get_cloned_servers();
    if let Some(server) = servers.iter().find(|s| s.server_id == server_id) {
        server.remove_whitelist_entry(&entry).map_err(|e| e.to_string())
    } else {
        Ok(())
    }
}

#[tauri::command]
fn set_whitelist_enabled(server_id: &str, enabled: bool) -> Result<(), String> {
    let servers = get_cloned_servers();
    if let Some(server) = servers.iter().find(|s| s.server_id == server_id) {
        server.set_whitelist_enabled(enabled).map_err(|e| e.to_string())
    } else {
        Ok(())
    }
}

#[tauri::command]
fn is_whitelist_enabled(server_id: &str) -> bool {
    let servers = get_cloned_servers();
    if let Some(server) = servers.iter().find(|s| s.server_id == server_id) {
        server.is_whitelist_enabled()
    } else {
        false
    }
}

#[tauri::command(async)]
async fn ban_player(server_id: &str, username: &str, reason: &str) -> Result<(), String> {
    let servers = get_cloned_servers();
    if let Some(server) = servers.iter().find(|s| s.server_id == server_id) {
        server.ban_player(username, reason).await.map_err(|e| e.to_string())
    } else {
        Ok(())
    }
}

#[tauri::command(async)]
async fn ban_ip(server_id: &str, ip: &str, reason: &str) -> Result<(), String> {
    let servers = get_cloned_servers();
    if let Some(server) = servers.iter().find(|s| s.server_id == server_id) {
        server.ban_ip(ip, reason).await.map_err(|e| e.to_string())
    } else {
        Ok(())
    }
}

#[tauri::command(async)]
fn read_banned_players(server_id: &str) -> Result<Vec<BanEntry>, String> {
    let servers = get_cloned_servers();
    if let Some(server) = servers.iter().find(|s| s.server_id == server_id) {
        server.read_banned_players().map_err(|e| e.to_string())
    } else {
        Ok(vec![])
    }
}

#[tauri::command(async)]
fn read_banned_ips(server_id: &str) -> Result<Vec<IpBanEntry>, String> {
    let servers = get_cloned_servers();
    if let Some(server) = servers.iter().find(|s| s.server_id == server_id) {
        server.read_banned_ips().map_err(|e| e.to_string())
    } else {
        Ok(vec![])
    }
}

#[tauri::command(async)]
fn unban_player(server_id: &str, entry: BanEntry) -> Result<(), String> {
    let servers = get_cloned_servers();
    if let Some(server) = servers.iter().find(|s| s.server_id == server_id) {
        server.unban_player(entry).map_err(|e| e.to_string())
    } else {
        Ok(())
    }
}

#[tauri::command(async)]
fn unban_ip(server_id: &str, entry: IpBanEntry) -> Result<(), String> {
    let servers = get_cloned_servers();
    if let Some(server) = servers.iter().find(|s| s.server_id == server_id) {
        server.unban_ip(entry).map_err(|e| e.to_string())
    } else {
        Ok(())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // run cron jobs
    tauri::async_runtime::spawn(async {
        cron::init_backup_jobs().await;
    });

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .on_window_event(|_window, event| {
            match event {
                WindowEvent::CloseRequested { api: _, .. } => process::stop_all_servers(),
                _ => ()
            }
        })
        .invoke_handler(tauri::generate_handler![init_window_properties, fetch_versions, create_server, update_server, 
            start_server, get_stdout, set_eula_accepted, write_stdin, read_properties_lines, write_properties, remove_server,
            get_backups, create_backup, delete_backup, restore_backup, update_auto_backup, open_server_folder, open_backup_folder,
            add_whitelist_entry, remove_whitelist_entry, list_whitelist_entries, set_whitelist_enabled, is_whitelist_enabled,
            ban_player, ban_ip, read_banned_players, read_banned_ips, unban_player, unban_ip ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
