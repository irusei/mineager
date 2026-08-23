import { useEffect, useState } from "react";
import { FrontendServer, ServerType } from "../../../types/types.tsx";
import { Check, X, Cpu, Trash2, FolderOpen } from "lucide-react";
import Button from "../../ui/Button.tsx";
import { ConfirmModal } from "../../ui/Modal.tsx";
import { invoke } from "@tauri-apps/api/core";
import { SettingContainer } from "../../ui/SettingContainer.tsx";
import { Input } from "../../ui/Input.tsx";
import { Select } from "../../ui/Select.tsx";
import { Slider } from "../../ui/Slider.tsx";
import { sortVersions } from "../../../utils/versions.ts";
import { open } from "@tauri-apps/plugin-dialog";
import { Switch } from "../../ui/Switch.tsx";

interface ServerSettingsProps {
  server: FrontendServer;
}
export function ServerSettings({ server }: ServerSettingsProps) {
  const [settingServer, setSettingServer] = useState<FrontendServer>(server);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [availableVersions, setAvailableVersions] = useState<string[]>([]);

  useEffect(() => {
    async function fetchAvailableVersions() {
      const versions = (await invoke("fetch_versions", {
        serverType: settingServer.server.server_type,
      })) as string[];
      const newVersions = sortVersions(versions);
      setAvailableVersions(newVersions);
    }

    setAvailableVersions([]);
    fetchAvailableVersions();
  }, [settingServer.server.server_type]);

  async function applySettings() {
    await invoke("update_server", { server: settingServer.server });
  }

  async function deleteServer() {
    await invoke("remove_server", { serverId: server.server.server_id });
    setShowDeleteModal(false);
  }
  useEffect(() => {
    setSettingServer(server);
  }, [server.server.server_id, server.server.java_path]);

  return (
    <>
      <div className="flex-1 bg-bg-2 flex flex-col">
        <div className="max-h-100 overflow-y-scroll pb-10">
          <div className="p-3">
            <div className="flex items-center gap-2 mb-3">
              <Cpu className="w-4 h-4 text-mauve" />
              <p className="text-base font-semibold text-mauve">
                Java Settings
              </p>
            </div>
            <div>
              <SettingContainer
                name="Java Path"
                description={
                  <span>
                    Path to your version-compatible Java executable file. <br />
                    This will be used to launch the server.
                  </span>
                }
              >
                <div className="flex gap-2">
                  <Input
                    type="text"
                    placeholder="C:\path\to\java.exe"
                    value={settingServer.server.java_path}
                    onChange={(event) => {
                      setSettingServer((oldSettingServer) => ({
                        ...oldSettingServer,
                        server: {
                          ...oldSettingServer.server,
                          java_path: event.target.value,
                        },
                      }));
                    }}
                  />
                  <Button
                    className={"px-2"}
                    onClick={async () => {
                      const selected = await open({
                        title: "Select Java executable",
                        multiple: false,
                        filters: [
                          {
                            name: "Java",
                            extensions: ["exe"],
                          },
                        ],
                      });
                      if (selected) {
                        setSettingServer((oldSettingServer) => ({
                          ...oldSettingServer,
                          server: {
                            ...oldSettingServer.server,
                            java_path: selected,
                          },
                        }));
                      }
                    }}
                    color="primary"
                  >
                    <FolderOpen className="w-4 h-4" />
                    <></>
                  </Button>
                </div>
              </SettingContainer>
              <SettingContainer
                name="Jar Path"
                description={
                  <span>
                    Path to your Minecraft server .jar file. <br />
                    This will be used to launch the server.
                  </span>
                }
              >
                <div className="flex gap-2">
                  <Input
                    type="text"
                    placeholder="server.jar"
                    value={settingServer.server.jar_path}
                    onChange={(event) => {
                      setSettingServer((oldSettingServer) => ({
                        ...oldSettingServer,
                        server: {
                          ...oldSettingServer.server,
                          jar_path: event.target.value,
                        },
                      }));
                    }}
                  />
                  <Button
                    className={"px-2"}
                    onClick={async () => {
                      const selected = await open({
                        title: "Select Jar file",
                        multiple: false,
                        filters: [
                          {
                            name: "Jar",
                            extensions: [".jar"],
                          },
                        ],
                      });
                      if (selected) {
                        setSettingServer((oldSettingServer) => ({
                          ...oldSettingServer,
                          server: {
                            ...oldSettingServer.server,
                            jar_path: selected,
                          },
                        }));
                      }
                    }}
                    color="primary"
                  >
                    <FolderOpen className="w-4 h-4" />
                    <></>
                  </Button>
                </div>
              </SettingContainer>
              <SettingContainer
                name="Launch Arguments"
                description="Java arguments used to launch the server."
              >
                <Input
                  type="text"
                  value={settingServer.server.launch_args.custom}
                  onChange={(event) => {
                    setSettingServer((oldSettingServer) => ({
                      ...oldSettingServer,
                      server: {
                        ...oldSettingServer.server,
                        launch_args: {
                          ...oldSettingServer.server.launch_args,
                          custom: event.target.value,
                        },
                      },
                    }));
                  }}
                />
              </SettingContainer>
              <SettingContainer
                name={"Force IPv4"}
                description={
                  "Prefer IPv4 over IPv6. Can fix issues with binding ports."
                }
              >
                <Switch
                  checked={settingServer.server.launch_args.force_ipv4}
                  onChecked={(checked) =>
                    setSettingServer((oldSettingServer) => ({
                      ...oldSettingServer,
                      server: {
                        ...oldSettingServer.server,
                        launch_args: {
                          ...oldSettingServer.server.launch_args,
                          force_ipv4: checked,
                        },
                      },
                    }))
                  }
                />
              </SettingContainer>
              <SettingContainer
                name="Aikar's Flags"
                description="Apply Aikar's flags for better server performance."
              >
                <Switch
                  checked={settingServer.server.launch_args.aikars_flags}
                  onChecked={(checked) =>
                    setSettingServer((oldSettingServer) => ({
                      ...oldSettingServer,
                      server: {
                        ...oldSettingServer.server,
                        launch_args: {
                          ...oldSettingServer.server.launch_args,
                          aikars_flags: checked,
                        },
                      },
                    }))
                  }
                />
              </SettingContainer>
              <SettingContainer
                name="Allocated RAM"
                description="Maximum RAM that can be used on the server."
              >
                <Slider
                  min={512}
                  max={12288}
                  step={512}
                  value={
                    isNaN(parseInt(settingServer.server.allocated_ram))
                      ? 4096
                      : parseInt(settingServer.server.allocated_ram)
                  }
                  unit="M"
                  onChange={(mb) => {
                    setSettingServer((oldSettingServer) => ({
                      ...oldSettingServer,
                      server: {
                        ...oldSettingServer.server,
                        allocated_ram: `${mb}M`,
                      },
                    }));
                  }}
                />
              </SettingContainer>
            </div>
          </div>

          <div className="p-3">
            <div className="flex items-center gap-2 mb-3">
              <Trash2 className="w-4 h-4 text-red" />
              <p className="text-base font-semibold text-red">Danger Zone</p>
            </div>
            {server.server.server_type != "Archive" && (
              <>
                <SettingContainer name="Server Jar" description="">
                  <Select
                    disabled={server.status === "Online"}
                    value={settingServer.server.server_type}
                    options={["Vanilla", "Paper"]}
                    setValue={(newValue) => {
                      setSettingServer((oldSettingServer) => ({
                        ...oldSettingServer,
                        server: {
                          ...oldSettingServer.server,
                          server_type: newValue as ServerType,
                        },
                      }));
                    }}
                  />
                </SettingContainer>
                {availableVersions.length > 0 && (
                  <SettingContainer
                    name="Version"
                    description="The version of the server."
                  >
                    <Select
                      disabled={server.status === "Online"}
                      value={(() => {
                        if (
                          availableVersions.indexOf(
                            settingServer.server.server_version,
                          ) !== -1
                        )
                          return settingServer.server.server_version;
                        return availableVersions[availableVersions.length - 1];
                      })()}
                      options={availableVersions}
                      setValue={(newValue) => {
                        setSettingServer((oldSettingServer) => ({
                          ...oldSettingServer,
                          server: {
                            ...oldSettingServer.server,
                            server_version: newValue,
                          },
                        }));
                      }}
                    />
                  </SettingContainer>
                )}
              </>
            )}
            <SettingContainer
              name="Delete Server"
              description="Delete the server. All data will be lost."
            >
              <Button
                className={"w-1/2"}
                disabled={server.status === "Online"}
                color="red"
                title={
                  server.status === "Online"
                    ? "The server must be turned off."
                    : ""
                }
                onClick={() => setShowDeleteModal(true)}
              >
                <X className="w-4 h-4" />
                <span>Delete</span>
              </Button>
            </SettingContainer>
          </div>
        </div>
        <div className="sticky bottom-0 flex flex-row w-full space-x-4 bg-bg-2 border-t border-border p-2.5">
          <Button onClick={() => applySettings()} color={"primary"}>
            <Check className={"w-4 h-4"} />
            <p>Apply</p>
          </Button>
          <Button onClick={() => setSettingServer(server)} color={"red"}>
            <X className={"w-4 h-4"} />
            <p>Revert</p>
          </Button>
        </div>
      </div>
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Server"
        description="Are you sure you want to do this? All data will be lost."
        confirmText="Delete"
        onConfirm={deleteServer}
        confirmColor="primary"
        cancelText="Cancel"
      />
    </>
  );
}
