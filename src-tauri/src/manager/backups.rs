use std::{
    fs::{self, File},
    io::{Read, Write},
    path::PathBuf,
    time::{SystemTime, UNIX_EPOCH},
};

use zip::{write::FileOptions, CompressionMethod, ZipArchive, ZipWriter};

use serde::{Deserialize, Serialize};

use crate::manager::{process::ServerStatus, servers::Server};
use crate::utils::path::get_core_path;

#[derive(Serialize, Deserialize)]
struct BackupMetadata {
    server_type: String,
    server_version: String,
}

#[derive(Serialize)]
pub struct BackupEntry {
    pub name: String,
    pub size: u64,
}

impl Server {
    pub fn ensure_backup_path(&self) -> Result<PathBuf, Box<dyn std::error::Error>> {
        let mut path = get_core_path();
        path.push("backups");
        path.push(self.server_id.clone());
        fs::create_dir_all(&path)?;
        Ok(path)
    }

    pub fn list_backups(&self) -> Result<Vec<BackupEntry>, Box<dyn std::error::Error>> {
        let server_backup_path = self.ensure_backup_path()?;
        let mut entries: Vec<BackupEntry> = vec![];

        for zip in fs::read_dir(&server_backup_path)? {
            let zip_path = zip?.file_name();
            let name = zip_path.to_string_lossy().to_string();
            let size = fs::metadata(server_backup_path.join(&name))?.len();
            entries.push(BackupEntry { name, size });
        }

        Ok(entries)
    }

    pub fn delete_backup(&self, backup_name: &str) -> Result<(), Box<dyn std::error::Error>> {
        let mut backup_path = self.ensure_backup_path()?;
        backup_path.push(backup_name);

        if fs::exists(&backup_path)? {
            fs::remove_file(&backup_path)?;
        }

        Ok(())
    }

    pub async fn restore_backup(
        &self,
        backup_name: &str,
    ) -> Result<(), Box<dyn std::error::Error>> {
        if crate::manager::process::get_status(&self.server_id)? != ServerStatus::Offline {
            return Err(format!("Server is running").into());
        }

        let server_path = self.get_server_path();

        let mut backup_path = self.ensure_backup_path()?;
        backup_path.push(backup_name);

        if fs::exists(&backup_path)? {
            self.clean_server_directory()?;
            fs::create_dir_all(&server_path)?;

            let zip_file = File::open(&backup_path)?;
            let mut zip = ZipArchive::new(&zip_file)?;
            zip.extract(&server_path)?;

            let mut metadata_file = server_path.clone();
            metadata_file.push("backup_metadata.json");

            if !fs::exists(&metadata_file)? {
                return Err(format!("Metadata file doesn't exist").into());
            }

            let backup_metadata_file = File::open(&metadata_file)?;
            let backup_metadata: BackupMetadata = serde_json::from_reader(backup_metadata_file)?;

            // reinstall the server
            self.change_server_details(
                &backup_metadata.server_type,
                &backup_metadata.server_version,
            )
            .await?;

            fs::remove_file(&metadata_file)?;

            return Ok(());
        }
        Err(format!("Backup doesn't exist").into())
    }

    pub fn create_backup(&self) -> Result<(), Box<dyn std::error::Error>> {
        let server_path = self.get_server_path();

        let mut backup_path = self.ensure_backup_path()?;
        backup_path.push(
            SystemTime::now()
                .duration_since(UNIX_EPOCH)?
                .as_millis()
                .to_string()
                + ".zip",
        );

        let new_zip_file = File::create(&backup_path)?;
        let mut zip = ZipWriter::new(new_zip_file);

        let options = FileOptions::default().compression_method(CompressionMethod::Deflated);
        let jar_path = self.get_jar_file_path();

        fn zip_dir(
            root: &std::path::Path,
            dir: &std::path::Path,
            zip: &mut ZipWriter<File>,
            jar_path: &PathBuf,
            options: zip::write::FileOptions<'static, ()>,
        ) -> Result<(), Box<dyn std::error::Error>> {
            let is_forge: bool = jar_path
                .file_name()
                .map(|name| name.to_string_lossy().to_string().contains("forge"))
                .unwrap_or(false);

            for entry in fs::read_dir(dir)? {
                let entry = entry?;
                let path = entry.path();
                let relative = path.strip_prefix(root).map_err(|e| e.to_string())?;

                // Skip .jar
                if &path == jar_path {
                    continue;
                }

                if path.strip_prefix(root).map_or(false, |p| {
                    p.starts_with("versions") || p.starts_with("cache")
                }) {
                    continue;
                }

                // Also skip "libraries" folder if we're not dealing with Forge
                if !is_forge
                    && path
                        .strip_prefix(root)
                        .map_or(false, |p| p.starts_with("libraries"))
                {
                    continue;
                }

                let metadata = fs::metadata(&path)?;
                if metadata.is_dir() {
                    zip.add_directory(relative.to_string_lossy().into_owned(), options)?;
                    zip_dir(root, &path, zip, jar_path, options)?;
                } else {
                    match File::open(&path) {
                        Ok(mut file) => {
                            let mut buffer = Vec::new();
                            if file.read_to_end(&mut buffer).is_ok() {
                                zip.start_file(relative.to_string_lossy().into_owned(), options)?;
                                zip.write_all(&buffer)?;
                            }
                        }
                        Err(e) => {
                            eprintln!("Skipping locked/unreadable file {}: {}", path.display(), e);
                        }
                    }
                }
            }
            Ok(())
        }

        let metadata = BackupMetadata {
            server_type: self.server_type.clone(),
            server_version: self.server_version.clone(),
        };

        let metadata_json = serde_json::to_string_pretty(&metadata)?;
        zip.start_file("backup_metadata.json", options)?;
        zip.write_all(metadata_json.as_bytes())?;

        zip_dir(&server_path, &server_path, &mut zip, &jar_path, options)?;

        zip.finish()?;
        Ok(())
    }
}
