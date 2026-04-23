import { useEffect, useState } from "react";
import {FrontendServer, ServerType} from "../../../types/types.tsx";
import { Check, X, Cpu, Trash2, FolderOpen } from "lucide-react";
import Button from "../../ui/Button.tsx";
import { ConfirmModal } from "../../ui/Modal.tsx";
import { invoke } from "@tauri-apps/api/core";
import { SettingContainer } from "../../ui/SettingContainer.tsx";
import { Input } from "../../ui/Input.tsx";
import { Select } from "../../ui/Select.tsx";
import { sortVersions } from "../../../utils/versions.ts";
import { open } from "@tauri-apps/plugin-dialog";

interface ServerSettingsProps {
    server: FrontendServer
}
export function ServerSettings({ server }: ServerSettingsProps) {
    const [settingServer, setSettingServer] = useState<FrontendServer>(server);
    const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
    const [availableVersions, setAvailableVersions] = useState<string[]>([]);

    useEffect(() => {
        async function fetchAvailableVersions() {
            const versions = await invoke("fetch_versions", { serverType: settingServer.server.server_type }) as string[];
            const newVersions = sortVersions(versions)
            setAvailableVersions(newVersions);
        }

        setAvailableVersions([]);
        fetchAvailableVersions();
    }, [settingServer.server.server_type]);

    async function applySettings() {
        await invoke("update_server", {server: settingServer.server})
    }

    async function deleteServer() {
        await invoke("remove_server", {serverId: server.server.server_id})
        setShowDeleteModal(false);
    }
    useEffect(() => {
        setSettingServer(server);
    }, [server.server.server_id, server.server.java_path])

    return (
        <>
        <div className="flex-1 h-full bg-bg-2 flex flex-col space-y-4 pb-4">
            <div className={"flex flex-col max-h-100 h-100 overflow-y-scroll scrollbar-hide"}>
                <div className="p-3">
                    <div className="flex items-center gap-2 mb-3">
                        <Cpu className="w-5 h-5 text-orange-500" />
                        <p className="text-base font-semibold text-orange-500">Java Settings</p>
                    </div>
                    <div className="space-y-4">
                        <SettingContainer name="Java Path" description={
                            <span>
                                Path to your version-compatible Java executable file. <br/>
                                This will be used to launch the server.
                            </span>
                        }>
                            <div className="flex gap-2">
                                <Input type="text" placeholder="C:\path\to\java.exe" value={settingServer.server.java_path} onChange={(event) => {
                                    setSettingServer((oldSettingServer) => ({
                                        ...oldSettingServer,
                                        server: {
                                            ...oldSettingServer.server,
                                            java_path: event.target.value
                                        }
                                    }))
                                }}/>
                                <Button className={"px-2"} onClick={async () => {
                                    const selected = await open({
                                        title: "Select Java executable",
                                        multiple: false,
                                        filters: [{
                                            name: "Java",
                                            extensions: ["exe"]
                                        }]
                                    });
                                    if (selected) {
                                        setSettingServer((oldSettingServer) => ({
                                            ...oldSettingServer,
                                            server: {
                                                ...oldSettingServer.server,
                                                java_path: selected
                                            }
                                        }))
                                    }
                                }} color="orange">
                                    <FolderOpen className="w-5 h-5" /><></>
                                </Button>
                            </div>
                        </SettingContainer>
                        <SettingContainer name="Launch Arguments" description="Java arguments used to launch the server.">
                            <Input type="text" value={settingServer.server.launch_args} onChange={(event) => {
                                setSettingServer((oldSettingServer) => ({
                                    ...oldSettingServer,
                                    server: {
                                        ...oldSettingServer.server,
                                        launch_args: event.target.value
                                    }
                                }))
                            }}/>
                        </SettingContainer>
                        <SettingContainer name="Allocated RAM" description="Maximum RAM that can be used on the server.">
                            <Input type="text" value={settingServer.server.allocated_ram} onChange={(event) => {
                                setSettingServer((oldSettingServer) => ({
                                    ...oldSettingServer,
                                    server: {
                                        ...oldSettingServer.server,
                                        allocated_ram: event.target.value
                                    }
                                }))
                            }}/>
                        </SettingContainer>
                    </div>
                </div>


                <div className="p-3">
                    <div className="flex items-center gap-2 mb-3">
                        <Trash2 className="w-5 h-5 text-red-500" />
                        <p className="text-base font-semibold text-red-500">Danger Zone</p>
                    </div>
                    <SettingContainer name="Server Jar" description="">
                        <Select disabled={server.status === "Online"} value={settingServer.server.server_type} options={["Vanilla", "Paper"]} setValue={(newValue) => {
                            setSettingServer((oldSettingServer) => ({
                                ...oldSettingServer,
                                server: {
                                    ...oldSettingServer.server,
                                    server_type: newValue as ServerType
                                }
                            }))
                        }}/>
                    </SettingContainer>
                    {availableVersions.length > 0 &&
                        <SettingContainer name="Version" description="The version of the server.">
                            <Select disabled={server.status === "Online"} value={(() => {
                                if (availableVersions.indexOf(settingServer.server.server_version) !== -1)
                                    return settingServer.server.server_version;
                                return availableVersions[availableVersions.length - 1];
                            })()} options={availableVersions} setValue={(newValue) => {
                                setSettingServer((oldSettingServer) => ({
                                    ...oldSettingServer,
                                    server: {
                                        ...oldSettingServer.server,
                                        server_version: newValue
                                    }
                                }))
                            }}/>
                        </SettingContainer>
                    }
                    <SettingContainer name="Delete Server" description="Delete the server. All data will be lost.">
                        <Button className={"w-1/2"} disabled={server.status === "Online"} color="red"
                            title={server.status === "Online" ? "The server must be turned off." : ""}
                            onClick={() => setShowDeleteModal(true)}
                        >
                            <X className="w-5 h-5"/>
                            <span>Delete</span>
                        </Button>
                    </SettingContainer>
                </div>
            </div>
        </div>
        <div className="flex flex-row w-full space-x-4 bg-bg-2 border-t border-border p-2.5">
            <Button onClick={() => applySettings()} color={"orange"}>
                <Check className={"w-6 h-6 block"}/>
                <p>Apply</p>
            </Button>
            <Button onClick={() => setSettingServer(server)} color={"red"}>
                <X className={"w-6 h-6 block"}/>
                <p>Revert</p>
            </Button>
        </div>
        <ConfirmModal
            isOpen={showDeleteModal}
            onClose={() => setShowDeleteModal(false)}
            title="Delete Server"
            description="Are you sure you want to do this? All data will be lost."
            confirmText="Delete"
            onConfirm={deleteServer}
            confirmColor="orange"
            cancelText="Cancel"
        />
        </>
    );
}