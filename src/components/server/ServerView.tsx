import {MinecraftServer} from "../../types/types.tsx";
import {useState} from "react";
import {ServerConsole} from "./tabs/ServerConsole.tsx";
import { ServerSettings } from "./tabs/ServerSettings.tsx";
import Button from "../ui/Button.tsx";
import { invoke } from "@tauri-apps/api/core";
import { ServerTabView } from "./ServerTabView.tsx";
import { ChevronDown } from "lucide-react";
import { ServerProperties } from "./tabs/ServerProperties.tsx";

export type Tab = "Console" | "Settings" | "Properties";

interface ServerViewProps {
    server: MinecraftServer
}

export default function ServerView({ server }: ServerViewProps) {
    const [tab, setTab] = useState<Tab>("Console");
    const [tabVisible, setTabVisible] = useState<boolean>(false);

    async function startServer() {  
        if (server.java_path === "")
            return alert("Please configure the Java path in settings!")

        if (server.status === "Online")
            return

        await invoke("start_server", { serverId: server.server_id })
    }

    async function stopServer() {
        await invoke("write_stdin", { serverId: server.server_id, string: "stop"})
    }

    return (
        <div className={"flex flex-col min-h-full w-full bg-neutral-900"}>
            <div className={"items-center px-3 flex flex-row w-full h-16.5 border-zinc-800 border-b justify-between"}>
                <div className={"flex flex-row space-x-2 items-center"}>
                    <p className={"text-xl text-gray-300 font-medium"}>{server.server_name}</p>
                    <p className={"text-zinc-600 text-md"}>{server.server_version}</p>
                </div>
                <div>
                    <Button onClick={() => setTabVisible((tv) => !tv)} className={"px-2"} color={"orange"}>
                        <ChevronDown/>
                        <p>Controls</p>
                    </Button>
                </div>
            </div>
            <div className={"relative h-full"}>
                <ServerTabView startServer={startServer} stopServer={stopServer} visible={tabVisible} tab={tab} setTab={setTab}/>
                {tab === "Console" && <ServerConsole server={server}/>}
                {tab === "Settings" && <ServerSettings server={server}/>}
                {tab === "Properties" && <ServerProperties server={server}/>}
            </div>
        </div>
    )
}


// <div className={"flex flex-row items-center space-x-2"}>
//     <div className={`rounded-xl w-2 h-2 bg-red ${getStatusColor(server.status)}`}></div>
//     <p className={"text-gray-400"}>{server.status}</p>
//     {server.status != "Offline" && <>
//     <div className={"flex flex-row items-center space-x-2"}>
//         <User color={"#99a1af"} className={"w-4 h-4"}/>
//         <p className={"text-gray-400"}>{players} online</p>
//     </div>
//     <div className={"flex flex-row items-center space-x-2"}>
//         <MemoryStick color={"#99a1af"} className={"w-4 h-4"}/>
//         <p className={"text-gray-400"}>{ram / 1024}MB</p>
//     </div>
//     </>}
// </div>