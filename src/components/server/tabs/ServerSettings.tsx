import { useEffect, useState } from "react";
import {MinecraftServer} from "../../../types/types.tsx";
import { Check, X } from "lucide-react";
import Button from "../../ui/Button.tsx";
import { invoke } from "@tauri-apps/api/core";
import { SettingContainer } from "../../ui/SettingContainer.tsx";
import { Input } from "../../ui/Input.tsx";

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
            <p className={"text-2xl font-medium text-gray-300"}>Settings</p>
            <div className={"flex flex-col p-1 space-y-2 h-95 max-h-95 overflow-y-scroll scrollbar-hide"}>
                <p className={"text-xl font-medium text-orange-400"}>Java Settings</p>
                <SettingContainer name={"Java Path"} description={<>
                    Path to your version-compatible Java executable file. <br/>This will be used to launch the server.
                </>}>
                    <Input type={"text"} placeholder={"C\\path\\to\\java.exe"} value={settingServer.java_path} onChange={(event) => {
                        setSettingServer((oldSettingServer) => ({
                            ...oldSettingServer,
                            java_path: event.target.value
                        }))
                    }}/>
                </SettingContainer>
                <SettingContainer name={"Launch Arguments"} description={"Java arguments used to launch the server."}>
                    <Input type={"text"} value={settingServer.launch_args} onChange={(event) => {
                        setSettingServer((oldSettingServer) => ({
                            ...oldSettingServer,
                            launch_args: event.target.value
                        }))
                    }}/>
                </SettingContainer>
                <SettingContainer name={"Allocated RAM"} description={"Maximum RAM that can be used on the server"}>
                    <Input type={"text"} value={settingServer.allocated_ram} onChange={(event) => {
                        setSettingServer((oldSettingServer) => ({
                            ...oldSettingServer,
                            allocated_ram: event.target.value
                        }))
                    }}/>
                </SettingContainer>
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