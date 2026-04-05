import { useEffect, useState } from "react";
import {MinecraftServer} from "../../../types/types.tsx";
import { Check, X } from "lucide-react";
import Button from "../../ui/Button.tsx";
import { invoke } from "@tauri-apps/api/core";

interface ServerSettingsProps { 
    server: MinecraftServer
}
export function ServerSettings({ server }: ServerSettingsProps) {
    const [settingServer, setSettingServer] = useState<MinecraftServer>(server);

    async function applySettings() {
        await invoke("update_local_server", {server: settingServer})
    }
    useEffect(() => {
        setSettingServer(server);
    }, [server.server_id])

    return (
        <div className="flex-1 h-full p-4 bg-neutral-900 flex flex-col space-y-4">
            <div className={"flex flex-col h-95 max-h-95"}>
                {/* Java Settings */}
                <p className={"text-2xl font-medium text-gray-300"}>Java Settings</p>

                <div className={"p-1 py-4 min-h-full h-full space-y-2"}>
                    {/* Java Path */}
                    <div className={"h-13 flex flex-row justify-between items-center"}>
                        <div className={"text-lg text-gray-300"}>
                            <p className={"font-medium"}>
                                Java Path
                            </p>
                            <p className={"text-sm text-zinc-500"}>
                                Path to your version-compatible Java executable file. <br/>This will be used to launch the server.
                            </p>
                        </div>
                        <input type={"text"} className={"w-1/2 h-10 py-3 px-2 rounded-lg bg-zinc-800 focus:outline-none placeholder-gray-500 text-gray-300"} placeholder={"C:\\path\\to\\java.exe"} value={settingServer.java_path} onChange={(event) => {
                            setSettingServer((oldSettingServer) => ({
                                ...oldSettingServer,
                                java_path: event.target.value
                            }))
                        }}/>
                    </div>

                    {/* Java Launch Args */}
                    <div className={"h-13 flex flex-row justify-between items-center"}>
                        <div className={"text-lg text-gray-300"}>
                            <p className={"font-medium"}>
                                Launch Arguments
                            </p>
                            <p className={"text-sm text-zinc-500"}>
                                Java arguments used to launch the server. <br/>
                            </p>
                        </div>
                        <input type={"text"} className={"w-1/2 h-10 py-3 px-2 rounded-lg bg-zinc-800 focus:outline-none placeholder-gray-500 text-gray-300"} placeholder={""} value={settingServer.launch_args} onChange={(event) => {
                            setSettingServer((oldSettingServer) => ({
                                ...oldSettingServer,
                                launch_args: event.target.value
                            }))
                        }}/>
                    </div>

                    {/* Java RAM */}
                    <div className={"h-13 flex flex-row justify-between items-center"}>
                        <div className={"text-lg text-gray-300"}>
                            <p className={"font-medium"}>
                                Allocated RAM
                            </p>
                            <p className={"text-sm text-zinc-500"}>
                                Maximum RAM that can be used on the server.<br/>
                            </p>
                        </div>
                        <input type={"text"} className={"w-1/2 h-10 py-3 px-2 rounded-lg bg-zinc-800 focus:outline-none placeholder-gray-500 text-gray-300"} placeholder={"4096M"} value={settingServer.allocated_ram} onChange={(event) => {
                            setSettingServer((oldSettingServer) => ({
                                ...oldSettingServer,
                                allocated_ram: event.target.value
                            }))
                        }}/>
                    </div>
                </div>
            </div>
            <div className={"flex flex-row w-full space-x-4"}>
                <Button onClick={() => applySettings()} color={"orange"}>
                    <Check className={"w-6 h-6 block"}/>
                    <p>Apply</p>
                </Button>
                <Button onClick={() => setSettingServer(server)} color={"red"}>
                    <X className={"w-6 h-6 block"}/>
                    <p>Revert</p>
                </Button>
            </div>
        </div>
    );
}