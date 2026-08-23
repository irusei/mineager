use serde::{Deserialize, Serialize};
use std::fs;
use std::fs::{File, OpenOptions};
use std::io::{BufRead, BufReader, ErrorKind, Write};
use std::path::PathBuf;
use std::process::Command;
use std::sync::{LazyLock, Mutex, MutexGuard};
use zip::ZipArchive;

use crate::java::detector::{get_jre_version, JreVersion};
use crate::manager::backups::{Backup, BackupSettings};
use crate::minecraft::jars;
use crate::utils::path::{get_core_path, sanitize_name};
use crate::{try_emit, update_frontend};

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
    pub(crate) java_path: String,
    #[serde(default)]
    pub(crate) jar_path: String,

    // backups
    #[serde(default)]
    pub(crate) backups: Vec<Backup>,
    #[serde(default)]
    pub(crate) backup_settings: BackupSettings,
}

impl Server {
    pub fn add(&self) -> Result<(), Box<dyn std::error::Error>> {
        {
            let mut servers = SERVERS.lock()?;
            servers.push(self.clone());
        }
        save_servers()?;

        Ok(())
    }

    pub fn remove(&self) -> Result<(), Box<dyn std::error::Error>> {
        {
            let mut servers = SERVERS.lock()?;

            if let Some(index) = servers.iter().position(|s| s.server_id == self.server_id) {
                servers.remove(index);
            }

            self.clean_server_directory()?;
            self.clean_backup_directory()?;
        }
        save_servers()?;

        Ok(())
    }

    pub async fn change_server_details(
        &self,
        new_server_type: &str,
        new_server_version: &str,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let jre_version = &get_jre_version(new_server_version);
        let java_path: String = jre_version.download().await?.to_string_lossy().to_string();

        let mut updated = Server {
            server_id: self.server_id.clone(),
            server_name: sanitize_name(&self.server_name),
            server_type: new_server_type.to_string(),
            server_version: new_server_version.to_string(),
            launch_args: self.launch_args.clone(),
            java_path: java_path,
            jar_path: self.jar_path.clone(),
            allocated_ram: self.allocated_ram.clone(),
            backups: self.backups.clone(),
            backup_settings: self.backup_settings.clone(),
        };

        updated.install().await?;

        {
            let mut servers = SERVERS.lock()?;
            if let Some(index) = servers.iter().position(|s| s.server_id == self.server_id) {
                servers[index] = updated
            }
        }

        save_servers()?;

        Ok(())
    }

    pub async fn update(&self) -> Result<(), Box<dyn std::error::Error>> {
        let needs_reinstall: bool = {
            let servers = SERVERS.lock()?;
            if let Some(s) = servers.iter().find(|s| s.server_id == self.server_id) {
                if s.server_type != self.server_type || s.server_version != self.server_version {
                    true
                } else {
                    false
                }
            } else {
                false
            }
        };

        if needs_reinstall {
            let jre_version = &get_jre_version(&self.server_version);
            let java_path: String = jre_version
                .download()
                .await
                .map(|result| result.to_string_lossy().into_owned())
                .unwrap_or(String::from(""));

            let mut updated = Server {
                server_id: self.server_id.clone(),
                server_name: sanitize_name(&self.server_name),
                server_type: self.server_type.clone(),
                server_version: self.server_version.clone(),
                launch_args: self.launch_args.clone(),
                java_path: java_path,
                jar_path: self.jar_path.clone(),
                allocated_ram: self.allocated_ram.clone(),
                backups: self.backups.clone(),
                backup_settings: self.backup_settings.clone(),
            };

            {
                match updated.install().await {
                    Ok(_) => {
                        let mut servers = SERVERS.lock()?;
                        if let Some(index) =
                            servers.iter().position(|s| s.server_id == self.server_id)
                        {
                            servers[index] = updated
                        }
                    }
                    Err(ref err) => try_emit::<String>("alert", format!("{}", err)),
                }
            }
        } else {
            let mut servers = SERVERS.lock()?;
            if let Some(index) = servers.iter().position(|s| s.server_id == self.server_id) {
                servers[index] = Server {
                    server_id: self.server_id.clone(),
                    server_name: sanitize_name(&self.server_name),
                    server_type: self.server_type.clone(),
                    server_version: self.server_version.clone(),
                    launch_args: self.launch_args.clone(),
                    java_path: self.java_path.clone(),
                    jar_path: self.jar_path.clone(),
                    allocated_ram: self.allocated_ram.clone(),
                    backups: self.backups.clone(),
                    backup_settings: self.backup_settings.clone(),
                };
            }
        }

        save_servers()?;

        Ok(())
    }

