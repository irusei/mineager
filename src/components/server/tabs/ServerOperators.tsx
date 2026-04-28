import { useEffect, useState } from "react";
import { UserPlus, UserMinus, Shield } from "lucide-react";
import Button from "../../ui/Button.tsx";
import { Input } from "../../ui/Input.tsx";
import { SettingContainer } from "../../ui/SettingContainer.tsx";
import { FrontendServer } from "../../../types/types.tsx";
import { invoke } from "@tauri-apps/api/core";

interface OperatorEntry {
    uuid: string;
    name: string;
    level: number;
    bypassesPlayerLimit: boolean;
}

interface ServerOperatorsProps {
    server: FrontendServer;
}

export function ServerOperators({ server }: ServerOperatorsProps) {
    const [newPlayerName, setNewPlayerName] = useState("");
    const [entries, setEntries] = useState<OperatorEntry[]>([]);

    function refreshEntries() {
        invoke('list_operator_entries', {serverId: server.server.server_id}).then((ops) => {
            setEntries(ops as OperatorEntry[]);
        });
    }

    function addOperator() {
        if (!newPlayerName.trim()) return;
        invoke('add_operator', {serverId: server.server.server_id, username: newPlayerName}).then(() => {
            setTimeout(refreshEntries, 750);
            setNewPlayerName("");
        });
    }

    function removeOperator(entry: OperatorEntry) {
        invoke('remove_operator', {serverId: server.server.server_id, entry: entry}).then(() => {
            setTimeout(refreshEntries, 750);
        });
    }

    useEffect(() => {
        refreshEntries();
    }, [server.server.server_id]);

    return (
        <div className="flex-1 h-full min-h-120 max-h-120 bg-bg-2 flex flex-col">
            <div className="relative flex flex-col flex-1 overflow-hidden p-3 overflow-y-auto scrollbar-hide">
                <div className="flex items-center gap-2 mb-3">
                    <Shield className="w-4 h-4 text-mauve" />
                    <p className="text-base font-semibold text-mauve">Operators</p>
                </div>

                <div className="mb-4">
                    <SettingContainer name="Add Operator" description="Add a player as an operator.">
                        <div className="flex gap-2">
                            <Input
                                type="text"
                                placeholder="Player username"
                                value={newPlayerName}
                                onChange={(e) => setNewPlayerName(e.target.value)}
                                className="flex-1"
                            />
                            <Button onClick={addOperator} color="primary" className="w-auto py-1.5 px-3 gap-1">
                                <UserPlus className="w-4 h-4" />
                                <span className="text-xs">Op</span>
                            </Button>
                        </div>
                    </SettingContainer>
                </div>

                <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                        <UserMinus className="w-4 h-4 text-mauve" />
                        <p className="text-sm font-semibold text-text">Operators ({entries.length})</p>
                    </div>
                </div>

                <div className="flex-1 space-y-2">
                    {entries.map((entry) => (
                        <div key={entry.uuid} className="flex flex-row items-center justify-between bg-bg-1 border border-border rounded-lg p-3">
                            <div className="flex flex-col">
                                <span className="text-sm text-text font-medium">{entry.name}</span>
                                <span className="text-xs text-text-2 font-mono">{entry.uuid}</span>
                            </div>
                            <Button color="red" className="w-auto py-1.5 px-3 gap-1" onClick={() => removeOperator(entry)}>
                                <UserMinus className="w-4 h-4" />
                                <span className="text-xs">Deop</span>
                            </Button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
