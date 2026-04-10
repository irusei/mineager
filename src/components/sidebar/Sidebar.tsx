import { Blocks, ChevronDown, Plus, Search } from "lucide-react";
import { FrontendServer } from "../../types/types.tsx";
import { SidebarServer } from "./SidebarServer.tsx";
import { useEffect, useState } from "react";
import Button from "../ui/Button.tsx";

export interface SidebarProps {
    servers: FrontendServer[],
    selectedServer: FrontendServer | null,
    onSelectedServer: (server: FrontendServer) => void,
    onAddServer: () => void,
}
export default function Sidebar({ servers, selectedServer, onSelectedServer, onAddServer }: SidebarProps) {
    const [filteredServers, setFilteredServers] = useState<FrontendServer[]>(servers);
    const [filterSearch, setFilterSearch] = useState<string>("");

    useEffect(() => {
        setFilteredServers(servers.filter(server =>
            server.server.server_name.toLowerCase().includes(filterSearch.toLowerCase())
        ))
    }, [filterSearch, servers])

    function handleAddServer() {
        onAddServer();
    }

    return (
        <div className="h-screen w-64 bg-bg-2 border-r border-border flex flex-col">
            <div className="p-4 border-b border-border">
                <div className="flex items-center gap-2 h-8">
                    <span className="font-semibold text-lg text-text">mineager</span>
                </div>
            </div>

            <div className="p-2 border-b border-border">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-2" />
                    <input
                        type="text"
                        className="w-full pl-9 pr-3 py-2 bg-bg-2 border border-border rounded-md
                                   text-text placeholder-text-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500/20"
                        placeholder="Search servers"
                        value={filterSearch}
                        onChange={(event) => setFilterSearch(event.target.value)}
                    />
                </div>
            </div>
            <div className={"flex"}>
                <div className={"w-full p-2 flex flex-row space-x-2 font-medium text-gray-400"}>
                    <ChevronDown/>
                    <p>Servers</p>
                </div>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-hide p-2">
                {filteredServers.map((server) => (
                    <SidebarServer
                        key={server.server.server_id}
                        server={server}
                        selected={selectedServer?.server.server_id === server.server.server_id}
                        onSelected={() => onSelectedServer(server)}
                    />
                ))}
            </div>

            <div className="p-3 border-t border-border">
                <Button onClick={handleAddServer} color="orange" className="gap-2">
                    <Plus className="w-4 h-4" />
                    <span className="text-sm">New Server</span>
                </Button>
            </div>
        </div>
    )
}