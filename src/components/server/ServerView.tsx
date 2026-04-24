import {FrontendServer} from "../../types/types.tsx";
import {useState} from "react";
import {ServerConsole} from "./tabs/ServerConsole.tsx";
import { ServerSettings } from "./tabs/ServerSettings.tsx";
import { invoke } from "@tauri-apps/api/core";
import { ServerProperties } from "./tabs/ServerProperties.tsx";
import { ServerBackups } from "./tabs/ServerBackups.tsx";
import { FolderOpen } from "lucide-react";

export type Tab = "Console" | "Settings" | "Properties" | "Backups";

interface ServerViewProps {
    server: FrontendServer
}

export default function ServerView({ server }: ServerViewProps) {
    const [tab, setTab] = useState<Tab>("Console");

    async function startServer() {
        if (server.server.java_path === "")
            return alert("Please configure the Java path in settings!")

        if (server.status === "Online")
            return

        await invoke("start_server", { serverId: server.server.server_id })
    }

    async function stopServer() {
        await invoke("write_stdin", { serverId: server.server.server_id, string: "stop"})
    }

    async function openFolder() {
        await invoke("open_server_folder", { serverId: server.server.server_id })
    }

    return (
        <div className="flex flex-col min-h-full flex-1 bg-bg-1">
            <div className="bg-bg-2 border-b border-border p-4 flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 mt-1 rounded-full ${server.status === "Online" ? 'bg-green' : 'bg-red'}`} />
                    <span className="text-2xl font-semibold text-text">{server.server.server_name}</span>
                </div>
                <button onClick={openFolder} className="text-overlay1 hover:text-text transition-colors duration-150">
                    <FolderOpen className="w-4 h-4" />
                </button>
            </div>

            <div className="bg-bg-2 border-b border-border">
                <div className="flex gap-6 px-4 py-3 min-h-13.5 ">
                    {(["Console", "Settings", "Properties", "Backups"] as Tab[]).map((tabName) => (
                        <button
                            key={tabName}
                            onClick={() => setTab(tabName)}
                            className={`text-sm font-medium transition-all
                                       pb-1 -mb-px border-b
                                       ${tab === tabName
                                         ? 'text-mauve border-mauve'
                                         : 'text-overlay1 border-transparent hover:text-text hover:border-overlay1'}`}>
                            {tabName}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex-1">
                {tab === "Console" && <ServerConsole server={server} startServer={startServer} stopServer={stopServer} />}
                {tab === "Settings" && <ServerSettings server={server}/>}
                {tab === "Properties" && <ServerProperties server={server}/>}
                {tab === "Backups" && <ServerBackups server={server}/>}
            </div>
        </div>
    )
}