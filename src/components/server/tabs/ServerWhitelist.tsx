import { useEffect, useState } from "react";
import { UserPlus, UserX, Shield } from "lucide-react";
import Button from "../../ui/Button.tsx";
import { Input } from "../../ui/Input.tsx";
import { SettingContainer } from "../../ui/SettingContainer.tsx";
import { Switch } from "../../ui/Switch.tsx";
import { FrontendServer } from "../../../types/types.tsx";
import { invoke } from "@tauri-apps/api/core";

interface WhitelistEntry {
    uuid: string;
    name: string;
}

interface ServerWhitelistProps {
    server: FrontendServer;
}

export function ServerWhitelist({ server }: ServerWhitelistProps) {
    const [whitelistEnabled, setWhitelistEnabled] = useState(false);
    const [newPlayerName, setNewPlayerName] = useState("");
    const [entries, setEntries] = useState<WhitelistEntry[]>([]);

    function refreshEntries() {
        invoke('list_whitelist_entries', {serverId: server.server.server_id}).then((whitelistEntries) => {
            setEntries(whitelistEntries as WhitelistEntry[]);
        });
    }

    function whitelistPlayer() {
        invoke('add_whitelist_entry', {serverId: server.server.server_id, username: newPlayerName}).then((_) => {
            setTimeout(refreshEntries, 750);
            setNewPlayerName("");
        });
    }

    function removeWhitelistEntry(entry: WhitelistEntry) {
        invoke('remove_whitelist_entry', {serverId: server.server.server_id, entry: entry}).then(() => {
            setTimeout(refreshEntries, 750);
        })
    }

    useEffect(() => {
        invoke('list_whitelist_entries', {serverId: server.server.server_id}).then((whitelistEntries) => {
            setEntries(whitelistEntries as WhitelistEntry[]);
        });
        invoke('is_whitelist_enabled', {serverId: server.server.server_id}).then((enabled) => {
            setWhitelistEnabled(enabled as boolean);
        })
    }, [server.server.server_id])

    return (
        <div className="flex-1 h-full min-h-120 max-h-120 bg-bg-2 flex flex-col">
            <div className="relative flex flex-col flex-1 overflow-hidden p-3 overflow-y-auto scrollbar-hide">
                <div className="flex items-center gap-2 mb-3">
                    <Shield className="w-4 h-4 text-mauve" />
                    <p className="text-base font-semibold text-mauve">Whitelist Management</p>
                </div>

                <div className="mb-4">
                    <SettingContainer name="Enable Whitelist" description="Restrict who is allowed to join the server.">
                        <Switch checked={whitelistEnabled} onChecked={(v) => {
                            setWhitelistEnabled(v);
                            invoke('set_whitelist_enabled', {serverId: server.server.server_id, enabled: v});
                        }} />
                    </SettingContainer>
                    <SettingContainer name="Add Player" description="Add a player to the whitelist by their username.">
                        <div className="flex gap-2">
                            <Input
                                type="text"
                                placeholder="Player username"
                                value={newPlayerName}
                                onChange={(e) => setNewPlayerName(e.target.value)}
                                className="flex-1"
                            />
                            <Button onClick={whitelistPlayer} color="primary" className="w-auto py-1.5 px-3 gap-1">
                                <UserPlus className="w-4 h-4" />
                                <span className="text-xs">Add</span>
                            </Button>
                        </div>
                    </SettingContainer>
                </div>

                <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                        <UserPlus className="w-4 h-4 text-mauve" />
                        <p className="text-sm font-semibold text-text">Whitelisted Players ({entries.length})</p>
                    </div>
                </div>

                <div className="flex-1 space-y-2">
                    {entries.map((entry) => (
                        <div key={entry.uuid} className="flex flex-row items-center justify-between bg-bg-1 border border-border rounded-lg p-3">
                            <div className="flex flex-col">
                                <span className="text-sm text-text font-medium">{entry.name}</span>
                                <span className="text-xs text-text-2 font-mono">{entry.uuid}</span>
                            </div>
                            <Button color="red" className="w-auto py-1.5 px-3 gap-1" onClick={() => removeWhitelistEntry(entry)}>
                                <UserX className="w-4 h-4" />
                                <span className="text-xs">Remove</span>
                            </Button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
