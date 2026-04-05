import "./style/App.css";
import Sidebar from "./components/sidebar/Sidebar.tsx";
import {MinecraftServer} from "./types/types.tsx";
import {useEffect, useState} from "react";
import ServerView from "./components/server/ServerView.tsx";
import {invoke} from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useInterval } from "usehooks-ts";

function App() {
    const [selectedServer, setSelectedServer] = useState<MinecraftServer | null>(null);
    const [servers, setServers] = useState<MinecraftServer[]>([]);

    useEffect(() => {
        listen('update-local-servers', (event) => {
            let localServers: MinecraftServer[] = event.payload as MinecraftServer[];
            setServers(localServers);
        });
        listen('alert', (event) => {
            console.log(event.payload);
            alert(event.payload as string);
        })
        invoke("init_window_properties");
    }, []);

    // update selected server when info about it changes
    useEffect(() => {
        if (!selectedServer) return;
        for (const newServer of servers) {
            if (newServer.server_id === selectedServer.server_id)
                setSelectedServer(newServer)
        }
    }, [servers])
    
    // request server update every second
    useInterval(() => invoke('request_servers'), 1000);

    return (
        <div className={"flex flex-row min-w-screen min-h-screen bg-neutral-900 overflow-hidden"}>
            <Sidebar servers={servers} selectedServer={selectedServer} onSelectedServer={(server: MinecraftServer) => setSelectedServer(server)}/>
            {selectedServer && <ServerView server={selectedServer}/>}
        </div>
    )
}

export default App;
