
import {Blocks, Book, Plus, X} from "lucide-react";
import {useEffect, useState} from "react";
import {invoke} from "@tauri-apps/api/core";
import {sortVersions} from "../utils/versions.ts";
import {getCurrentWindow} from "@tauri-apps/api/window";
import { ServerType } from "../types/types.tsx";
import Button from "../components/ui/Button.tsx";
import { Input } from "../components/ui/Input.tsx";
import { Select } from "../components/ui/Select.tsx";
import { listen } from "@tauri-apps/api/event";

export function AddServer() {
    const [serverName, setServerName] = useState("")
    const [serverType, setServerType] = useState<ServerType>("Vanilla")
    const [version, setVersion] = useState<string | null>(null);
    const [availableVersions, setAvailableVersions] = useState<string[]>([]);
    const [createBtnDisabled, setCreateBtnDisabled] = useState<boolean>(false);
    const [createServerButtonTextContent, setCreateServerButtonTextContent] = useState<String>("Create"); // used for broadcasting the server creation state

    async function createServer() {
        if (serverName == "") return;
        if (version === null) return;
        setCreateBtnDisabled(true);

        await invoke("create_server", {serverName, serverType, version});
        await getCurrentWindow().destroy();
    }
    useEffect(() => {
        async function fetchAvailableVersions() {
            const versions = await invoke("fetch_versions", { serverType }) as string[];
            const newVersions = sortVersions(versions)
            setAvailableVersions(newVersions);
            setVersion(newVersions[newVersions.length - 1])
        }

        fetchAvailableVersions();
    }, [serverType]);

    useEffect(() => {
        listen('update-create-button-text', (event) => {
            const newText = event.payload as string;

            setCreateServerButtonTextContent(newText);
            if (newText === "Create" && createBtnDisabled)
                setCreateBtnDisabled(false);
        });
    })
    return <>
        <h1>
            <div className={"flex flex-row items-center justify-center min-w-screen min-h-screen bg-neutral-900 overflow-hidden"}>
                <div className={"flex flex-col w-full h-screen"}>
                    <div className={"p-4 border-b border-zinc-800"}>
                        <h1 className={"flex flex-row items-center gap-x-3 font-medium text-xl text-gray-300"}>
                            <Blocks className={"text-orange-400"}/>
                            <p>Add Server</p>
                        </h1>
                    </div>
                    <div className={"p-4 border-b border-zinc-800 space-y-2"}>
                        <div>
                            <p className={"text-gray-400 font-medium"}>Server Name</p>
                            <div className={"mt-2 w-full flex flex-row gap-x-2 text-xl text-gray-500 bg-zinc-800 align-center items-center px-3 rounded-lg"}>
                                <Book/>
                                <Input type={"text"} placeholder={"Server Name"} value={serverName}
                                    onChange={(e) => setServerName(e.target.value)}/>
                            </div>
                        </div>
                        <div>
                            <p className={"text-gray-400 font-medium"}>Type</p>
                            <div className={"mt-2 w-full flex flex-row gap-x-2 text-xl text-gray-500 bg-zinc-800 align-center items-center px-3 rounded-lg"}>
                                <Book/>
                                <Select className={"w-full"} value={serverType} setValue={(newValue) => setServerType(newValue as ServerType)} options={["Vanilla", "Paper"]}/>
                            </div>
                        </div>
                        {availableVersions.length > 0 && 
                            <div>
                                <p className={"text-gray-400 font-medium"}>Version</p>
                                <div className={"mt-2 w-full flex flex-row gap-x-2 text-xl text-gray-500 bg-zinc-800 align-center items-center px-3 rounded-lg"}>
                                    <Book/>
                                    <Select className={"w-full"} value={version ?? availableVersions[availableVersions.length - 1]} setValue={(newValue) => setVersion(newValue as ServerType)} options={availableVersions}/>
                                </div>
                            </div>             
                        }
                    </div>
                    <div className={"p-4 space-y-4"}>
                        <Button disabled={createBtnDisabled} onClick={async () => await createServer()} color={"orange"}>
                            <Plus/>
                            <p>{createServerButtonTextContent}</p>
                        </Button>
                        <Button onClick={async () => await getCurrentWindow().destroy()} color={"red"}>
                            <X/>
                            <p>Cancel</p>
                        </Button>
                    </div>
                </div>
            </div>
        </h1>
    </>
}