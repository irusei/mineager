use std::{
    fs::{self, File},
    io::{Read, Write},
    path::PathBuf,
    time::{SystemTime, UNIX_EPOCH},
};

use zip::{CompressionMethod, ZipArchive, ZipWriter, write::FileOptions};

use serde::{Deserialize, Serialize};

use crate::{manager::{process::{self, ServerStatus}, servers::Server}, utils::path::get_core_path};

#[derive(Serialize, Deserialize)]
struct BackupMetadata {
    server_type: String,
    server_version: String,
}

pub fn ensure_backup_path(server: &Server) -> PathBuf {
    let mut path = get_core_path();
    path.push("backups");
    path.push(server.server_name.clone());
    fs::create_dir_all(&path).unwrap();
    path
}

#[derive(Serialize)]
pub struct BackupEntry {
    pub name: String,
    pub size: u64,
}

pub fn list_backups(server: &Server) -> Vec<BackupEntry> {
    let server_backup_path = ensure_backup_path(server);
    let mut entries: Vec<BackupEntry> = vec![];

    for zip in fs::read_dir(&server_backup_path).unwrap() {
        let zip = zip.unwrap();
        let zip_path = zip.file_name();
        let name = zip_path.into_string().unwrap();
        let size = fs::metadata(server_backup_path.join(&name)).unwrap().len();
        entries.push(BackupEntry { name, size });
    }

    entries
}

pub fn delete_backup(server: &Server, backup_name: &str) -> Result<(), Box<dyn std::error::Error>> {
    let mut backup_path = ensure_backup_path(&server);
    backup_path.push(backup_name);

    if fs::exists(&backup_path)? {
        fs::remove_file(&backup_path)?;
    }

    Ok(())
}

pub async fn restore_backup(server: &Server, backup_name: &str) -> Result<(), Box<dyn std::error::Error>> {
    if process::get_status(&server.server_id) != ServerStatus::Offline {
        return Err(format!("Server is running").into());
    }
    
    let server_path = server.get_server_path();

    // check if backup exists
    let mut backup_path = ensure_backup_path(&server);
    backup_path.push(backup_name);

    if fs::exists(&backup_path)? {
        // clear contents of server and make a new directory
        server.clean_server_directory();
        fs::create_dir_all(&server_path)?;

        // extract the zip file into the new directory
        let zip_file = File::open(backup_path)?;
        let mut zip = ZipArchive::new(&zip_file)?;

        zip.extract(&server_path)?;
        
        // read metadata
        let mut metadata_file = server_path.clone();
        metadata_file.push("backup_metadata.json");

        if !fs::exists(&metadata_file)? {
            return Err(format!("Metadata file doesn't exist").into());
        }

        let backup_metadata_file = File::open(&metadata_file)?;
        let backup_metadata: BackupMetadata = serde_json::from_reader(backup_metadata_file)?;
        
        server.change_server_details(&backup_metadata.server_type, &backup_metadata.server_version).await;
        
        fs::remove_file(&metadata_file)?;

        return Ok(());
    }
    return Err(format!("Backup doesn't exist").into());
}

pub fn create_backup(server: &Server) -> Result<(), Box<dyn std::error::Error>> {
    let server_path = server.get_server_path();

    let mut backup_path = ensure_backup_path(&server);
    backup_path.push(SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis().to_string() + ".zip");

    let new_zip_file = File::create(&backup_path)?;
    let mut zip = ZipWriter::new(new_zip_file);

    let options = FileOptions::default().compression_method(CompressionMethod::Deflated);

    fn zip_dir(
        root: &std::path::Path,
        dir: &std::path::Path,
        zip: &mut ZipWriter<File>,
        options: zip::write::FileOptions<'static, ()>,
    ) -> Result<(), Box<dyn std::error::Error>> {
        for entry in fs::read_dir(dir)? {
            let entry = entry?;
            let path = entry.path();
            let relative = path.strip_prefix(root).map_err(|e| e.to_string())?;

            if let Some(name) = path.file_name() {
                let name_str = name.to_string_lossy();
                    if name_str == "server.jar" {
                        continue;
                    }
                    if path.strip_prefix(root).map_or(false, |p| p.starts_with("libraries") || p.starts_with("versions")) {
                        continue;
                }
            }

            let metadata = fs::metadata(&path)?;
            if metadata.is_dir() {
                zip.add_directory(relative.to_string_lossy().into_owned(), options)?;
                zip_dir(root, &path, zip, options)?;
            } else {
                let mut file = File::open(&path)?;
                let mut buffer = Vec::new();
                file.read_to_end(&mut buffer)?;
                zip.start_file(relative.to_string_lossy().into_owned(), options)?;
                zip.write_all(&buffer)?;
            }
        }
        Ok(())
    }

    // Add backup metadata
    let metadata = BackupMetadata {
        server_type: server.server_type.clone(),
        server_version: server.server_version.clone(),
    };

    let metadata_json = serde_json::to_string_pretty(&metadata)?;
    zip.start_file("backup_metadata.json", options)?;
    zip.write_all(metadata_json.as_bytes())?;

    zip_dir(&server_path, &server_path, &mut zip, options)?;

    zip.finish()?;
    Ok(())
}