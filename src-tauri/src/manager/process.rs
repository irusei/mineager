use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::process::{ChildStderr, ChildStdin, Command, Stdio};
use std::sync::{Arc, LazyLock, Mutex};
use std::{fs, thread};

use crate::manager::servers::get_cloned_servers;
use crate::{try_emit, update_frontend};

#[derive(Serialize, Deserialize, Clone, PartialEq, Eq)]
pub enum ServerStatus {
    Online,
    Offline,
}

#[derive(Clone)]
struct ServerProcess {
    stdin: Arc<Mutex<ChildStdin>>,
    stdout: Vec<String>,
    pid: u32,
    // child: Arc<Mutex<std::process::Child>>
}

#[derive(Deserialize, Serialize, Clone)]
struct ConsoleUpdatePayload {
    server_id: String,
    line: String,
}

static SERVER_PROCESS_HASHMAP: LazyLock<Mutex<HashMap<String, ServerProcess>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

pub fn start_server(server_id: &str) -> Result<(), Box<dyn std::error::Error>> {
    let server = {
        let locked_servers = get_cloned_servers()?;
        locked_servers
            .iter()
            .find(|s| s.server_id == server_id)
            .cloned()
    };

    if let Some(server) = server {
        // Check if process is running
        let process_running = {
            let locked_processes = SERVER_PROCESS_HASHMAP.lock()?;
            locked_processes.contains_key(server_id)
        };
        if process_running {
            return Err(format!("Server is already running").into());
        }

        let server_path = server.get_server_path();
        let jar_full = server.get_jar_file_path();
        let is_forge = jar_full.to_string_lossy().to_string().contains("forge");

        if !is_forge
            && (!jar_full.exists() || !jar_full.is_file() || !fs::metadata(&jar_full).is_ok())
        {
            return Err(format!("Server JAR not found at {:?}", jar_full).into());
        }

        // push child
        let program_path = server.java_path.clone();
        let mut config = Command::new(program_path);

        config
            .current_dir(server_path)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .arg(format!("-Xmx{}", &server.allocated_ram))
            .args(server.launch_args.split_whitespace());

        // Special Java arguments for GTNH .jar files
        let arg_files = vec!["java9args.txt"];

        for arg_file in arg_files {
            let mut arg_file_path = server.get_server_path();
            arg_file_path.push(arg_file);

            if arg_file_path.exists() {
                let buf: Vec<u8> = fs::read(arg_file_path)?;
                let args: String = String::from_utf8(buf)?;

                config.args(args.split_whitespace());
            }
        }

        if !is_forge {
            config
                .arg("-jar")
                .arg(jar_full) // we know it's a file
                .arg("nogui");
        } else {
            // when we're dealing with a forge .jars it should just be ignored IF there's a unix_args.txt or win_args.txt file in the same directory as the .jar
            // this probably shouldn't be this hacky but whatever
            #[cfg(windows)]
            let arg_file = "win_args.txt";
            #[cfg(unix)]
            let arg_file = "unix_args.txt";

            let mut arg_file_path = jar_full.clone();
            arg_file_path.pop();
            arg_file_path.push(arg_file);

            if arg_file_path.exists() {
                config.arg(format!("@{}", arg_file_path.to_string_lossy().to_string()));
                config.arg("nogui");
            } else {
                // whatever
                config.arg("-jar").arg(jar_full).arg("nogui");
            }
        }

        // create no window on windows
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            config.creation_flags(0x08000000); // WINDOWS CREATE_NO_WINDOW CREATION FLAG
        }

        let mut child = config.spawn().expect("Failed to run server");

        // separate child into stdin stdout and process
        let stdin = Arc::new(Mutex::new(child.stdin.take().unwrap()));
        let stdout = child.stdout.take().unwrap();
        let stderr: ChildStderr = child.stderr.take().unwrap();

        let pid = child.id();

        let child_arc = Arc::new(Mutex::new(child));

        let server_process = ServerProcess {
            stdin,
            stdout: Vec::new(),
            pid,
        };

        // Add process to hashmap
        {
            let mut locked_processes = SERVER_PROCESS_HASHMAP.lock()?;
            locked_processes.insert(server_id.to_string(), server_process);
        }

        update_frontend()?;

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
                        let line = String::from_utf8(buf);
                        if let Ok(line) = line {
                            match write_stdout(&server_id_clone, line.trim_end()) {
                                Ok(_) => continue,
                                Err(_) => break,
                            }
                        }
                    }
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
                        let line = String::from_utf8(buf);
                        if let Ok(line) = line {
                            match write_stdout(&server_id_clone, line.trim_end()) {
                                Ok(_) => continue,
                                Err(_) => break,
                            }
                        }
                    }
                    Err(_) => break,
                }
            }
        });

        // handle on a seperate thread when server closes
        // clean up process
        let server_id_clone = server.server_id.clone();
        thread::spawn(move || {
            {
                child_arc
                    .lock()
                    .expect("Failed to get child_arc")
                    .wait()
                    .expect("Failed to wait on process");

                SERVER_PROCESS_HASHMAP
                    .lock()
                    .expect("SERVER_PROCESS_HASHMAP poisoned")
                    .remove(&server_id_clone);
            }

            let _ = update_frontend();
        });

        return Ok(());
    }
    Err(format!("Unable to find server {}", server_id).into())
}

