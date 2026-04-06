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
            // earliest server.jar is 1.2.5
            if version.manifest_type == "release" && compare_versions(&version.id, "1.2.5") >= 0 {
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

pub fn compare_versions(version1: &str, version2: &str) -> isize {
    // compares two minecraft versions,
    // returns -1 if version1 is lower
    // returns 0 if they're the same
    // returns 1 if version1 is higher

    // drop -rc, -pre, -beta
    let v1 = version1.split("-").next().unwrap();
    let v2 = version2.split("-").next().unwrap();

    if v1.eq(v2) {
        return 0
    }
    
    let mut vn1_split = v1.split(".");
    let mut vn2_split = v2.split(".");

    // loop over each element of those arrays
    // and compare the numbers
    loop {
        let segment1= vn1_split.next();
        let segment2 = vn2_split.next();

        // check if a version abruptly ends
        // (1.2 vs 1.2.1 -> the second one is longer, so obviously newer)
        if segment1.is_none() && !segment2.is_none() {
            if segment2.unwrap() == "0" {
                return 0
            }
            return -1;
        } else if !segment1.is_none() && segment2.is_none() {
            if segment1.unwrap() == "0" {
                return 0
            }
            return 1;
        }

        // convert the version numbers to usize and compare them
        let num1: usize = segment1.unwrap().parse().unwrap();
        let num2: usize = segment2.unwrap().parse().unwrap();

        if num1 > num2 {
            return 1;
        } else if num1 < num2 {
            return -1;
        }

        // continue loop if same number and then check the next one
    }
}

#[cfg(test)]
mod tests {
    use crate::minecraft::versions::compare_versions;

    #[test]
    fn test_compare_same_versions() {
        assert_eq!(compare_versions("1.2.1", "1.2.1"), 0)
    }

    #[test]
    fn test_greater_major() {
        assert_eq!(compare_versions("2.0.0", "1.9.9"), 1);
    }

    #[test]
    fn test_smaller_major() {
        assert_eq!(compare_versions("1.0.0", "2.0.0"), -1);
    }

    #[test]
    fn test_greater_minor() {
        assert_eq!(compare_versions("1.3.0", "1.2.9"), 1);
    }

    #[test]
    fn test_smaller_minor() {
        assert_eq!(compare_versions("1.2.0", "1.3.0"), -1);
    }

    #[test]
    fn test_greater_patch() {
        assert_eq!(compare_versions("1.2.5", "1.2.3"), 1);
    }

    #[test]
    fn test_smaller_patch() {
        assert_eq!(compare_versions("1.2.3", "1.2.5"), -1);
    }

    #[test]
    fn test_sub_patch_equal() {
        assert_eq!(compare_versions("1.2", "1.2.0"), 0);
    }

    #[test]
    fn test_sub_patch_greater() {
        assert_eq!(compare_versions("1.2.1", "1.2"), 1);
    }

    #[test]
    fn test_sub_patch_smaller() {
        assert_eq!(compare_versions("1.2", "1.2.1"), -1);
    }
}