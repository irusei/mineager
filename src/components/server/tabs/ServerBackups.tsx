import { useEffect, useRef, useState } from "react";
import { Backup, FrontendServer } from "../../../types/types.tsx";
import { invoke } from "@tauri-apps/api/core";
import {
  FolderArchive,
  Download,
  Trash2,
  Loader2,
  Settings,
  FolderOpen,
} from "lucide-react";
import Button from "../../ui/Button.tsx";
import { SettingContainer } from "../../ui/SettingContainer.tsx";
import { Switch } from "../../ui/Switch.tsx";
import { Input } from "../../ui/Input.tsx";
import { ConfirmModal } from "../../ui/Modal.tsx";

interface ServerBackupsProps {
  server: FrontendServer;
}

export function ServerBackups({ server }: ServerBackupsProps) {
  const [showLoading, setShowLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [showRestoreModal, setShowRestoreModal] = useState<boolean>(false);
  const [selectedBackup, setSelectedBackup] = useState<Backup | null>(null);
  const [tmpIntervalInputText, setTmpIntervalInputText] = useState<string>(
    server.server.backup_settings.auto_backup_interval,
  );

  const [backupSettings, setBackupSettings] = useState(
    server.server.backup_settings,
  );

  // send backup settings to backend on change
  useEffect(() => {
    invoke("update_auto_backup", {
      serverId: server.server.server_id,
      settings: backupSettings,
    });

    setTmpIntervalInputText(backupSettings.auto_backup_interval);
  }, [backupSettings]);

  useEffect(() => {
    setBackupSettings(server.server.backup_settings);
  }, [server.server.server_id]);

  async function createBackup() {
    setShowLoading(true);
    await invoke("create_backup", { serverId: server.server.server_id });
    setShowLoading(false);
  }

  async function doDeleteBackup() {
    if (!showDeleteModal) return;
    if (!selectedBackup) return;

    await invoke("delete_backup", {
      serverId: server.server.server_id,
      backup: selectedBackup,
    });

    setSelectedBackup(null);
    setShowDeleteModal(false);
  }

  async function openBackupFolder() {
    await invoke("open_backup_folder", { serverId: server.server.server_id });
  }

  async function doRestoreBackup() {
    if (!showRestoreModal) return;
    if (!selectedBackup) return;

    setShowRestoreModal(false);
    setShowLoading(true);
    await invoke("restore_backup", {
      serverId: server.server.server_id,
      backup: selectedBackup,
    });

    setSelectedBackup(null);
    setShowLoading(false);
  }

  function formatBackupDate(filename: string): string {
    const timestamp = parseInt(filename.replace(".zip", ""));
    const date = new Date(timestamp);
    return date.toLocaleString();
  }

  function formatSize(bytes: number): string {
    const KB = 1024;
    const MB = KB * KB;
    const GB = MB * KB;
    if (bytes < KB) return bytes + " B";
    if (bytes < MB) return (bytes / KB).toFixed(1) + " KB";
    if (bytes < GB) return (bytes / MB).toFixed(1) + " MB";
    return (bytes / GB).toFixed(2) + " GB";
  }

  return (
    <div className="flex-1 min-h-120 max-h-120 bg-bg-2 flex flex-col">
      <div className="relative min-h-120 max-h-120 p-3 overflow-y-scroll pb-10">
        <div className="flex items-center gap-2 mb-3">
          <Settings className="w-4 h-4 text-mauve" />
          <p className="text-base font-semibold text-mauve">Backup Settings</p>
        </div>
        <div className="mb-4">
          <SettingContainer
            name="Create Backup"
            description="Create a backup of the server directory."
          >
            <Button
              onClick={createBackup}
              className="w-1/2"
              color="primary"
              disabled={showLoading}
            >
              <Download className="w-4 h-4" />
              <span>Create Backup</span>
            </Button>
          </SettingContainer>
          <SettingContainer
            name="Backup on Startup"
            description="Create a backup automatically every time the server starts."
          >
            <div className="flex items-center gap-3">
              <Switch
                checked={backupSettings.auto_backup_on_start}
                onChecked={(checked) =>
                  setBackupSettings({
                    ...backupSettings,
                    auto_backup_on_start: checked,
                  })
                }
              />
            </div>
          </SettingContainer>
          <SettingContainer
            name="Auto Backups"
            description="Automatically backup the server at a set interval."
          >
            <div className="flex items-center gap-3">
              <Switch
                checked={backupSettings.auto_backups}
                onChecked={(checked) => {
                  setBackupSettings({
                    ...backupSettings,
                    auto_backups: checked,
                  });
                }}
              />
            </div>
          </SettingContainer>
          {backupSettings.auto_backups && (
            <div className="mt-2">
              <SettingContainer
                name="Backup Interval"
                description="Cron expression for backup schedule (0 0 * * * * for every hour, format: sec min hour dom month dow)"
              >
                <div className="flex items-center gap-2">
                  <Input
                    type="text"
                    placeholder="0 0 * * * *"
                    value={tmpIntervalInputText}
                    onChange={(e) => setTmpIntervalInputText(e.target.value)}
                    onBlur={(event) => {
                      setBackupSettings({
                        ...backupSettings,
                        auto_backup_interval: event.target.value,
                      });
                    }}
                    className="flex-1"
                  />
                </div>
              </SettingContainer>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <FolderArchive className="w-4 h-4 text-mauve" />
            <p className="text-base font-semibold text-mauve">Backups</p>
          </div>
          <Button
            onClick={openBackupFolder}
            color="primary"
            className="w-auto py-1.5 px-2 gap-1"
          >
            <FolderOpen className="w-4 h-4" />
            <></>
          </Button>
        </div>
        <div className="flex-1 space-y-2">
          {server.server.backups.length === 0 && (
            <p className="text-text-2 text-sm text-center py-4">
              No backups yet
            </p>
          )}
          {server.server.backups.map((backup) => (
            <div
              key={backup.file_name}
              className={`flex flex-row items-center justify-between bg-bg-1 border border-border rounded-lg p-3`}
            >
              <div className="flex flex-col">
                <span className="text-sm text-text">
                  {formatBackupDate(backup.file_name)}
                </span>
                <span className="text-xs text-text-2 font-mono">
                  {backup.file_name}
                </span>
                <span className="text-xs text-text-2">
                  {formatSize(backup.size)}
                </span>
              </div>
              <div className="flex flex-row gap-2">
                <Button
                  onClick={() => {
                    setSelectedBackup(backup);
                    setShowRestoreModal(true);
                  }}
                  disabled={server.status === "Online"}
                  color="primary"
                  className="w-auto py-1.5 px-3 gap-1"
                >
                  <Download className="w-4 h-4" />
                  <span className="text-xs">Restore</span>
                </Button>
                <Button
                  onClick={() => {
                    setSelectedBackup(backup);
                    setShowDeleteModal(true);
                  }}
                  color="red"
                  className="w-auto py-1.5 px-3 gap-1"
                >
                  <Trash2 className="w-4 h-4" />
                  <span className="text-xs">Delete</span>
                </Button>
              </div>
            </div>
          ))}
        </div>
        {showLoading && (
          <div className="absolute inset-0 bg-bg-2/80 backdrop-blur-sm flex items-center justify-center z-10">
            <Loader2 className="w-10 h-10 text-mauve animate-spin" />
          </div>
        )}
        <ConfirmModal
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          title="Delete Backup"
          description={`Are you sure you want to delete ${selectedBackup?.file_name}?`}
          confirmText="Delete"
          onConfirm={doDeleteBackup}
          confirmColor="primary"
          cancelText="Cancel"
        />
        <ConfirmModal
          isOpen={showRestoreModal}
          onClose={() => setShowRestoreModal(false)}
          title="Restore Backup"
          description={`Restore from ${selectedBackup?.file_name}? This will overwrite the current server data.`}
          confirmText="Restore"
          onConfirm={doRestoreBackup}
          confirmColor="primary"
          cancelText="Cancel"
        />
      </div>
    </div>
  );
}
