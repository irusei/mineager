import "./style/App.css";
import Sidebar from "./components/sidebar/Sidebar.tsx";
import {FrontendServer} from "./types/types.tsx";
import {useEffect, useState} from "react";
import ServerView from "./components/server/ServerView.tsx";
import {invoke} from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

function App() {
    const [selectedServer, setSelectedServer] = useState<FrontendServer | null>(null);
    const [servers, setServers] = useState<FrontendServer[]>([]);

    useEffect(() => {
        const updateLocalServersUnlisten = listen('update-local-servers', (event) => {
            let localServers: FrontendServer[] = event.payload as FrontendServer[];
            setServers(localServers);
        });

        const alertUnlisten = listen('alert', (event) => {
            alert(event.payload as string);
        });

        invoke("init_window_properties").then((servers) => {
            setServers(servers as FrontendServer[]);
        });

        return () => {
           updateLocalServersUnlisten.then((ul) => ul());
           alertUnlisten.then((ul) => ul());
        }
    }, []);

    // update selected server when info about it changes
    useEffect(() => {
        if (!selectedServer) return;
        let found = false;
        for (const newServer of servers) {
            if (newServer.server.server_id === selectedServer.server.server_id) {
                found = true;
                setSelectedServer(newServer)
            }
        }

        if (!found)
            setSelectedServer(null);
    }, [servers])
    
    return (
        <div className={"flex flex-row min-w-screen min-h-screen max-w-screen max-h-screen bg-neutral-900 overflow-hidden"}>
            <Sidebar servers={servers} selectedServer={selectedServer} onSelectedServer={(server: FrontendServer) => setSelectedServer(server)}/>
            {selectedServer && <ServerView server={selectedServer}/>}
        </div>
    )
}

export default App;
