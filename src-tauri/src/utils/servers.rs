use std::fs;
use std::fs::{File, OpenOptions};
use std::io::{BufRead, BufReader, ErrorKind, Write};
use std::sync::{LazyLock, Mutex};
use serde::{Deserialize, Serialize};
use crate::utils::jars;
use crate::utils::local_servers::LocalServer;
use crate::utils::path::get_core_path;

// TODO: convert this to a mutex
const SERVER_STORAGE_FILE: &str = "servers.json";
static SERVERS: LazyLock<Mutex<Vec<Server>>> = LazyLock::new(|| Mutex::new(read_servers()));

#[derive(Deserialize, Serialize, Clone)]
pub(crate) struct Server {
    pub(crate) server_id: String,
    pub(crate) server_name: String,
    pub(crate) server_type: String,
    pub(crate) server_version: String,
    pub(crate) launch_args: String,
    pub(crate) allocated_ram: String,
    pub(crate) java_path: String
}

pub fn get_cloned_servers() -> Vec<Server> {
    return (*SERVERS.lock().unwrap()).clone();
}

pub fn get_server_path(server_id: &str) -> Option<std::path::PathBuf> {
    let mut path = get_core_path();
    path.push("servers");
    path.push(server_id);

    if fs::exists(&path).unwrap() {
        Some(path)
    } else {
        None
    }
}

pub fn ensure_file() {
    let mut path = get_core_path();
    fs::create_dir_all(&path).expect("Failed to create directory");

    path.push("servers");
    fs::create_dir_all(&path).expect("Failed to create directory");

    path.pop();
    path.push(SERVER_STORAGE_FILE);

    if !fs::exists(&path).unwrap() {
        let json_data = Vec::<Server>::new();
        let mut storage_file = File::create(path).expect("Failed to create servers.json");

        let json = serde_json::to_string_pretty(&json_data).expect("Failed to serialize json");
        storage_file.write_all(json.as_bytes()).expect("Failed to write json");
    }
}

pub fn clean_server_directory(server_id: &str) {
    let mut path = get_core_path();
    path.push("servers");
    path.push(server_id);

    if fs::exists(&path).unwrap() {
        fs::remove_dir_all(path).unwrap();
    }
}

pub fn read_servers() -> Vec<Server> {
    ensure_file();
    let mut path = get_core_path();
    path.push(SERVER_STORAGE_FILE);

    let storage_file = File::open(path).expect("Failed to open servers.json");

    serde_json::from_reader(storage_file).expect("Failed to deserialize json")
}

pub fn save_servers() {
    let servers = get_cloned_servers();

    let mut path = get_core_path();
    path.push(SERVER_STORAGE_FILE);

    let mut storage_file = OpenOptions::new()
        .write(true)
        .truncate(true)
        .open(path)
        .expect("Failed to open servers.json");

    let json = serde_json::to_string_pretty(&servers).expect("Failed to serialize json");
    storage_file.write_all(json.as_bytes()).expect("Failed to write json");
}

pub fn add_server(server: Server) {
    {
        let mut servers = SERVERS.lock().unwrap();
        servers.push(server);
    }
    save_servers()
}

pub fn remove_server(server_id: &str) {
    {
        let mut servers = SERVERS.lock().unwrap();
        
        if let Some(index) = servers.iter().position(|s| s.server_id == server_id) {
            servers.remove(index);
        }

        clean_server_directory(server_id);
    }
    save_servers()
}

pub fn set_eula_accepted(server_id: &str, accepted: bool) {
    let mut eula_path = get_server_path(server_id).unwrap();
    eula_path.push("eula.txt");

    let mut eula_file = OpenOptions::new()
        .write(true)
        .truncate(true)
        .open(eula_path)
        .expect("Failed to open eula.txt");

    eula_file.write_all(format!("eula={}", accepted.to_string()).as_bytes()).expect("Cannot write to eula.txt");
}

pub async fn install_server(server: Server) -> Result<(), Box<dyn std::error::Error>> {
    let option_server_path = get_server_path(&server.server_id);
    let mut server_path: std::path::PathBuf;

    // create folder if it doesn't exist
    if let Some(path) = option_server_path {
        server_path = path;
    } else {
        let mut temp_path = get_core_path();
        temp_path.push("servers");
        temp_path.push(&server.server_id);

        fs::create_dir_all(&temp_path).expect("Failed to create server directory");

        server_path = temp_path;
    }

    let jar_file = match server.server_type.clone().as_str() {
        "Vanilla" => jars::get_mojang_jar(&server.server_version).await,
        "Paper" => jars::get_paper_jar(&server.server_version).await,
        _ => jars::get_paper_jar(&server.server_version).await,
    };

    if let Err(ref err) = jar_file {
        println!("{}", err);
        
        // cleanup
        remove_server(&server.server_id);
        return Err(format!("failed to fetch jar file: {}", err).into());
    }

    server_path.push("server.jar");

    OpenOptions::new()
        .create(true)
        .truncate(true)
        .write(true)
        .open(&server_path)?
        .write_all(&jar_file.unwrap())?;

    Ok(())

}

pub fn update_server_from_local_server(local_server: LocalServer) {
    {
        let mut servers = SERVERS.lock().unwrap();
        
        if let Some(index) = servers.iter().position(|s| s.server_id.eq(&local_server.server_id)) {
            servers[index] = Server {
                server_id: local_server.server_id,
                server_name: local_server.server_name,
                server_type: local_server.server_type,
                server_version: local_server.server_version,
                launch_args: local_server.launch_args,
                java_path: local_server.java_path,
                allocated_ram: local_server.allocated_ram
            };
        }
    }

    save_servers()
}

pub fn read_properties_lines(server_id: &str) -> Result<Vec<String>, Box<dyn std::error::Error>> {
    let mut server_properties_path = get_server_path(server_id).unwrap();
    server_properties_path.push("server.properties");
    if !fs::exists(&server_properties_path).unwrap() {
        return Ok(Vec::new());
    }

    let server_properties_file = OpenOptions::new()
        .create(false)
        .read(true) 
        .open(server_properties_path)
        .unwrap();
    
    
    let mut lines: Vec<String> = Vec::new();
    let mut reader = BufReader::new(server_properties_file);

    loop {
        let mut buf: Vec<u8> = Vec::new();
        match reader.read_until(b'\n', &mut buf) {
            Ok(0) => break,
            Ok(_) => {
                let line = String::from_utf8(buf).unwrap();
                lines.push(line.trim_end().to_string());
            },
            Err(ref e) => {
                if e.kind() == ErrorKind::WouldBlock  { 
                    break 
                }

                return Err(format!("failed to read server.properties").into());
            }
        }
    }

    Ok(lines)
    
}

pub fn write_properties(server_id: &str, properties: &str) {
    let mut server_properties_path = get_server_path(server_id).unwrap();
    server_properties_path.push("server.properties");

    let mut server_properties_file = OpenOptions::new()
        .create(true)
        .write(true)
        .truncate(true) 
        .open(server_properties_path)
        .unwrap();

    server_properties_file.write_all(properties.as_bytes()).expect("failed to write to server.properties")
}