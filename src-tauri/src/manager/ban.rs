use std::fs::{self, File};

use serde::{Deserialize, Serialize};

use crate::manager::{process::{self, ServerStatus}, servers::Server};

fn default_reason() -> String {
    "No reason specified".to_string()
}

#[derive(Serialize, Deserialize, Clone)]
pub struct BanEntry {
    pub uuid: String,
    pub name: String,
    pub created: String,
    pub source: String,
    pub expires: String,
    #[serde(default = "default_reason")]
    pub reason: String
}

#[derive(Serialize, Deserialize, Clone)]
pub struct IpBanEntry {
    pub ip: String,
    pub created: String,
    pub source: String,
    pub expires: String,
    #[serde(default = "default_reason")]
    pub reason: String
}


impl Server {
    pub fn read_banned_players(&self) -> Result<Vec<BanEntry>, Box<dyn std::error::Error>> {
        let mut banned_players_path = self.get_server_path();
        banned_players_path.push("banned-players.json");

        if !fs::exists(&banned_players_path)? {
            return Ok(vec![]);
        }

        let file = File::open(&banned_players_path)?;
        
        let serialized: Vec<BanEntry> = serde_json::from_reader(file)?;
        Ok(serialized)
    }

    pub fn read_banned_ips(&self) -> Result<Vec<IpBanEntry>, Box<dyn std::error::Error>> {
        let mut banned_ips_path = self.get_server_path();
        banned_ips_path.push("banned-ips.json");

        if !fs::exists(&banned_ips_path)? {
            return Ok(vec![]);
        }

        let file = File::open(&banned_ips_path)?;
        
        let serialized: Vec<IpBanEntry> = serde_json::from_reader(file)?;
        Ok(serialized)
    }

    pub async fn ban_player(&self, username: &str, reason: &str) -> Result<(), Box<dyn std::error::Error>> {
        let mut banned_player_path: std::path::PathBuf = self.get_server_path();
        banned_player_path.push("banned-players.json");
        
        // run /ban if server is already running
        if process::get_status(&self.server_id) == ServerStatus::Online {
            if reason == "" {
                process::write_stdin(&self.server_id, &format!("/ban {}", username));
            } else {
                process::write_stdin(&self.server_id, &format!("/ban {} {}", username, reason));
            }
            return Ok(());
        }

        // create entry
        // hardcoded created variable, doesn't really matter for now
        let uuid_raw = minecraft_uuid::get_uuid_by_username(username).await?;
        let uuid = format!("{}-{}-{}-{}-{}", &uuid_raw[0..8], &uuid_raw[8..12], &uuid_raw[12..16], &uuid_raw[16..20], &uuid_raw[20..32]);
        let entry = BanEntry { uuid, name: username.to_owned(), reason: reason.to_owned(), created: String::from("2020-03-04 20:19:19 +0100"), source: String::from("Server"), expires: String::from("forever") };
        
        // create new file if it doesn't exist
        if !fs::exists(&banned_player_path)? {
            let content = serde_json::to_string(&vec![entry])?;

            std::fs::write(&banned_player_path, content)?;
            
            return Ok(());
        }

        // append to existing
        let mut entries = self.read_banned_players()?;
        // check if user exists already
        if entries.iter().any(|e| e.name == entry.name || e.uuid == entry.uuid) {
            return Ok(());
        }

        entries.push(entry);

        let content = serde_json::to_string(&entries)?;

        std::fs::write(&banned_player_path, content)?;

        Ok(())
    }

    pub async fn ban_ip(&self, ip: &str, reason: &str) -> Result<(), Box<dyn std::error::Error>> {
        let mut banned_ips_path: std::path::PathBuf = self.get_server_path();
        banned_ips_path.push("banned-ips.json");
        
        // run /ban-ip if server is already running
        if process::get_status(&self.server_id) == ServerStatus::Online {
            if reason == "" {
                process::write_stdin(&self.server_id, &format!("/ban-ip {}", ip));
            } else {
                process::write_stdin(&self.server_id, &format!("/ban-ip {} {}", ip, reason));
            }
            return Ok(());
        }

        // create entry
        // hardcoded created variable, doesn't really matter for now
        let entry = IpBanEntry { ip: ip.to_owned(), reason: reason.to_owned(), created: String::from("2020-03-04 20:19:19 +0100"), source: String::from("Server"), expires: String::from("forever") };
        
        // create new file if it doesn't exist
        if !fs::exists(&banned_ips_path)? {
            let content = serde_json::to_string(&vec![entry])?;

            std::fs::write(&banned_ips_path, content)?;
            
            return Ok(());
        }

        // append to existing
        let mut entries = self.read_banned_ips()?;
        // check if user exists already
        if entries.iter().any(|e| e.ip == entry.ip) {
            return Ok(());
        }

        entries.push(entry);

        let content = serde_json::to_string(&entries)?;

        std::fs::write(&banned_ips_path, content)?;

        Ok(())
    }

    pub fn unban_player(&self, entry: BanEntry) -> Result<(), Box<dyn std::error::Error>> {
        let mut banned_player_path: std::path::PathBuf = self.get_server_path();
        banned_player_path.push("banned-players.json");
        
        // run /pardon if server is already running
        if process::get_status(&self.server_id) == ServerStatus::Online {
            process::write_stdin(&self.server_id, &format!("/pardon {}", entry.uuid)); // this apparently works?
            process::write_stdin(&self.server_id, &format!("/pardon {}", entry.name));
            return Ok(());
        }

        // if file doesn't exist, user isn't in the ban list
        if !fs::exists(&banned_player_path)? {
            return Ok(())
        }

        // remove from existing     
        let mut entries = self.read_banned_players()?;
        entries = entries.iter().filter(|e| e.name != entry.name && e.uuid != entry.uuid).cloned().collect();

        let content = serde_json::to_string(&entries)?;

        std::fs::write(&banned_player_path, content)?;

        Ok(())
    }

    pub fn unban_ip(&self, entry: IpBanEntry) -> Result<(), Box<dyn std::error::Error>> {
        let mut banned_ips_path: std::path::PathBuf = self.get_server_path();
        banned_ips_path.push("banned-ips.json");
        
        // run /pardon-ip if server is already running
        if process::get_status(&self.server_id) == ServerStatus::Online {
            process::write_stdin(&self.server_id, &format!("/pardon-ip {}", entry.ip));
            return Ok(());
        }

        // if file doesn't exist, user isn't in the ban list
        if !fs::exists(&banned_ips_path)? {
            return Ok(())
        }

        // remove from existing     
        let mut entries = self.read_banned_ips()?;
        entries = entries.iter().filter(|e| e.ip != entry.ip).cloned().collect();

        let content = serde_json::to_string(&entries)?;

        std::fs::write(&banned_ips_path, content)?;

        Ok(())
    }
}
