import { useEffect, useState } from "react";
import { FrontendServer } from "../../../types/types.tsx";
import { invoke } from "@tauri-apps/api/core";
import { FolderArchive, Download, Trash2, Loader2 } from "lucide-react";
import Button from "../../ui/Button.tsx";
import { SettingContainer } from "../../ui/SettingContainer.tsx";
import { ConfirmModal } from "../../ui/Modal.tsx";

interface ServerBackupsProps {
    server: FrontendServer
}

interface BackupEntry {
    name: string;
    size: number;
}

export function ServerBackups({ server }: ServerBackupsProps) {
    const [backups, setBackups] = useState<BackupEntry[]>([]);
    const [showLoading, setShowLoading] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState<string | null>(null);
    const [showRestoreModal, setShowRestoreModal] = useState<string | null>(null);

    async function loadBackups() {
        const result = await invoke("get_backups", { serverId: server.server.server_id }) as BackupEntry[];
        setBackups(result);
    }

    async function createBackup() {
        setShowLoading(true);
        await invoke("create_backup", { serverId: server.server.server_id });
        await loadBackups();
        setShowLoading(false);
    }

    async function doDeleteBackup() {
        if (!showDeleteModal) return;
        await invoke("delete_backup", { serverId: server.server.server_id, backupName: showDeleteModal });
        setShowDeleteModal(null);
        await loadBackups();
    }

    async function doRestoreBackup() {
        if (!showRestoreModal) return;
        setShowLoading(true);
        setShowRestoreModal(null);
        await invoke("restore_backup", { serverId: server.server.server_id, backupName: showRestoreModal });
        setShowLoading(false);
        await loadBackups();
    }

    function formatBackupDate(filename: string): string {
        const timestamp = parseInt(filename.replace(".zip", ""));
        const date = new Date(timestamp);
        return date.toLocaleString();
    }

    function formatSize(bytes: number): string {
        const KB = 1024;
        const MB = KB * 1024;
        const GB = MB * 1024;
        if (bytes < KB) return bytes + " B";
        if (bytes < MB) return (bytes / KB).toFixed(1) + " KB";
        if (bytes < GB) return (bytes / MB).toFixed(1) + " MB";
        return (bytes / GB).toFixed(2) + " GB";
    }

    useEffect(() => {
        loadBackups();
    }, [server.server.server_id]);

    return (
        <div className="flex-1 h-full min-h-120 max-h-120 bg-bg-2 flex flex-col">
            <div className="relative flex flex-col flex-1 overflow-hidden p-3">
                <div className="flex items-center gap-2 mb-3">
                    <FolderArchive className="w-5 h-5 text-orange-500" />
                    <p className="text-base font-semibold text-orange-500">Backups</p>
                </div>

                <div className="mb-4">
                    <SettingContainer name="Create Backup" description="Create a backup of the server directory.">
                        <Button onClick={createBackup} className="w-1/2" color="orange" disabled={showLoading}>
                            <Download className="w-5 h-5" />
                            <span>Create Backup</span>
                        </Button>
                    </SettingContainer>
                </div>

                <div className="flex-1 overflow-y-auto scrollbar-hide space-y-2">
                    {backups.length === 0 && (
                        <p className="text-text-2 text-sm text-center py-4">No backups yet</p>
                    )}
                    {backups.map((backup) => (
                        <div key={backup.name} className={`flex flex-row items-center justify-between bg-bg-1 border border-border rounded-lg p-3`}>
                            <div className="flex flex-col">
                                <span className="text-sm text-text">{formatBackupDate(backup.name)}</span>
                                <span className="text-xs text-text-2 font-mono">{backup.name}</span>
                                <span className="text-xs text-text-2">{formatSize(backup.size)}</span>
                            </div>
                            <div className="flex flex-row gap-2">
                                <Button onClick={() => setShowRestoreModal(backup.name)} disabled={server.status === "Online"} color="blue" className="w-auto py-1.5 px-3 gap-1">
                                    <Download className="w-4 h-4" />
                                    <span className="text-xs">Restore</span>
                                </Button>
                                <Button onClick={() => setShowDeleteModal(backup.name)} color="red" className="w-auto py-1.5 px-3 gap-1">
                                    <Trash2 className="w-4 h-4" />
                                    <span className="text-xs">Delete</span>
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
                {showLoading && (
                    <div className="absolute inset-0 bg-bg-2/80 backdrop-blur-sm flex items-center justify-center z-10">
                        <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
                    </div>
                )}
                <ConfirmModal
                    isOpen={showDeleteModal !== null}
                    onClose={() => setShowDeleteModal(null)}
                    title="Delete Backup"
                    description={`Are you sure you want to delete ${showDeleteModal || ""}?`}
                    confirmText="Delete"
                    onConfirm={doDeleteBackup}
                    confirmColor="blue"
                    cancelText="Cancel"
                />
                <ConfirmModal
                    isOpen={showRestoreModal !== null}
                    onClose={() => setShowRestoreModal(null)}
                    title="Restore Backup"
                    description={`Restore from ${showRestoreModal || ""}? This will overwrite the current server data.`}
                    confirmText="Restore"
                    onConfirm={doRestoreBackup}
                    confirmColor="blue"
                    cancelText="Cancel"
                />
            </div>
        </div>
    );
}
