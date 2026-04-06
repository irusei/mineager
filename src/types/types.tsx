export type ServerType = "Vanilla" | "Paper";

interface MinecraftServer {
    server_id: string,
    server_name: string,
    server_type: ServerType,
    server_version: string,

    java_path: string,
    allocated_ram: string,
    launch_args: string,
}

export interface FrontendServer {
    server: MinecraftServer;

    status: "Online" | "Offline"
}