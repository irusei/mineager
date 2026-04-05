use std::{fs, io::Cursor, path::PathBuf};

use sha2::Digest;
use zip::ZipArchive;

use crate::utils::{java::{detector::JreVersion, sources}, path::get_core_path};

// TODO: linux support

pub fn jre_stringify(jre: &JreVersion) -> String {
    match jre {
        JreVersion::Java8 => String::from("jre8"),
        JreVersion::Java16 => String::from("java16"),
        JreVersion::Java17 => String::from("java17"),
        JreVersion::Java21 => String::from("java21"),
        JreVersion::Java25 => String::from("java25")
    }
}

// CAN RETURN A NON EXISTENT PATH
pub fn get_jre_folder_path(jre: &JreVersion) -> PathBuf {
    let mut path = get_core_path();
    path.push("jre");
    path.push(jre_stringify(jre));

    path
}

pub fn get_path_to_java(jre: &JreVersion) -> Option<PathBuf> {
    let mut folder_path = get_jre_folder_path(jre);

    folder_path.push("bin");
    folder_path.push("java.exe");

    if !fs::exists(&folder_path).unwrap() {
        return None;
    }

    return Some(folder_path);
}

pub fn match_jre_sources_download_url(jre: &JreVersion) -> Option<&str> {
    if !cfg!(target_os = "windows") {
        return None
    }
    
    match jre {
        JreVersion::Java8 => Some(sources::WINDOWS_JRE8_URL),
        JreVersion::Java16 => None,
        JreVersion::Java17 => Some(sources::WINDOWS_JRE17_URL),
        JreVersion::Java21 => Some(sources::WINDOWS_JRE21_URL),
        JreVersion::Java25 => Some(sources::WINDOWS_JRE25_URL)
    }
}

pub fn match_jre_sources_checksum(jre: &JreVersion) -> Option<&str> {
    if !cfg!(target_os = "windows") {
        return None
    }
    
    match jre {
        JreVersion::Java8 => Some(sources::WINDOWS_JRE8_SHA256),
        JreVersion::Java16 => None,
        JreVersion::Java17 => Some(sources::WINDOWS_JRE17_SHA256),
        JreVersion::Java21 => Some(sources::WINDOWS_JRE21_SHA256),
        JreVersion::Java25 => Some(sources::WINDOWS_JRE25_SHA256)
    }
}

pub async fn download_java(jre: &JreVersion) -> Result<PathBuf, Box<dyn std::error::Error>> {
    // check if java is already downloaded
    // if it is, then point towards it
    if let Some(java_path) = get_path_to_java(jre) {
        return Ok(java_path);
    }

    // pre-checks
    if !cfg!(target_os = "windows") {
        return Err(format!("unable to install Java on your platform").into());
    }

    if jre.eq(&JreVersion::Java16) {
        return Err(format!("missing downloads for Java16, please configure manually").into());
    }

    // get links to java
    let java_download_url = match_jre_sources_download_url(jre).unwrap();
    let java_download_checksum = match_jre_sources_checksum(jre).unwrap();

    let zip_bytes = reqwest::get(java_download_url).await?.bytes().await?;

    // verify checksum
    let mut hasher = sha2::Sha256::new();
    Digest::update(&mut hasher, &zip_bytes);

    let sha256_checksum = hex::encode(hasher.finalize());
    
    if !sha256_checksum.eq(java_download_checksum) {
        return Err(format!("The provided checksum for the java doesn't match with what was downloaded.").into())
    }

    // extract zip from bytes into java folder
    let mut java_folder = get_jre_folder_path(jre);
    let cursor = Cursor::new(zip_bytes);
    let mut archive = ZipArchive::new(cursor).unwrap();
    
    // extract to folder
    archive.extract_unwrapped_root_dir(&java_folder, zip::read::root_dir_common_filter)?;

    java_folder.push("bin");
    java_folder.push("java.exe");

    Ok(java_folder)

}