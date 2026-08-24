use std::{io::Cursor, path::PathBuf};

use sha2::Digest;

use crate::{
    java::{detector::JreVersion, sources},
    utils::path::get_core_path,
};

impl JreVersion {
    fn to_string(&self) -> String {
        match self {
            JreVersion::Java8 => String::from("jre8"),
            JreVersion::Java16 => String::from("java16"),
            JreVersion::Java17 => String::from("java17"),
            JreVersion::Java21 => String::from("java21"),
            JreVersion::Java25 => String::from("java25"),
        }
    }

    fn get_jre_folder_path(&self) -> PathBuf {
        let mut path = get_core_path();
        path.push("jre");
        path.push(self.to_string());

        path
    }

    pub fn get_path_to_java(&self) -> Option<PathBuf> {
        let mut folder_path = self.get_jre_folder_path();

        #[cfg(target_os = "windows")]
        folder_path.push("bin");
        #[cfg(target_os = "windows")]
        folder_path.push("java.exe");

        #[cfg(target_os = "linux")]
        folder_path.push("bin");
        #[cfg(target_os = "linux")]
        folder_path.push("java");

        if !folder_path.exists() {
            return None;
        }

        Some(folder_path)
    }

    fn match_jre_sources_download_url(&self) -> Option<&str> {
        #[cfg(target_os = "windows")]
        {
            return match self {
                JreVersion::Java8 => Some(sources::WINDOWS_JRE8_URL),
                JreVersion::Java16 => Some(sources::WINDOWS_JRE17_URL), // use jre17 for jre16, as it is backwards compatible
                JreVersion::Java17 => Some(sources::WINDOWS_JRE17_URL),
                JreVersion::Java21 => Some(sources::WINDOWS_JRE21_URL),
                JreVersion::Java25 => Some(sources::WINDOWS_JRE25_URL),
            };
        }

        #[cfg(target_os = "linux")]
        {
            return match self {
                JreVersion::Java8 => Some(sources::LINUX_JRE8_URL),
                JreVersion::Java16 => Some(sources::LINUX_JRE17_URL), // use jre17 for jre16, as it is backwards compatible
                JreVersion::Java17 => Some(sources::LINUX_JRE17_URL),
                JreVersion::Java21 => Some(sources::LINUX_JRE21_URL),
                JreVersion::Java25 => Some(sources::LINUX_JRE25_URL),
            };
        }
    }

    fn match_jre_sources_checksum(&self) -> Option<&str> {
        #[cfg(target_os = "windows")]
        {
            return match self {
                JreVersion::Java8 => Some(sources::WINDOWS_JRE8_SHA256),
                JreVersion::Java16 => Some(sources::WINDOWS_JRE17_SHA256), // use jre17 for jre16, as it is backwards compatible
                JreVersion::Java17 => Some(sources::WINDOWS_JRE17_SHA256),
                JreVersion::Java21 => Some(sources::WINDOWS_JRE21_SHA256),
                JreVersion::Java25 => Some(sources::WINDOWS_JRE25_SHA256),
            };
        }

        #[cfg(target_os = "linux")]
        {
            return match self {
                JreVersion::Java8 => Some(sources::LINUX_JRE8_SHA256),
                JreVersion::Java16 => Some(sources::LINUX_JRE17_SHA256), // use jre17 for jre16, as it is backwards compatible
                JreVersion::Java17 => Some(sources::LINUX_JRE17_SHA256),
                JreVersion::Java21 => Some(sources::LINUX_JRE21_SHA256),
                JreVersion::Java25 => Some(sources::LINUX_JRE25_SHA256),
            };
        }
    }

    pub async fn download(&self) -> Result<PathBuf, Box<dyn std::error::Error>> {
        // check if java is already downloaded
        // if it is, then point towards it
        if let Some(java_path) = self.get_path_to_java() {
            return Ok(java_path);
        }

        // get links to java
        let java_download_url = self.match_jre_sources_download_url();
        let java_download_checksum = self.match_jre_sources_checksum();

        if let Some(java_download_url) = java_download_url {
            if let Some(java_download_checksum) = java_download_checksum {
                let zip_bytes = reqwest::get(java_download_url).await?.bytes().await?;

                // verify checksum
                let mut hasher = sha2::Sha256::new();
                Digest::update(&mut hasher, &zip_bytes);

                let sha256_checksum = hex::encode(hasher.finalize());

                if !sha256_checksum.eq(java_download_checksum) {
                    return Err(format!(
                        "The provided checksum for the java doesn't match with what was downloaded."
                    )
                    .into());
                }

                // extract archive into java folder
                let java_folder = self.get_jre_folder_path();

                #[cfg(target_os = "windows")]
                {
                    use zip::ZipArchive;
                    let cursor = Cursor::new(zip_bytes);
                    let mut archive = ZipArchive::new(cursor)?;
                    archive.extract_unwrapped_root_dir(
                        &java_folder,
                        zip::read::root_dir_common_filter,
                    )?;
                }

                #[cfg(target_os = "linux")]
                {
                    std::fs::create_dir_all(&java_folder)?;
                    let cursor = Cursor::new(zip_bytes);
                    let decoder = flate2::read::GzDecoder::new(cursor);
                    let mut archive = tar::Archive::new(decoder);
                    archive.unpack(&java_folder)?;

                    // this creates an extra folder inside of the java installation, so
                    // gotta move it
                    let entries = std::fs::read_dir(&java_folder)?;
                    let folder_name = entries
                        .filter_map(Result::ok)
                        .map(|e| e.path())
                        .find(|p| p.is_dir());

                    if let Some(folder_name) = folder_name {
                        // iterate over all of the entries of the folder
                        let folder_entries = std::fs::read_dir(&folder_name)?;
                        for entry in folder_entries {
                            let entry = entry?;
                            let path = entry.path();

                            std::fs::rename(
                                &path,
                                &java_folder.join(
                                    &path
                                        .file_name()
                                        .ok_or("could not get filename of java archive file")?,
                                ),
                            )?;
                        }
                    }
                }

                return Ok(self
                    .get_path_to_java()
                    .ok_or("failed to find java binary after extraction")?);
            }
        }

        Err("could not download Java".into())
    }
}
