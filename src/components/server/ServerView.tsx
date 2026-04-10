import {FrontendServer} from "../../types/types.tsx";
import {useState} from "react";
import {ServerConsole} from "./tabs/ServerConsole.tsx";
import { ServerSettings } from "./tabs/ServerSettings.tsx";
import { invoke } from "@tauri-apps/api/core";
import { ServerProperties } from "./tabs/ServerProperties.tsx";

export type Tab = "Console" | "Settings" | "Properties";

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

    return (
        <div className="flex flex-col min-h-full flex-1 bg-bg-1">
            <div className="bg-bg-2 border-b border-border p-4 flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <h1 className="text-2xl font-semibold text-text">{server.server.server_name}</h1>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium
                                     ${server.status === "Online" ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                        {server.status}
                    </span>
                </div>
            </div>

            <div className="bg-bg-2 border-b border-border flex gap-2 p-2.5">
                {(["Console", "Settings", "Properties"] as Tab[]).map((tabName) => (
                    <button
                        key={tabName}
                        onClick={() => setTab(tabName)}
                        className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors duration-150 border
                                   ${tab === tabName
                                     ? 'bg-orange-500/10 text-orange-400 border-orange-500/20 hover:bg-orange-500/200'
                                     : 'text-gray-400 border-transparent hover:border-border-2 hover:bg-border'}`}
                    >
                        {tabName}
                    </button>
                ))}
            </div>

            <div className="flex-1">
                {tab === "Console" && <ServerConsole server={server} startServer={startServer} stopServer={stopServer} />}
                {tab === "Settings" && <ServerSettings server={server}/>}
                {tab === "Properties" && <ServerProperties server={server}/>}
            </div>
        </div>
    )
}