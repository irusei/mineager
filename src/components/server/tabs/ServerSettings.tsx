import { useEffect, useState } from "react";
import {MinecraftServer, ServerType} from "../../../types/types.tsx";
import { Check, ChevronRight, X } from "lucide-react";
import Button from "../../ui/Button.tsx";
import { invoke } from "@tauri-apps/api/core";
import { SettingContainer } from "../../ui/SettingContainer.tsx";
import { Input } from "../../ui/Input.tsx";
import { Select } from "../../ui/Select.tsx";
import { sortVersions } from "../../../utils/versions.ts";

interface ServerSettingsProps { 
    server: MinecraftServer
}
export function ServerSettings({ server }: ServerSettingsProps) {
    const [settingServer, setSettingServer] = useState<MinecraftServer>(server);
    const [showDeleteServerModal, setShowDeleteServerModal] = useState<boolean>(false);
    const [availableVersions, setAvailableVersions] = useState<string[]>([]);

    useEffect(() => {
        async function fetchAvailableVersions() {
            const versions = await invoke("fetch_versions", { serverType: settingServer.server_type }) as string[];
            const newVersions = sortVersions(versions)
            setAvailableVersions(newVersions);
        }

        setAvailableVersions([]);
        fetchAvailableVersions();
    }, [settingServer.server_type]);

    async function applySettings() {
        await invoke("update_local_server", {server: settingServer})
    }

    async function deleteServer() {
        await invoke("remove_server", {serverId: server.server_id})
        setShowDeleteServerModal(false);
    }
    useEffect(() => {
        setSettingServer(server);
    }, [server.server_id, server.java_path]) // when the backend updates java path by itself

    return (
        <>
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
                <p className={"text-xl font-medium text-red-400"}>Danger Zone</p>
                <SettingContainer name={"Type"} description={"Server type"}>
                    <Select disabled={server.status === "Online"} value={settingServer.server_type} options={["Vanilla", "Paper"]} setValue={(newValue) => {
                        setSettingServer((oldSettingServer) => ({
                            ...oldSettingServer,
                            server_type: newValue as ServerType
                        }))
                    }}/>
                </SettingContainer>
                {availableVersions.length > 0 && 
                    <SettingContainer name={"Version"} description={"The version of the server"}>
                        <Select disabled={server.status === "Online"} value={(() => {
                            if (availableVersions.indexOf(settingServer.server_version) != -1)
                                return settingServer.server_version;

                            return availableVersions[availableVersions.length - 1];
                        })()} options={availableVersions} setValue={(newValue) => {
                            setSettingServer((oldSettingServer) => ({
                                ...oldSettingServer,
                                server_version: newValue
                            }))
                        }}/>
                    </SettingContainer>
                }
                <SettingContainer name={"Delete Server"} description={"Delete the server. All data will be lost."}>
                    <Button className={"w-1/2"} disabled={server.status === "Online"} color={"red"}
                        title={server.status === "Online" ? "The server must be turned off." : ""}
                        onClick={() => setShowDeleteServerModal(true)}
                    >
                        <X/>
                        <p>Delete server</p>
                    </Button>
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
        {showDeleteServerModal && 
            <div className={"z-50 fixed left-0 top-0 items-center w-screen h-screen backdrop-blur-sm flex justify-center"}>
                <div className={"w-100 h-65 bg-neutral-900 rounded-lg border-zinc-800 border flex flex-col"}>
                    <div className={"w-full h-15 text-gray-300 font-medium text-2xl py-2 px-4 flex flex-row space-y-2 border-zinc-800 border-b items-center"}>
                        <p>Delete Server</p>
                    </div>
                    <div className={"w-full text-gray-300 font-medium text-lg p-4 border-zinc-800 border-b items-center flex"}>
                        Are you sure you want to do this? All data will be lost.
                    </div>
                    <div className={"w-full items-center flex flex-col space-y-3 px-2 py-3"}>
                        <Button onClick={() => deleteServer()} color={"red"}>
                            <X/>
                            <p>Delete</p>
                        </Button>
                        <Button onClick={() => setShowDeleteServerModal(false)} color={"blue"}>
                            <ChevronRight/>
                            <p>Go back</p>
                        </Button>
                    </div>
                </div>
            </div>
        }
        </>
    );
}