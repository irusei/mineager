import { useEffect, useState } from "react";
import { UserX, Shield, Plus, Check, X } from "lucide-react";
import Button from "../../ui/Button.tsx";
import { Input } from "../../ui/Input.tsx";
import { SettingContainer } from "../../ui/SettingContainer.tsx";
import { Modal } from "../../ui/Modal.tsx";
import { FrontendServer } from "../../../types/types.tsx";
import { invoke } from "@tauri-apps/api/core";

interface PlayerBanEntry {
    uuid: string;
    name: string;
    created: string;
    source: string;
    expires: string;
    reason: string;
}

interface IpBanEntry {
    ip: string;
    created: string;
    source: string;
    expires: string;
    reason: string;
}

interface ServerBansProperties {
    server: FrontendServer;
}
export function ServerBans({ server }: ServerBansProperties) {
    const [newPlayerBan, setNewPlayerBan] = useState("");
    const [newIpBan, setNewIpBan] = useState("");
    const [playerReason, setPlayerReason] = useState("");
    const [ipReason, setIpReason] = useState("");
    const [showPlayerModal, setShowPlayerModal] = useState(false);
    const [showIpModal, setShowIpModal] = useState(false);

    const [bannedPlayers, setBannedPlayers] = useState<PlayerBanEntry[]>([]);
    const [bannedIps, setBannedIps] = useState<IpBanEntry[]>([]);

    async function refreshBanned() {
        invoke("read_banned_players", { serverId: server.server.server_id }).then((banned) => setBannedPlayers(banned as PlayerBanEntry[]));
        invoke("read_banned_ips", { serverId: server.server.server_id }).then((banned) => setBannedIps(banned as IpBanEntry[]));
    }

    function banPlayer() {
        invoke("ban_player", { serverId: server.server.server_id, username: newPlayerBan, reason: playerReason}).then(() => {
            setShowPlayerModal(false);
            setPlayerReason(""); 
            setNewPlayerBan("");
            setTimeout(refreshBanned, 750);
        })
    }

    function banIp() {
        invoke("ban_ip", { serverId: server.server.server_id, ip: newIpBan, reason: ipReason}).then(() => {
            setShowIpModal(false); 
            setIpReason(""); 
            setNewIpBan("");
            setTimeout(refreshBanned, 750);
        })
    }

    function unbanIp(entry: IpBanEntry) {
        invoke("unban_ip", { serverId: server.server.server_id, entry: entry}).then(() => {
            setTimeout(refreshBanned, 750);
        })
    }

    function unbanPlayer(entry: PlayerBanEntry) {
        invoke("unban_player", { serverId: server.server.server_id, entry: entry}).then(() => {
            setTimeout(refreshBanned, 750);
        })
    }

    // load banned on load
    useEffect(() => {
        refreshBanned();
    }, [server.server.server_id]);

    return (
        <>
            <Modal isOpen={showPlayerModal} onClose={() => setShowPlayerModal(false)} title="Ban Player" body={
                <div className="flex flex-col gap-1">
                    <label className="text-xs text-text-2">Reason</label>
                    <Input
                        type="text"
                        placeholder="Optional"
                        value={playerReason}
                        onChange={(e) => setPlayerReason(e.target.value)}
                        className="w-full"
                    />
                </div>
            } footer={
                <>
                    <Button color="primary" onClick={banPlayer} className="px-4">
                        <Check className="w-4 h-4" />
                        <span>Ban</span>
                    </Button>
                    <Button color="red" onClick={() => { setShowPlayerModal(false); setPlayerReason(""); }} className="px-4">
                        <X className="w-4 h-4" />
                        <span>Cancel</span>
                    </Button>
                </>
            } />

            <Modal isOpen={showIpModal} onClose={() => setShowIpModal(false)} title="Ban IP" body={
                <div className="flex flex-col gap-1">
                    <label className="text-xs text-text-2">Reason</label>
                    <Input
                        type="text"
                        placeholder="Optional"
                        value={ipReason}
                        onChange={(e) => setIpReason(e.target.value)}
                        className="w-full"
                    />
                </div>
            } footer={
                <>
                    <Button color="primary" onClick={banIp} className="px-4">
                        <Check className="w-4 h-4" />
                        <span>Ban</span>
                    </Button>
                    <Button color="red" onClick={() => { setShowIpModal(false); setIpReason(""); }} className="px-4">
                        <X className="w-4 h-4" />
                        <span>Cancel</span>
                    </Button>
                </>
            } />

            <div className="flex-1 h-full min-h-120 max-h-120 bg-bg-2 flex flex-col">
                <div className="relative flex flex-col flex-1 overflow-hidden p-3 overflow-y-auto scrollbar-hide">

                    <div className="flex items-center gap-2 mb-3">
                        <UserX className="w-4 h-4 text-mauve" />
                        <p className="text-base font-semibold text-mauve">Add Player Ban</p>
                    </div>
                    <SettingContainer name="Ban Player" description="Enter the username of the player to ban.">
                        <div className="flex gap-2">
                            <Input
                                type="text"
                                placeholder="Player username"
                                value={newPlayerBan}
                                onChange={(e) => setNewPlayerBan(e.target.value)}
                                className="flex-1"
                            />
                            <Button color="red" className="w-auto py-1.5 px-3 gap-1" onClick={() => setShowPlayerModal(true)}>
                                <Plus className="w-4 h-4" />
                                <span className="text-xs">Ban</span>
                            </Button>
                        </div>
                    </SettingContainer>

                    <div className="flex items-center gap-2 mb-3 mt-6">
                        <UserX className="w-4 h-4 text-mauve" />
                        <p className="text-base font-semibold text-mauve">Banned Players ({bannedPlayers.length})</p>
                    </div>

                    <div className="flex-1 space-y-2 mb-6">
                        {bannedPlayers.map((entry) => (
                            <div key={entry.uuid} className="bg-bg-1 border border-border rounded-lg p-3 flex flex-col">
                                <div className="flex flex-row items-center justify-between">
                                    <div className="flex flex-col">
                                        <span className="text-sm text-text font-medium">{entry.name}</span>
                                        <span className="text-xs text-text-2 font-mono">{entry.uuid}</span>
                                    </div>
                                    <Button color="red" className="w-auto py-1.5 px-3 gap-1" onClick={() => unbanPlayer(entry)}>
                                        <UserX className="w-4 h-4" />
                                        <span className="text-xs">Unban</span>
                                    </Button>
                                </div>
                                {entry.reason && (
                                    <p className="text-[11px] text-text-2 pt-2">
                                        {entry.reason}
                                    </p>
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="flex items-center gap-2 mb-3">
                        <Shield className="w-4 h-4 text-mauve" />
                        <p className="text-base font-semibold text-mauve">Add IP Ban</p>
                    </div>
                    <SettingContainer name="Ban IP" description="Enter the IP address to ban.">
                        <div className="flex gap-2">
                            <Input
                                type="text"
                                placeholder="IP address"
                                value={newIpBan}
                                onChange={(e) => setNewIpBan(e.target.value)}
                                className="flex-1"
                            />
                            <Button color="red" className="w-auto py-1.5 px-3 gap-1" onClick={() => setShowIpModal(true)}>
                                <Plus className="w-4 h-4" />
                                <span className="text-xs">Ban</span>
                            </Button>
                        </div>
                    </SettingContainer>

                    <div className="flex items-center gap-2 mb-3 mt-6">
                        <Shield className="w-4 h-4 text-mauve" />
                        <p className="text-base font-semibold text-mauve">Banned IPs ({bannedIps.length})</p>
                    </div>

                    <div className="flex-1 space-y-2">
                        {bannedIps.map((entry) => (
                            <div key={entry.ip} className="bg-bg-1 border border-border rounded-lg p-3 flex flex-col">
                                <div className="flex flex-row items-center justify-between">
                                    <div className="flex flex-col">
                                        <span className="text-sm text-text font-medium">{entry.ip}</span>
                                    </div>
                                    <Button color="red" className="w-auto py-1.5 px-3 gap-1" onClick={() => unbanIp(entry)}>
                                        <UserX className="w-4 h-4" />
                                        <span className="text-xs">Unban</span>
                                    </Button>
                                </div>
                                {entry.reason && (
                                    <p className="text-[11px] text-text-2 pt-2">
                                        {entry.reason}
                                    </p>
                                )}
                            </div>
                        ))}
                    </div>

                </div>
            </div>
        </>
    );
}
