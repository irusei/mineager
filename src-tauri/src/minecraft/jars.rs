use serde::Deserialize;
use sha2::Digest;

use crate::minecraft::versions::get_vanilla_manifest_from_version;

#[derive(Debug, Deserialize)]
struct PaperJar {
    downloads: PaperJarDownloads
}

#[derive(Debug, Deserialize)]
struct PaperJarDownloads {
    #[serde(rename = "server:default")]
    server_default: PaperServerDefaultJar
}

#[derive(Debug, Deserialize)]
struct PaperServerDefaultJar {
    checksums: PaperJarChecksums,
    url: String,
}

#[derive(Debug, Deserialize)]
struct PaperJarChecksums {
    sha256: String,
}

// mojang
#[derive(Debug, Deserialize)]
struct MojangJar {
    downloads: MojangJarDownloads
}

#[derive(Debug, Deserialize)]
struct MojangJarDownloads {
    server: MojangServerJarDownloads
}

#[derive(Debug, Deserialize)]
struct MojangServerJarDownloads {
    sha1: String,
    url: String
}

pub async fn get_paper_jar(version: &str) -> Result<bytes::Bytes, Box<dyn std::error::Error>> {
    let jars = reqwest::get("https://fill.papermc.io/v3/projects/paper/versions/".to_owned() + version + "/builds")
        .await?
        .json::<Vec<PaperJar>>()
        .await?;

    if jars.len() == 0 {
        return Err(format!("No server jars available for this version. ").into())
    }

    let latest_jar = &jars.first().unwrap().downloads.server_default;

    let jar_sha256_checksum = &latest_jar.checksums.sha256;
    let jar_url = &latest_jar.url;

    let jar_bytes = reqwest::get(jar_url).await?.bytes().await?;

    // check checksum
    let mut hasher = sha2::Sha256::new();
    Digest::update(&mut hasher, &jar_bytes);

    let sha256_checksum = hex::encode(hasher.finalize());
    
    if !sha256_checksum.eq(jar_sha256_checksum) {
        return Err(format!("The provided checksum for the jar file doesn't match with what was downloaded.").into())
    }

    Ok(jar_bytes)
}

pub async fn get_mojang_jar(version: &str) -> Result<bytes::Bytes, Box<dyn std::error::Error>> {
    let manifest_url = get_vanilla_manifest_from_version(version).await?;

    if let Some(manifest_url) = manifest_url {
        let jars = reqwest::get(manifest_url)
            .await?
            .json::<MojangJar>()
            .await?;

        let server_jar_downloads = jars.downloads.server;

        // download jar
        let server_jar_bytes = reqwest::get(server_jar_downloads.url).await?.bytes().await?;

        // check checksum
        let mut hasher = sha1::Sha1::new();
        Digest::update(&mut hasher, &server_jar_bytes);

        let sha1_checksum = hex::encode(hasher.finalize());

        if !sha1_checksum.eq(&server_jar_downloads.sha1) {
            return Err(format!("The provided checksum for the jar file doesn't match with what was downloaded.").into())
        }

        Ok(server_jar_bytes)
    } else {
        Err(format!("Could not find manifest for version {}", version).into())
    }
}