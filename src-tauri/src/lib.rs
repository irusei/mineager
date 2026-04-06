use std::sync::{LazyLock, Mutex};

use serde::Serialize;
use tauri::{Emitter, Manager};

use crate::utils::java::{detector, jre};
use crate::utils::{local_servers, servers};
use crate::utils::versions::{get_paper_versions, get_vanilla_versions};

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
mod utils;

static MAIN_HANDLE: LazyLock<Mutex<Option<tauri::AppHandle>>> = LazyLock::new(|| { Mutex::new(None) });

fn try_emit<T: Serialize + Clone>(event: &str, payload: T) {
    if let Some(handle) = MAIN_HANDLE.lock().unwrap().as_ref() {
        if let Some(window) = handle.app_handle().get_webview_window("main") {
            window.emit(event, payload).unwrap();
        }
    }
}

fn update_frontend() {
    try_emit::<Vec<local_servers::LocalServer>>("update-local-servers", local_servers::get_local_servers());
}

#[tauri::command]
fn init_window_properties(app: tauri::AppHandle) {
    *MAIN_HANDLE.lock().unwrap() = Some(app);
    update_frontend();
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
    // return if server exists
    println!("Creating server: {}", server_name);

    // create server
    let server_id: String = uuid::Uuid::new_v4().to_string();

    // download java
    try_emit("update-create-button-text", "Downloading Java...");
    let java_path = jre::download_java(
        &detector::get_jre_version(&version)
    ).await.map(|result| result.to_string_lossy().into_owned()).unwrap_or(String::from(""));

    let server = servers::Server {
        server_id,
        server_name,
        server_type: server_type.clone(), // avoid moving
        server_version: version,
        launch_args: String::from(""),
        allocated_ram: String::from("4096M"),
        java_path: java_path,
    };

    // add server
    servers::add_server(server.clone());

    // install server
    try_emit("update-create-button-text", "Installing server...");
    match servers::install_server(server).await {
        Ok(_) => update_frontend(),
        Err(ref err) => try_emit::<String>("alert", format!("{}", err)),
    }
}

#[tauri::command(async)]
fn update_local_server(server: local_servers::LocalServer) {
    local_servers::update_local_server(server);
    
    // update window
    update_frontend();
}

#[tauri::command(async)]
fn start_server(server_id: String) {
    local_servers::start_local_server(&server_id).expect("Failed to launch server");
}

#[tauri::command(async)]
fn request_servers() {
    update_frontend();
}

#[tauri::command(async)]
fn get_stdout(server_id: &str) -> Vec<String> {
    local_servers::get_stdout(server_id)
}

#[tauri::command(async)]
fn set_eula_accepted(server_id: &str, accepted: bool) {
    servers::set_eula_accepted(server_id, accepted);
}

#[tauri::command(async)]
fn write_stdin(server_id: &str, string: &str) {
    local_servers::write_stdin(server_id, string);
}

#[tauri::command(async)]
fn read_properties_lines(server_id: &str) -> Vec<String> {
    servers::read_properties_lines(server_id).expect("failed to read server.properties")
}

#[tauri::command(async)]
fn write_properties(server_id: &str, new_properties: &str) {
    servers::write_properties(server_id, new_properties);
}


#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![init_window_properties, request_servers, fetch_versions, create_server, update_local_server, 
            start_server, get_stdout, set_eula_accepted, write_stdin, read_properties_lines, write_properties])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
