use std::sync::{LazyLock, Mutex};

use serde::{Deserialize, Serialize};
use tauri::{Emitter, Manager, WindowEvent};

use crate::{java::{detector::get_jre_version, jre::download_java}, manager::{process, servers::{self, Server, add_server, get_cloned_servers, install_server}}, minecraft::versions::{get_paper_versions, get_vanilla_versions}};

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
    let java_path = download_java(
       &get_jre_version(&version)
    ).await.map(|result| result.to_string_lossy().into_owned()).unwrap_or(String::from(""));

    let server = Server {
        server_id,
        server_name,
        server_type: server_type.clone(), // avoid moving
        server_version: version,
        launch_args: String::from(""),
        allocated_ram: String::from("4096M"),
        java_path: java_path,
    };

    // add server
    add_server(&server);

    // install server
    try_emit("update-create-button-text", "Installing server...");
    match install_server(&server).await {
        Ok(_) => update_frontend(),
        Err(ref err) => try_emit::<String>("alert", format!("{}", err)),
    }
}

#[tauri::command(async)]
async fn update_server(server: Server) {
    servers::update_server(&server).await;
}

#[tauri::command(async)]
fn start_server(server_id: &str) {
    process::start_server(server_id).expect("Failed to launch server");
}

#[tauri::command(async)]
fn get_stdout(server_id: &str) -> Vec<String> {
    process::get_stdout(server_id)
}

#[tauri::command(async)]
fn set_eula_accepted(server_id: &str, accepted: bool) {
    servers::set_eula_accepted(server_id, accepted);
}

#[tauri::command(async)]
fn write_stdin(server_id: &str, string: &str) {
    process::write_stdin(server_id, string);
}

#[tauri::command(async)]
fn read_properties_lines(server_id: &str) -> Vec<String> {
    servers::read_properties_lines(server_id).expect("failed to read server.properties")
}

#[tauri::command(async)]
fn write_properties(server_id: &str, new_properties: &str) {
    servers::write_properties(server_id, new_properties);
}

#[tauri::command(async)]
fn remove_server(server_id: &str) {
    servers::remove_server(server_id);
}


#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .on_window_event(|_window, event| {
            match event {
                WindowEvent::CloseRequested { api: _, .. } => process::stop_all_servers(),
                _ => ()
            }
        })
        .invoke_handler(tauri::generate_handler![init_window_properties, fetch_versions, create_server, update_server, 
            start_server, get_stdout, set_eula_accepted, write_stdin, read_properties_lines, write_properties, remove_server])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