    pub async fn install(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        let mut server_path = self.get_server_path();

        if !server_path.exists() {
            fs::create_dir_all(&server_path)?;
        }

        let jar_file = match self.server_type.as_str() {
            "Vanilla" => jars::get_mojang_jar(&self.server_version).await,
            "Paper" => jars::get_paper_jar(&self.server_version).await,
            _ => jars::get_paper_jar(&self.server_version).await,
        }?;

        server_path.push("server.jar");

        OpenOptions::new()
            .create(true)
            .truncate(true)
            .write(true)
            .open(&server_path)?
            .write_all(&jar_file)?;

        self.jar_path = server_path.to_string_lossy().to_string();

        Ok(())
    }

    pub fn set_eula_accepted(&self, accepted: bool) {
        let mut eula_path = self.get_server_path();
        eula_path.push("eula.txt");

        let mut eula_file = OpenOptions::new()
            .create(true)
            .write(true)
            .truncate(true)
            .open(eula_path)
            .expect("Failed to open eula.txt");

        eula_file
            .write_all(format!("eula={}", accepted).as_bytes())
            .expect("Cannot write to eula.txt");
    }

    pub fn get_eula_accepted(&self) -> Result<bool, Box<dyn std::error::Error>> {
        let mut eula_path = self.get_server_path();
        eula_path.push("eula.txt");

        if !eula_path.exists() {
            return Ok(false);
        }

        let buf: Vec<u8> = fs::read(eula_path)?;
        let eula_content: String = String::from_utf8(buf)?;

        Ok(eula_content.to_lowercase().contains("eula=true"))
    }

    pub fn read_properties_lines(&self) -> Result<Vec<String>, Box<dyn std::error::Error>> {
        let mut server_properties_path = self.get_server_path();
        server_properties_path.push("server.properties");
        if !server_properties_path.exists() {
            return Ok(Vec::new());
        }

        let server_properties_file = OpenOptions::new()
            .create(false)
            .read(true)
            .open(server_properties_path)?;

        let mut lines: Vec<String> = Vec::new();
        let mut reader = BufReader::new(server_properties_file);

        loop {
            let mut buf: Vec<u8> = Vec::new();
            match reader.read_until(b'\n', &mut buf) {
                Ok(0) => break,
                Ok(_) => {
                    let line = String::from_utf8(buf);
                    if let Ok(line) = line {
                        lines.push(line.trim_end().to_string());
                    }
                }
                Err(ref e) => {
                    if e.kind() == ErrorKind::WouldBlock {
                        break;
                    }
                    return Err("failed to read server.properties".into());
                }
            }
        }

        Ok(lines)
    }

    pub fn write_properties(&self, properties: &str) -> Result<(), Box<dyn std::error::Error>> {
        let mut server_properties_path = self.get_server_path();
        server_properties_path.push("server.properties");

        let mut server_properties_file = OpenOptions::new()
            .create(true)
            .write(true)
            .truncate(true)
            .open(server_properties_path)?;

        server_properties_file
            .write_all(properties.as_bytes())
            .expect("failed to write to server.properties");

        Ok(())
    }

    pub fn get_server_path(&self) -> std::path::PathBuf {
        let mut path = get_core_path();
        path.push("servers");
        path.push(&self.server_id);
        path
    }

    pub fn clean_server_directory(&self) -> Result<(), Box<dyn std::error::Error>> {
        let mut path = get_core_path();
        path.push("servers");
        path.push(&self.server_id);

        if path.exists() {
            fs::remove_dir_all(path)?;
        }

        Ok(())
    }

    pub fn set_backup_settings(
        &self,
        settings: &BackupSettings,
    ) -> Result<(), Box<dyn std::error::Error>> {
        {
            let mut servers = SERVERS.lock()?;
            if let Some(index) = servers.iter().position(|s| s.server_id == self.server_id) {
                let mut server = servers[index].clone();
                server.backup_settings = settings.clone();
                servers[index] = server;
            }
        }
        save_servers()?;

        Ok(())
    }

    pub fn get_jar_file_path(&self) -> PathBuf {
        if self.jar_path.is_empty() {
            // Compatibility: old mineager versions didn't have a jar_path field, so should just use what it should be instead
            let mut jar_path = self.get_server_path();
            jar_path.push("server.jar");
            PathBuf::from(jar_path)
        } else {
            PathBuf::from(&self.jar_path)
        }
    }
}

pub fn get_cloned_servers() -> Result<Vec<Server>, Box<dyn std::error::Error>> {
    let locked_servers = SERVERS.lock()?;
    Ok(locked_servers.clone())
}