pub fn get_stdout(server_id: &str) -> Vec<String> {
    if let Ok(sph) = SERVER_PROCESS_HASHMAP.lock() {
        if let Some(proc) = sph.get(server_id).clone() {
            return proc.stdout.clone();
        }
    }
    vec![]
}

pub fn write_stdout(server_id: &str, line: &str) -> Result<(), Box<dyn std::error::Error>> {
    let mut process_hashmap = SERVER_PROCESS_HASHMAP.lock()?;
    let proc = process_hashmap.get_mut(server_id);
    if let Some(proc) = proc {
        try_emit::<ConsoleUpdatePayload>(
            "console-update",
            ConsoleUpdatePayload {
                server_id: server_id.to_string(),
                line: line.to_string(),
            },
        );
        proc.stdout.push(line.to_string());
    }

    Ok(())
}

pub fn write_stdin(server_id: &str, string: &str) -> Result<(), Box<dyn std::error::Error>> {
    // get stdin arc
    let stdin = {
        SERVER_PROCESS_HASHMAP
            .lock()?
            .get(server_id)
            .map(|s| s.stdin.clone())
    };

    if let Some(stdin) = stdin {
        // write to child_stdin
        {
            let mut child_stdin = stdin.lock().map_err(|e| format!("mutex poisoned: {}", e))?;
            child_stdin.write_all(format!("{}\n", string).as_bytes())?;
        }

        // now write to stdout
        write_stdout(server_id, &format!("> {}", string)).ok();
    }

    Ok(())
}

pub fn get_all_pids() -> Result<Vec<u32>, Box<dyn std::error::Error>> {
    let pids = SERVER_PROCESS_HASHMAP
        .lock()?
        .clone()
        .values()
        .map(|p| p.pid)
        .collect::<Vec<u32>>();

    Ok(pids)
}
pub fn stop_all_servers() -> Result<(), Box<dyn std::error::Error>> {
    let pids = get_all_pids()?
        .iter()
        .map(|pid| sysinfo::Pid::from_u32(*pid))
        .collect::<Vec<sysinfo::Pid>>();

    let mut system = sysinfo::System::new();

    system.refresh_processes(sysinfo::ProcessesToUpdate::Some(&pids), true);

    for pid in pids {
        if let Some(process) = system.process(pid) {
            process.kill();
        }
    }

    Ok(())
}

pub fn get_status(server_id: &str) -> Result<ServerStatus, Box<dyn std::error::Error>> {
    let found = {
        let locked_processes = SERVER_PROCESS_HASHMAP.lock()?;
        locked_processes.contains_key(server_id)
    };

    Ok(match found {
        true => ServerStatus::Online,
        false => ServerStatus::Offline,
    })
}
