use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::{fs, thread};
use std::process::{ChildStdin, Command, Stdio};
use std::sync::{Arc, LazyLock, Mutex};
use serde::{Deserialize, Serialize};

use crate::manager::servers;
use crate::{try_emit, update_frontend};

#[derive(Deserialize, Serialize, Clone)]
pub enum ServerStatus {
    Online=0,
    Idle=1,
    Offline=2,
}

#[derive(Deserialize, Serialize, Clone)]
pub(crate) struct LocalServer {
    pub(crate) server_id: String,
    pub(crate) server_name: String,
    pub(crate) server_type: String,
    pub(crate) server_version: String,
    pub(crate) launch_args: String,
    pub(crate) allocated_ram: String,
    pub(crate) java_path: String,

    pub(crate) status: ServerStatus,
}

struct ServerProcess {
    stdin: Arc<Mutex<ChildStdin>>,
    stdout: Vec<String>,
    // child: Arc<Mutex<std::process::Child>>
}

#[derive(Deserialize, Serialize, Clone)]
struct ConsoleUpdatePayload {
    server_id: String,
    line: String,
}

static SERVERS: LazyLock<Mutex<Vec<LocalServer>>> = LazyLock::new(|| {
    Mutex::new(vec![])
});

static SERVER_PROCESS_HASHMAP: LazyLock<Mutex<HashMap<String, ServerProcess>>> = LazyLock::new(|| {
    Mutex::new(HashMap::new())
});

pub fn diff_local_servers() {
    let servers = servers::get_cloned_servers();
    // TODO: delete servers that don't exist in the file anymore
    for server in servers {
        let locked_servers: Vec<LocalServer> = {
            SERVERS.lock().unwrap().clone()
        };
        if !locked_servers.iter().any(|s| s.server_id == server.server_id) {
            let local_server = LocalServer {
                server_id: server.server_id,
                server_name: server.server_name,
                server_type: server.server_type,
                server_version: server.server_version,
                allocated_ram: server.allocated_ram,
                launch_args: server.launch_args,
                java_path: server.java_path,

                status: ServerStatus::Offline
            };
 
            {
                SERVERS.lock().unwrap().push(local_server);
            }
        }
    }
}
pub fn get_local_servers() -> Vec<LocalServer> {
    diff_local_servers();
    SERVERS.lock().unwrap().clone()
}

pub fn start_local_server(server_id: &str) -> Result<(), Box<dyn std::error::Error>>{
    diff_local_servers();
    let server = {
        let locked_servers = SERVERS.lock().unwrap();
        locked_servers.iter().find(|s| s.server_id == server_id).cloned()
    };

    if let Some(server) = server {
        // Check if process is running
        let process_running = {
            let locked_processes = SERVER_PROCESS_HASHMAP.lock().unwrap();
            locked_processes.contains_key(server_id)
        };
        if process_running {
            return Err(format!("Server is already running").into());
        }

        let mut jar_path = servers::get_server_path(server_id).unwrap();
        jar_path.push("server.jar");

        if !fs::metadata(&jar_path).is_ok() {
            return Err(format!("Server JAR not found at {:?}", jar_path).into());
        }

        // push child
        let mut child = Command::new(server.java_path.clone())
            .current_dir(servers::get_server_path(server_id).unwrap())
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .arg(format!("-Xmx{}", &server.allocated_ram))
            .args(server.launch_args.split_whitespace())
            .arg("-jar")
            .arg("server.jar")
            .arg("--nogui")
            .spawn()
            .expect("Failed to run server");

        // separate child into stdin stdout and process
        let stdin = Arc::new(Mutex::new(child.stdin.take().unwrap()));
        let stdout = child.stdout.take().unwrap();
        let child_arc = Arc::new(Mutex::new(child));
        
        let server_process = ServerProcess {
            stdin,
            stdout: Vec::new(),
            // child: child_arc.clone(),
        };
        
        // Add process to hashmap
        {
            let mut locked_processes = SERVER_PROCESS_HASHMAP.lock().unwrap();
            locked_processes.insert(server_id.to_string(), server_process);
        }
    
        // change status
        {
            let mut locked_servers = SERVERS.lock().unwrap();
            locked_servers.iter_mut().find(|s| s.server_id == server.server_id).unwrap().status = ServerStatus::Online;
        }

        update_frontend();

        // reader thread
        // handle server stdout and put into a vec in ServerProcess
        let server_id_clone = server.server_id.clone();
        thread::spawn(move || {
            let mut reader = BufReader::new(stdout);
            loop {
                let mut buf: Vec<u8> = Vec::new();
                match reader.read_until(b'\n', &mut buf) {
                    Ok(0) => break,
                    Ok(_) => {
                        let line = String::from_utf8(buf).unwrap();
                        match write_stdout(&server_id_clone, line.trim_end()) {
                            Ok(_) => continue,
                            Err(_) => break
                        }
                    },
                    Err(_) => break,
                }
            }
        });
        // handle on a seperate thread when server closes
        // clean up process and change status
        let server_id_clone = server.server_id.clone();
        thread::spawn(move || {
            {
                child_arc.lock().unwrap().wait().expect("Failed to wait on process");
                SERVER_PROCESS_HASHMAP.lock().unwrap().remove(&server_id_clone);
                if let Some(server) = SERVERS.lock().unwrap().iter_mut().find(|s| s.server_id.eq(&server_id_clone)) {
                    server.status = ServerStatus::Offline;
                }
            }
            
            update_frontend();
        });

        return Ok(())
    }
    Err(format!("Unable to find server {}", server_id).into())
}

pub fn get_stdout(server_id: &str) -> Vec<String> {
    if let Some(proc) = SERVER_PROCESS_HASHMAP.lock().unwrap().get(server_id).clone() {
        return proc.stdout.clone();
    }
    vec![]
}

pub fn write_stdout(server_id: &str, line: &str) -> Result<(), ()> {
    let mut process_hashmap = SERVER_PROCESS_HASHMAP.lock().unwrap();
    let proc = process_hashmap.get_mut(server_id);
    if let Some(proc) = proc {
        try_emit::<ConsoleUpdatePayload>("console-update", ConsoleUpdatePayload {
            server_id: server_id.to_string(),
            line: line.to_string(),
        });
        proc.stdout.push(line.to_string());
        Ok(())
    } else {
        Err(())
    }
}

pub fn write_stdin(server_id: &str, string: &str) {
    // get stdin arc
    let stdin = {
        SERVER_PROCESS_HASHMAP.lock().unwrap().get(server_id).map(|s| s.stdin.clone())
    };

    if let Some(stdin) = stdin {
        // write to child_stdin
        {
            let mut child_stdin = stdin.lock().unwrap();
            child_stdin.write_all(format!("{}\n", string).as_bytes()).unwrap();
        }
        
        // now write to stdout 
        write_stdout(server_id, &format!("> {}", string)).ok();
    }
}

pub fn update_local_server(server: LocalServer) {
    {
        let mut locked_servers = SERVERS.lock().unwrap();

        if let Some(old_server) = locked_servers.iter_mut().find(|s| s.server_id == server.server_id.clone()) {
            old_server.server_name = server.server_name.clone();
            old_server.server_type = server.server_type.clone();
            old_server.server_version = server.server_version.clone();
            old_server.allocated_ram = server.allocated_ram.clone();
            old_server.java_path = server.java_path.clone();
            old_server.launch_args = server.launch_args.clone();

            servers::update_server_from_local_server(server);
        }
    }

    update_frontend();
}