use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::os::windows::process::CommandExt;
use std::{fs, thread};
use std::process::{ChildStderr, ChildStdin, Command, Stdio};
use std::sync::{Arc, LazyLock, Mutex};
use serde::{Deserialize, Serialize};

use crate::manager::servers::get_cloned_servers;
use crate::{try_emit, update_frontend};

#[derive(Serialize, Deserialize, Clone, PartialEq, Eq)]
pub enum ServerStatus {
    Online,
    Offline
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

static SERVER_PROCESS_HASHMAP: LazyLock<Mutex<HashMap<String, ServerProcess>>> = LazyLock::new(|| {
    Mutex::new(HashMap::new())
});


pub fn start_server(server_id: &str) -> Result<(), Box<dyn std::error::Error>>{
    let server = {
        let locked_servers = get_cloned_servers();
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

        let jar_path = server.get_server_path();
        let mut jar_full = jar_path.clone();
        jar_full.push("server.jar");

        if !fs::metadata(&jar_full).is_ok() {
            return Err(format!("Server JAR not found at {:?}", jar_full).into());
        }

        // push child
        let program_path = server.java_path.clone();
        let mut config = Command::new(program_path);
        
        config
            .current_dir(jar_path)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .arg(format!("-Xmx{}", &server.allocated_ram))
            .args(server.launch_args.split_whitespace())
            .arg("-jar")
            .arg("server.jar")
            .arg("nogui");

        // create no window on windows
        #[cfg(windows)] {
            config.creation_flags(0x08000000); // WINDOWS CREATE_NO_WINDOW CREATION FLAG
        }

        let mut child = config.spawn()
            .expect("Failed to run server");

        // separate child into stdin stdout and process
        let stdin = Arc::new(Mutex::new(child.stdin.take().unwrap()));
        let stdout = child.stdout.take().unwrap();
        let stderr: ChildStderr = child.stderr.take().unwrap();
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

        // stderr reader
        let server_id_clone = server.server_id.clone();
        thread::spawn(move || {
            let mut reader = BufReader::new(stderr);
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
        // clean up process 
        let server_id_clone = server.server_id.clone();
        thread::spawn(move || {
            {
                child_arc.lock().unwrap().wait().expect("Failed to wait on process");
                SERVER_PROCESS_HASHMAP.lock().unwrap().remove(&server_id_clone);
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

pub fn stop_all_servers() {
    let server_ids: Vec<String> = {
        let locked_processes = SERVER_PROCESS_HASHMAP.lock().unwrap();
        locked_processes.keys().cloned().collect()
    };

    for server_id in server_ids {
        write_stdin(&server_id, "stop");
    }
}

pub fn get_status(server_id: &str) -> ServerStatus {
    let found = {
        let locked_processes = SERVER_PROCESS_HASHMAP.lock().unwrap();
        locked_processes.contains_key(server_id)
    };

    match found {
        true => ServerStatus::Online,
        false => ServerStatus::Offline
    }
}