pub fn get_servers_mut() -> Result<MutexGuard<'static, Vec<Server>>, Box<dyn std::error::Error>> {
    Ok(SERVERS.lock()?)
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
        storage_file
            .write_all(json.as_bytes())
            .expect("Failed to write json");
    }
}

pub fn save_servers() -> Result<(), Box<dyn std::error::Error>> {
    let servers = get_cloned_servers()?;

    let mut path = get_core_path();
    path.push(SERVER_STORAGE_FILE);

    let mut storage_file = OpenOptions::new()
        .write(true)
        .truncate(true)
        .open(path)
        .expect("Failed to open servers.json");

    let json = serde_json::to_string_pretty(&servers).expect("Failed to serialize json");
    storage_file
        .write_all(json.as_bytes())
        .expect("Failed to write json");

    update_frontend()?;

    Ok(())
}

pub fn read_servers() -> Vec<Server> {
    ensure_file();
    let mut path = get_core_path();
    path.push(SERVER_STORAGE_FILE);

    let storage_file = File::open(path).expect("Failed to open servers.json");

    serde_json::from_reader(storage_file).expect("Failed to deserialize json")
}

pub async fn create_server(
    server_name: String,
    server_type: String,
    version: String,
) -> Result<(), Box<dyn std::error::Error>> {
    // create server
    let server_id: String = uuid::Uuid::new_v4().to_string();

    // download java
    try_emit("update-create-button-text", "Downloading Java...");
    let jre_version = &get_jre_version(&version);
    let java_path = jre_version
        .download()
        .await
        .map(|result| result.to_string_lossy().into_owned())
        .unwrap_or(String::from(""));

    let mut server = Server {
        server_id,
        server_name: sanitize_name(&server_name),
        server_type: server_type.clone(), // avoid moving
        server_version: version,
        launch_args: String::from(""),
        allocated_ram: String::from("4096M"),
        java_path: java_path,
        jar_path: String::from("server.jar"), // changed later
        backups: Vec::new(),
        backup_settings: BackupSettings::default(),
    };

    // install server
    try_emit("update-create-button-text", "Installing server...");
    server.install().await?;

    // add server
    server.add()?;

    Ok(())
}

