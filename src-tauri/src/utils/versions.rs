use std::collections::HashMap;
use serde::Deserialize;

pub const PAPER_VERSION_API: &str = "https://fill.papermc.io/v3/projects/paper";
pub const MOJANG_MANIFEST: &str = "https://launchermeta.mojang.com/mc/game/version_manifest.json";

#[derive(Deserialize)]
struct PaperVersions {
    versions: HashMap<String, Vec<String>>
}

#[derive(Deserialize)]
struct MojangManifest {
    id: String,
    #[serde(rename = "type")]
    manifest_type: String,
    url: String,
}

#[derive(Deserialize)]
struct MojangVersions {
    versions: Vec<MojangManifest>
}


pub async fn get_paper_versions() -> Result<Vec<String>, reqwest::Error> {
    // fetch paper versions from papermc.io
    let body = reqwest::get(PAPER_VERSION_API)
        .await?
        .json::<PaperVersions>()
        .await?;

    let mut versions = Vec::new();
    for paper_versions in body.versions.values() {
        for version in paper_versions {
            versions.push(version.to_string());
        }
    }

    Ok(versions)
}

pub async fn get_vanilla_versions() -> Result<Vec<String>, reqwest::Error> {
    // fetch mojang manifest
    let body = reqwest::get(MOJANG_MANIFEST)
        .await?
        .json::<MojangVersions>()
        .await?;    

    Ok(
        body.versions.iter().filter_map(|version| {
            // it would be EASIER if I made a function that compares versions but I really don't want to so
            // earliest server.jar is 1.2.5
            if version.manifest_type == "release" && (version.id != "1.0" && version.id != "1.1" && version.id != "1.2.1" && version.id != "1.2.2" && version.id != "1.2.3" && version.id != "1.2.4") {
                Some(version.id.to_string())
            } else {
                None
            }
        }).collect::<Vec<String>>()
    )
}

pub async fn get_vanilla_manifest_from_version(version: &str) -> Result<Option<String>, Box<dyn std::error::Error>> {
    // fetch mojang manifest
    let body = reqwest::get(MOJANG_MANIFEST)
        .await?
        .json::<MojangVersions>()
        .await?;    

    if let Some(version) = body.versions.iter().find(|v| v.id == version) {
        Ok(Some(version.url.clone()))
    } else {
        Ok(None)
    }
}