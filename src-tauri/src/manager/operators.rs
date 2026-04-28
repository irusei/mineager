use std::{fs::{self, File}};

use serde::{Deserialize, Serialize};

use crate::manager::{process::{self, ServerStatus}, servers::Server};

#[derive(Serialize, Deserialize, Clone)]
pub struct OperatorEntry {
    pub uuid: String,
    pub name: String,
    pub level: u32, 
    #[serde(rename = "bypassesPlayerLimit")]
    pub bypasses_player_limit: bool
}

impl Server {
    pub fn read_operators(&self) -> Result<Vec<OperatorEntry>, Box<dyn std::error::Error>> {
        let mut operator_path = self.get_server_path();
        operator_path.push("ops.json");

        if !fs::exists(&operator_path)? {
            return Ok(vec![]);
        }

        let file = File::open(&operator_path)?;
        
        let serialized: Vec<OperatorEntry> = serde_json::from_reader(file)?;
        Ok(serialized)
    }

    pub async fn add_operator(&self, username: &str) -> Result<(), Box<dyn std::error::Error>> {
        let mut operator_path = self.get_server_path();
        operator_path.push("ops.json");
        
        // run /op if server is already running
        if process::get_status(&self.server_id) == ServerStatus::Online {
            process::write_stdin(&self.server_id, &format!("/op {}", username));
            return Ok(());
        }

        // create operator entry
        let uuid_raw = minecraft_uuid::get_uuid_by_username(username).await?;
        let uuid = format!("{}-{}-{}-{}-{}", &uuid_raw[0..8], &uuid_raw[8..12], &uuid_raw[12..16], &uuid_raw[16..20], &uuid_raw[20..32]);
        let entry = OperatorEntry { uuid, name: username.to_owned(), level: 4, bypasses_player_limit: true };
        
        // create new file if it doesn't exist
        if !fs::exists(&operator_path)? {
            let content = serde_json::to_string(&vec![entry])?;

            std::fs::write(&operator_path, content)?;
            
            return Ok(());
        }

        // append to existing
        let mut entries = self.read_operators()?;
        // check if user exists already
        if entries.iter().any(|e| e.name == entry.name || e.uuid == entry.uuid) {
            return Ok(());
        }

        entries.push(entry);

        let content = serde_json::to_string(&entries)?;

        std::fs::write(&operator_path, content)?;

        Ok(())
    }

    pub fn remove_operator(&self, entry: &OperatorEntry) -> Result<(), Box<dyn std::error::Error>> {
        let mut operator_path = self.get_server_path();
        operator_path.push("ops.json");
        
        // run /deop if server is already running
        if process::get_status(&self.server_id) == ServerStatus::Online {
            process::write_stdin(&self.server_id, &format!("/deop {}", entry.name));
            return Ok(());
        }

        // if file doesn't exist, user isn't opped
        if !fs::exists(&operator_path)? {
            return Ok(())
        }

        // remove from existing     
        let mut entries = self.read_operators()?;
        entries = entries.iter().filter(|e| e.name != entry.name && e.uuid != entry.uuid).cloned().collect();

        let content = serde_json::to_string(&entries)?;

        std::fs::write(&operator_path, content)?;

        Ok(())
    }
}