use std::fs::{self, File};

use serde::{Deserialize, Serialize};

use crate::manager::{process::{self, ServerStatus}, servers::Server};

#[derive(Serialize, Deserialize, Clone)]
pub struct WhitelistEntry {
    pub uuid: String,
    pub name: String
}

impl Server {
    pub fn read_whitelist(&self) -> Result<Vec<WhitelistEntry>, Box<dyn std::error::Error>> {
        let mut whitelist_path = self.get_server_path();
        whitelist_path.push("whitelist.json");

        if !fs::exists(&whitelist_path)? {
            return Ok(vec![]);
        }

        let file = File::open(&whitelist_path)?;
        
        let serialized: Vec<WhitelistEntry> = serde_json::from_reader(file)?;
        Ok(serialized)
    }

    pub async fn add_whitelist_entry(&self, username: &str) -> Result<(), Box<dyn std::error::Error>> {
        let mut whitelist_path = self.get_server_path();
        whitelist_path.push("whitelist.json");
        
        // run /whitelist add if server is already running
        if process::get_status(&self.server_id) == ServerStatus::Online {
            process::write_stdin(&self.server_id, &format!("/whitelist add {}", username));
            return Ok(());
        }

        // create whitelist entry
        let uuid_raw = minecraft_uuid::get_uuid_by_username(username).await?;
        let uuid = format!("{}-{}-{}-{}-{}", &uuid_raw[0..8], &uuid_raw[8..12], &uuid_raw[12..16], &uuid_raw[16..20], &uuid_raw[20..32]);
        let entry = WhitelistEntry { uuid, name: username.to_owned() };
        
        // create new file if it doesn't exist
        if !fs::exists(&whitelist_path)? {
            let content = serde_json::to_string(&vec![entry])?;

            std::fs::write(&whitelist_path, content)?;
            
            return Ok(());
        }

        // append to existing
        let mut entries = self.read_whitelist()?;
        // check if user exists already
        if entries.iter().any(|e| e.name == entry.name || e.uuid == entry.uuid) {
            return Ok(());
        }

        entries.push(entry);

        let content = serde_json::to_string(&entries)?;

        std::fs::write(&whitelist_path, content)?;

        Ok(())
    }

    pub fn remove_whitelist_entry(&self, entry: &WhitelistEntry) -> Result<(), Box<dyn std::error::Error>> {
        let mut whitelist_path = self.get_server_path();
        whitelist_path.push("whitelist.json");
        
        // run /whitelist remove if server is already running
        if process::get_status(&self.server_id) == ServerStatus::Online {
            process::write_stdin(&self.server_id, &format!("/whitelist remove {}", entry.name));
            return Ok(());
        }

        // if file doesn't exist, user isn't in the whitelist
        if !fs::exists(&whitelist_path)? {
            return Ok(())
        }

        // remove from existing     
        let mut entries = self.read_whitelist()?;
        entries = entries.iter().filter(|e| e.name != entry.name && e.uuid != entry.uuid).cloned().collect();

        let content = serde_json::to_string(&entries)?;

        std::fs::write(&whitelist_path, content)?;

        Ok(())
    }

    pub fn set_whitelist_enabled(&self, enabled: bool) -> Result<(), Box<dyn std::error::Error>> {
        // run command if server is online
        if process::get_status(&self.server_id) == ServerStatus::Online {
            if enabled {
                process::write_stdin(&self.server_id, "/whitelist on");
            } else {
                process::write_stdin(&self.server_id, "/whitelist off");
            }
        }

        // update server.properties
        let lines = self.read_properties_lines()?;
        let mut updated: Vec<String> = Vec::new();
        let mut found = false;

        for line in lines {
            if line.starts_with("white-list=") {
                updated.push(format!("white-list={}", enabled));
                found = true;
            } else {
                updated.push(line);
            }
        }

        if !found {
            updated.push(format!("white-list={}", enabled));
        }

        self.write_properties(&updated.join("\n"));

        Ok(())
    }

    pub fn is_whitelist_enabled(&self) -> bool {
        let lines = match self.read_properties_lines() {
            Ok(l) => l,
            Err(_) => return false,
        };

        for line in lines {
            if let Some(value) = line.strip_prefix("white-list=") {
                return value == "true";
            }
        }

        false
    }
}
