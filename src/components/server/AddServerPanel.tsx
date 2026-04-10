import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ServerType } from "../../types/types.tsx";
import { sortVersions } from "../../utils/versions.ts";
import Button from "../ui/Button.tsx";
import { Input } from "../ui/Input.tsx";
import { Select } from "../ui/Select.tsx";
import { listen } from "@tauri-apps/api/event";
import { Check, X } from "lucide-react";

interface AddServerPanelProps {
    onAddServer: () => void;
}

export function AddServerPanel({ onAddServer }: AddServerPanelProps) {
    const [serverName, setServerName] = useState("");
    const [serverType, setServerType] = useState<ServerType>("Vanilla");
    const [version, setVersion] = useState<string | null>(null);
    const [availableVersions, setAvailableVersions] = useState<string[]>([]);
    const [createBtnDisabled, setCreateBtnDisabled] = useState<boolean>(false);
    const [createServerButtonTextContent, setCreateServerButtonTextContent] = useState<string>("Create");

    async function createServer() {
        if (serverName === "") return;
        if (version === null) return;
        setCreateBtnDisabled(true);

        await invoke("create_server", { serverName, serverType, version });
        onAddServer();
    }

    useEffect(() => {
        async function fetchAvailableVersions() {
            const versions = await invoke("fetch_versions", { serverType }) as string[];
            const newVersions = sortVersions(versions);
            setAvailableVersions(newVersions);
            setVersion(newVersions[newVersions.length - 1]);
        }

        fetchAvailableVersions();
    }, [serverType]);

    useEffect(() => {
        const updateCreateButtonTextUnlisten = listen('update-create-button-text', (event) => {
            const newText = event.payload as string;
            setCreateServerButtonTextContent(newText);

            // runs when server creation finishes
            if (newText === "Create" && createBtnDisabled)
                setCreateBtnDisabled(false);
        });

        return () => {
            updateCreateButtonTextUnlisten.then((ul) => ul());
        };
    }, []);

    return (
        <div className="flex-1 flex flex-col min-h-full bg-bg-1">
            <div className="p-4 border-b border-border bg-bg-2">
                <div className="flex items-center gap-2 h-8">
                    <span className="font-semibold text-lg text-text">New Server</span>
                </div>
            </div>
            <div className="flex-1 p-4 overflow-y-auto">
                <div className="bg-bg-2 rounded-lg border border-border p-4 space-y-4">
                    <div className="flex flex-col h-full space-y-3">
                        <div className="flex flex-col gap-1">
                            <label className="text-sm font-medium text-text">Server Name</label>
                            <Input
                                type="text"
                                placeholder="My Server"
                                value={serverName}
                                onChange={(e) => setServerName(e.target.value)}
                                className="w-full"
                            />
                        </div>

                        <div className="flex flex-col gap-1">
                            <label className="text-sm font-medium text-text">Type</label>
                            <Select
                                value={serverType}
                                options={["Vanilla", "Paper"]}
                                setValue={(newValue) => setServerType(newValue as ServerType)}
                                className="w-full"
                            />
                        </div>

                        {availableVersions.length > 0 && (
                            <div className="flex flex-col gap-1">
                                <label className="text-sm font-medium text-text">Version</label>
                                <Select
                                    value={version ?? availableVersions[availableVersions.length - 1]}
                                    options={availableVersions}
                                    setValue={(newValue) => setVersion(newValue)}
                                    className="w-full"
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="p-2.5 flex flex-row gap-3 border-t border-border bg-bg-2">
                <Button
                    disabled={createBtnDisabled || serverName === "" || version === null}
                    onClick={createServer}
                    color="orange"
                >
                    <Check/>
                    <span>{createServerButtonTextContent}</span>
                </Button>
                <Button onClick={() => onAddServer()} color="red">
                    <X/>
                    <span>Cancel</span>
                </Button>
            </div>
        </div>
    );
}