pub async fn import_server(
    server_name: String,
    archive_path: String,
) -> Result<(), Box<dyn std::error::Error>> {
    async fn get_java_from_forge_jar(filename: &str) -> Option<String> {
        if let Some(version_with_suffix) = filename.strip_prefix("forge-") {
            // now, we're looking at "minecraft_version-forge_version-universal or -server.jar"
            // should split the - one more time if exists?
            let mut split = version_with_suffix.split("-");
            if split.clone().count() > 1 {
                // - was found
                let mc_version = split.next();

                if let Some(mc_version) = mc_version {
                    // try to download java
                    try_emit("update-create-button-text", "Downloading Java...");
                    let jre_version = &get_jre_version(&mc_version);
                    let java_path = jre_version
                        .download()
                        .await
                        .map(|result| result.to_string_lossy().into_owned())
                        .unwrap_or(String::from(""));

                    return Some(java_path);
                }
            }
        }

        return None;
    }
    // make uuid
    let server_id: String = uuid::Uuid::new_v4().to_string();

    let mut server = Server {
        server_id: server_id.clone(),
        server_name: sanitize_name(&server_name),
        server_type: String::from("Archive"),
        server_version: String::from("Unknown"), // TODO: dedicate this to the modpack version
        launch_args: String::from(""),
        allocated_ram: String::from("4096M"),
        java_path: String::from(""),
        jar_path: String::from(""), // made later
        backups: Vec::new(),
        backup_settings: BackupSettings::default(),
    };

    try_emit("update-create-button-text", "Extracting archive...");
    // Install the archive
    let zip_file = File::open(&archive_path)?;
    let mut zip = ZipArchive::new(&zip_file)?;

    zip.extract_unwrapped_root_dir(server.get_server_path(), zip::read::root_dir_common_filter)?;

    // Try to detect jar file
    let mut jar_file: Option<String> = None;

    let mut libraries = server.get_server_path();
    libraries.push("libraries");

    let server_path = server.get_server_path();

    // Edge-case for modpacks without pre-installed Forge, but an installer left in the root directory
    if !libraries.exists() {
        if let Ok(entries) = std::fs::read_dir(server.get_server_path()) {
            // Find .jar
            if let Some(forge_installer_jar) = entries
                .flatten()
                .map(|file| file.path())
                .filter(|path| {
                    path.is_file()
                        && path
                            .file_name()
                            .map(|name| {
                                name.to_string_lossy()
                                    .to_string()
                                    .ends_with("-installer.jar")
                            })
                            .or(Some(false))
                            .unwrap()
                })
                .collect::<Vec<PathBuf>>()
                .first()
            {
                let jar_filename = forge_installer_jar.file_name();
                if let Some(jar_filename) = jar_filename {
                    let java_path =
                        get_java_from_forge_jar(&jar_filename.to_string_lossy().to_string()).await;

                    // run the installer with "the appropriate java version" to install forge
                    if let Some(java_path) = java_path {
                        let mut config = Command::new(java_path);

                        config
                            .current_dir(&server_path)
                            .arg("-jar")
                            .arg(&forge_installer_jar)
                            .arg("--installServer");

                        if let Ok(mut installer_child) = config.spawn() {
                            let _ = installer_child.wait();
                        }
                    }
                }
            }
        }
    }

    // Check forge .jar file location in libraries first
    let mut forge_path = server.get_server_path();
    forge_path.push("libraries/net/minecraftforge/forge");

    try_emit("update-create-button-text", "Scanning archive...");
    if forge_path.exists() {
        let children = fs::read_dir(forge_path);
        if let Ok(children) = children {
            for child in children.flatten() {
                let path = child.path();

                if path.is_dir() {
                    if let Ok(entries) = std::fs::read_dir(&path) {
                        for entry in entries.flatten() {
                            let entry_path = entry.path();

                            if entry_path.is_file()
                                && entry_path
                                    .file_name()
                                    .and_then(|name| name.to_str())
                                    .is_some_and(|name| name.ends_with(".jar"))
                            {
                                jar_file = Some(entry_path.to_string_lossy().to_string());

                                // this forge should have a minecraft version in the filename, so extract it and get the appropriate JRE version if possible
                                // TODO: should also figure out how to do this for other server types
                                let jar_filename = entry_path
                                    .file_name()
                                    .unwrap()
                                    .to_string_lossy()
                                    .to_string();

                                let java_path = get_java_from_forge_jar(&jar_filename).await;
                                if let Some(java_path) = java_path {
                                    server.java_path = java_path;
                                    break;
                                }
                            }
                        }
                    }
                }

                // skip remaining if already set
                if jar_file.is_some() {
                    break;
                }
            }
        }
    }

    // Scan main server directory for any .jar files if still missing

    // Check for GTNH lwjgl3fy forgePatches .jar
    let mut lwjgl3fy_path = server.get_server_path();
    lwjgl3fy_path.push("lwjgl3ify-forgePatches.jar");

    if lwjgl3fy_path.exists() {
        jar_file = Some(lwjgl3fy_path.to_string_lossy().to_string());

        // Server should use Java 25
        try_emit("update-create-button-text", "Downloading Java...");
        let java_path = JreVersion::Java25
            .download()
            .await
            .map(|result| result.to_string_lossy().into_owned())
            .unwrap_or(String::from(""));

        server.java_path = java_path;
    }

    // Prioritize forge if exists
    if jar_file.is_none() {
        let children = fs::read_dir(server_path);

        if let Ok(children) = children {
            let mut fallback_jar: Option<String> = None;

            for child in children.flatten() {
                let path = child.path();

                if path.is_file() {
                    if let Some(filename) = path.file_name().and_then(|name| name.to_str()) {
                        // TODO: fabric support idk probably
                        // Move forge to jar_file, and then scan other possible jars (that aren't -installer.jar) and put them in fallback_jar.
                        // When forge isn't found, switch jar_file to fallback_jar
                        if filename.starts_with("forge")
                            && !filename.ends_with("-installer.jar")
                            && !filename.ends_with("-shim.jar")
                            && filename.ends_with(".jar")
                        {
                            jar_file = Some(path.to_string_lossy().to_string());
                            break;
                        }

                        // Default fallback jar
                        if !filename.ends_with("-installer.jar")
                            && !filename.ends_with("-shim.jar")
                            && filename.ends_with(".jar")
                        {
                            fallback_jar = Some(path.to_string_lossy().to_string());
                        }
                    }
                }
            }

            // Move fallback_jar to jar_file if it isn't set
            if jar_file.is_none() {
                jar_file = fallback_jar;
            }
        }
    }

    // Check if minecraft_server.jar exists and prioritize it instead (Default .jar for many forge modpacks on like 1.12.2)
    let mut minecraft_server_jar_path = server.get_server_path();
    minecraft_server_jar_path.push("minecraft_server.jar");

    if minecraft_server_jar_path.exists() {
        jar_file = Some(minecraft_server_jar_path.to_string_lossy().to_string());
    }

    server.jar_path = jar_file.unwrap_or(String::from(""));
    // Add server
    server.add()?;

    Ok(())
}
