import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ServerType } from "../../types/types.tsx";
import { sortVersions } from "../../utils/versions.ts";
import Button from "../ui/Button.tsx";
import { Input } from "../ui/Input.tsx";
import { Select } from "../ui/Select.tsx";
import { Modal } from "../ui/Modal.tsx";
import { Check, X } from "lucide-react";
import { listen } from "@tauri-apps/api/event";

interface AddServerPanelProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
}

export function AddServerPanel({ isOpen, onOpenChange }: AddServerPanelProps) {
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
        onOpenChange(false);
    }

    useEffect(() => {
        if (!isOpen) {
            setVersion(null);
            setAvailableVersions([]);
            setServerName("");
            setServerType("Vanilla");
            setCreateBtnDisabled(false);
            setCreateServerButtonTextContent("Create");
        }
    }, [isOpen]);
    useEffect(() => {
        async function fetchAvailableVersions() {
            const versions = await invoke("fetch_versions", { serverType }) as string[];
            const newVersions = sortVersions(versions);
            setAvailableVersions(newVersions);
            setVersion(newVersions[newVersions.length - 1]);
        }

        if (isOpen) {
            fetchAvailableVersions();
        }
    }, [serverType, isOpen]);

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
        <Modal isOpen={isOpen} onClose={() => onOpenChange(false)} title="New Server" footer={
            <>
                <Button onClick={() => createServer()} disabled={createBtnDisabled || serverName === "" || version === null} color="primary" className="px-6">
                    <Check className="w-4 h-4" />
                    <span className="text-nowrap">{createServerButtonTextContent}</span>
                </Button>
                <Button onClick={() => onOpenChange(false)} color="red" className="px-6">
                    <X className="w-4 h-4" />
                    <span>Cancel</span>
                </Button>
            </>
        } body={
            <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-text">Server Name</label>
                    <Input
                        type="text"
                        placeholder="My Server"
                        value={serverName}
                        onChange={(e) => setServerName(e.target.value)}
                        className="w-full"
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium text-text">Type</label>
                        <Select
                            value={serverType}
                            options={["Vanilla", "Paper"]}
                            setValue={(newValue) => setServerType(newValue as ServerType)}
                        />
                    </div>

                    {availableVersions.length > 0 && (
                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-medium text-text">Version</label>
                            <Select
                                value={version ?? availableVersions[availableVersions.length - 1]}
                                options={availableVersions}
                                setValue={(newValue) => setVersion(newValue)}
                            />
                        </div>
                    )}
                </div>
            </div>
        } />
    );
}
