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

fn default_auto_backup_interval() -> String {
    "0 0 * * * *".to_string()
}

#[derive(Deserialize, Serialize, Clone, PartialEq)]
pub(crate) struct Backup {
    pub(crate) file_name: String,
    pub(crate) server_type: String,
    pub(crate) server_version: String,
    pub(crate) size: u64,
    #[serde(default)]
    pub(crate) is_compact: bool,
}

#[derive(Default, Deserialize, Serialize, Clone)]
pub(crate) struct BackupSettings {
    #[serde(default)]
    pub(crate) auto_backups: bool,
    #[serde(default)]
    pub(crate) auto_backup_on_start: bool,
    #[serde(default = "default_auto_backup_interval")]
    pub(crate) auto_backup_interval: String, // crontab notation
    #[serde(default)]
    pub(crate) compact_backups: bool,
}

impl Server {
    pub fn ensure_backup_path(&self) -> Result<PathBuf, Box<dyn std::error::Error>> {
        let mut path = get_core_path();
        path.push("backups");
        path.push(self.server_id.clone());
        fs::create_dir_all(&path)?;
        Ok(path)
    }

    pub fn delete_backup(&mut self, backup: &Backup) -> Result<(), Box<dyn std::error::Error>> {
        let mut backup_path = self.ensure_backup_path()?;
        backup_path.push(&backup.file_name);

        if fs::exists(&backup_path)? {
            fs::remove_file(&backup_path)?;
        }

        self.backups.retain(|b| b != backup);

        Ok(())
    }

    pub async fn restore_backup(&self, backup: &Backup) -> Result<(), Box<dyn std::error::Error>> {
        if crate::manager::process::get_status(&self.server_id)? != ServerStatus::Offline {
            return Err(format!("Server is running").into());
        }

        let server_path = self.get_server_path();

        let mut backup_path = self.ensure_backup_path()?;
        backup_path.push(&backup.file_name);

        if fs::exists(&backup_path)? {
            self.clean_server_directory()?;
            fs::create_dir_all(&server_path)?;

            let zip_file = File::open(&backup_path)?;
            let mut zip = ZipArchive::new(&zip_file)?;
            zip.extract(&server_path)?;

            // reinstall the server
            self.change_server_details(&backup.server_type, &backup.server_version)
                .await?;

            return Ok(());
        }
        Err(format!("Backup doesn't exist").into())
    }

    pub fn create_backup(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        let server_path = self.get_server_path();

        let mut backup_path = self.ensure_backup_path()?;
        let file_name = SystemTime::now()
            .duration_since(UNIX_EPOCH)?
            .as_millis()
            .to_string()
            + ".zip";

        backup_path.push(&file_name);

        let new_zip_file = File::create(&backup_path)?;
        let mut zip = ZipWriter::new(new_zip_file);

        let options = FileOptions::default().compression_method(CompressionMethod::Deflated);
        let jar_path = self.get_jar_file_path();

        fn zip_dir(
            root: &std::path::Path,
            dir: &std::path::Path,
            zip: &mut ZipWriter<File>,
            jar_path: &PathBuf,
            should_skip_jar: bool,
            is_compact: bool,
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
                if &path == jar_path && (should_skip_jar || is_compact) {
                    continue;
                }

                if path.strip_prefix(root).map_or(false, |p| {
                    p.starts_with("versions") || p.starts_with("cache") || p.starts_with("backups")
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

                // Compact backup - skip root folders that aren't important
                if is_compact {
                    // Only backup folders in root directory
                    if root == dir && !metadata.is_dir() {
                        continue;
                    }

                    // Ignore irrelevant folders
                    if path.strip_prefix(root).map_or(false, |p| {
                        p.starts_with("plugins")
                            || p.starts_with("mods")
                            || p.starts_with("logs")
                            || p.starts_with("scripts")
                            || p.starts_with("libraries")
                            || p.starts_with("coretweaks")
                    }) {
                        continue;
                    }

                    // Ignore everything in config besides the JourneyMapServer folder
                    if path.strip_prefix(root).map_or(false, |p| {
                        p.starts_with("config")
                            && (p != "config" && !p.starts_with("config/JourneyMapServer"))
                    }) {
                        continue;
                    }
                }

                if metadata.is_dir() {
                    zip.add_directory(relative.to_string_lossy().into_owned(), options)?;
                    zip_dir(
                        root,
                        &path,
                        zip,
                        jar_path,
                        should_skip_jar,
                        is_compact,
                        options,
                    )?;
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

        zip_dir(
            &server_path,
            &server_path,
            &mut zip,
            &jar_path,
            self.server_type != "Archive",
            self.backup_settings.compact_backups,
            options,
        )?;

        zip.finish()?;

        // Push backup to the new list
        let size = fs::metadata(&backup_path)?.len();

        self.backups.push(Backup {
            file_name,
            server_type: self.server_type.clone(),
            server_version: self.server_version.clone(),
            size,
            is_compact: self.backup_settings.compact_backups,
        });

        Ok(())
    }
}
