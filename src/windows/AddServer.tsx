
import {Blocks, Book, Plus, X} from "lucide-react";
import {useEffect, useState} from "react";
import {invoke} from "@tauri-apps/api/core";
import {sortVersions} from "../utils/versions.ts";
import {getCurrentWindow} from "@tauri-apps/api/window";
import { ServerType } from "../types/types.tsx";
import Button from "../components/ui/Button.tsx";

export function AddServer() {
    const [serverName, setServerName] = useState("")
    const [serverType, setServerType] = useState<ServerType>("Vanilla")
    const [version, setVersion] = useState<string | null>(null);
    const [availableVersions, setAvailableVersions] = useState<string[]>([]);

    async function createServer() {
        console.log(version);
        if (serverName == "") return;
        if (version === null) return;

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
                                <input type={"text"} className={"w-full p-2 placeholder-gray-500 text-gray-300 focus:outline-none"} placeholder={"Server name"} value={serverName} onChange={(e) => setServerName(e.target.value)}/>
                            </div>
                        </div>
                        <div>
                            <p className={"text-gray-400 font-medium"}>Type</p>
                            <div className={"mt-2 w-full flex flex-row gap-x-2 text-xl text-gray-500 bg-zinc-800 align-center items-center px-3 rounded-lg"}>
                                <Book/>
                                <select className={"w-full p-2 placeholder-gray-500 text-gray-300 focus:outline-none"} value={serverType} onChange={(event) => setServerType(event.target.value as ServerType)}>
                                    {["Vanilla", "Paper"].map((st: string) => (
                                        <option key={st} className={"bg-zinc-800 text-gray-300"} value={st}>{st}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div>
                            <p className={"text-gray-400 font-medium"}>Version</p>
                            <div className={"mt-2 w-full flex flex-row gap-x-2 text-xl text-gray-500 bg-zinc-800 align-center items-center px-3 rounded-lg"}>
                                <Book/>
                                {availableVersions.length > 0 && <select className={"w-full p-2 placeholder-gray-500 text-gray-300 focus:outline-none"} value={version ?? availableVersions[availableVersions.length - 1]} onChange={(event) => setVersion(event.target.value)}>
                                    {availableVersions.map((v: string) => (
                                        <option key={v} className={"bg-zinc-800 text-gray-300"} value={v}>{v}</option>
                                    ))}
                                </select>}
                            </div>
                        </div>
                    </div>
                    <div className={"p-4 space-y-4"}>
                        <Button onClick={async () => await createServer()} color={"orange"}>
                            <Plus/>
                            <p>Create</p>
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