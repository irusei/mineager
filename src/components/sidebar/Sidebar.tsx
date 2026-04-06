import {Blocks, ChevronDown, Plus, Search} from "lucide-react";
import {FrontendServer} from "../../types/types.tsx";
import { SidebarServer } from "./SidebarServer.tsx";
import {useEffect, useState} from "react";
import {WebviewWindow} from "@tauri-apps/api/webviewWindow";
import Button from "../ui/Button.tsx";

export interface SidebarProps {
    servers: FrontendServer[],
    selectedServer: FrontendServer | null,
    onSelectedServer: (server: FrontendServer) => void
}
export default function Sidebar({servers, selectedServer, onSelectedServer}: SidebarProps) {
    const [filteredServers, setFilteredServers] = useState<FrontendServer[]>(servers);
    const [filterSearch, setFilterSearch] = useState<string>("");

    useEffect(() => {
        setFilteredServers(servers.filter(server => server.server.server_name.includes(filterSearch)))
    }, [filterSearch, servers])

    function addServer(event: React.MouseEvent<HTMLButtonElement>) {
        event.preventDefault()
        const webviewWindow = new WebviewWindow('add-server-window', {
            url: "/add-server",
            width: 400,
            height: 475,
            x: 0,
            center: true,
            y: 0,
            visible: false,
        });

        webviewWindow.once('tauri://webview-created', () => {
            setTimeout(() => webviewWindow.show(), 100)
        })
    }

    return (
        <div className={"h-screen min-w-75 w-75 border-r border-zinc-800 bg-neutral-900 flex flex-col"}>
            <div className={"border-b border-zinc-800 h-15"}>
                <div className={"p-4 flex flex-row space-x-2 items-center font-medium text-xl text-gray-300"}>
                    <Blocks className={"text-orange-400 "}/>
                    <p>mineager</p>
                </div>
            </div>

            {/* Servers */}
            <div className={"border-zinc-800 border-t p-3 space-y-3"}>
                <div className={"w-full flex flex-row rounded-lg text-gray-400 p-2 bg-zinc-800 gap-x-2 text-lg items-center"}>
                    <Search color={"#6a7282"} className={"ml-2 w-6 h-6 block"}/>
                    <input type={"text"} className={"focus:outline-none placeholder-gray-500"} placeholder={"Search servers..."} value={filterSearch} onChange={(event) => setFilterSearch(event.target.value)}/>
                </div>
            </div>
            <div className={"flex"}>
                <div className={"w-full p-2 flex flex-row space-x-2 font-medium text-gray-400"}>
                    <ChevronDown/>
                    <p>Servers</p>
                </div>
            </div>
            <div className={"flex flex-col py-0 h-full overflow-y-scroll scrollbar-hide"}>
                {filteredServers.map((server) => (
                    <SidebarServer key={server.server.server_id} server={server} selected={selectedServer?.server.server_id === server.server.server_id} onSelected={() => onSelectedServer(server)}/>
                ))}
            </div>

            <div className={"border-zinc-800 border-t p-3 space-y-3"}>
                <Button onClick={(event) => addServer(event)} color={"orange"}>
                    <Plus className={"w-6 h-6 block"}/>
                    <p>New Server</p>
                </Button>
            </div>
        </div>
    )
}