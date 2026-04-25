export type ServerType = "Vanilla" | "Paper";

interface MinecraftServer {
    server_id: string,
    server_name: string,
    server_type: ServerType,
    server_version: string,

    java_path: string,
    allocated_ram: string,
    launch_args: string,
    auto_backups: boolean,
    auto_backup_on_start: boolean,
    auto_backup_interval: string,
}

export interface FrontendServer {
    server: MinecraftServer;

    status: "Online" | "Offline"
}

