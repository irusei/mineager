import { useEffect, useState } from "react";
import {FrontendServer} from "../../../types/types.tsx";
import { Check, X, Settings, Globe } from "lucide-react";
import Button from "../../ui/Button.tsx";
import { invoke } from "@tauri-apps/api/core";
import { SettingContainer } from "../../ui/SettingContainer.tsx";
import { Input } from "../../ui/Input.tsx";
import { Switch } from "../../ui/Switch.tsx";
import { Select } from "../../ui/Select.tsx";
import { NoPropertiesFound } from "../placeholders/NoPropertiesFound.tsx";

interface ServerPropertiesProps { 
    server: FrontendServer
}

function getMapFromProperties(propertiesStr: string[]) {
    let map: Map<string, string> = new Map<string, string>();
    for (const line of propertiesStr) {
        if (!line.includes("="))
            continue

        const lineSplit = line.split("=", 2);
        const key = lineSplit[0];
        const value = lineSplit[1];

        map.set(key, value);
    }

    return map;
}

function propertiesMapToString(propertiesMap: Map<string, string>) {
    let properties: string = ""
    for (const record of propertiesMap) {
        properties += record[0] + "=" + record[1];
        properties += "\n";
    }
    return properties.substring(0, properties.length - 1);
}

export function ServerProperties({ server }: ServerPropertiesProps) {
    const [serverProperties, setServerProperties] = useState<Map<string, string> | null>(null);

    function modifyPropertyState(key: string, newValue: string) {
        setServerProperties((oldProperties) => {
            if (oldProperties === null) return null;
            const properties = new Map(oldProperties);
            properties.set(key, newValue);
            return properties;
        });
    }

    const getBoolPropertyState = (key: string) => serverProperties?.get(key) == "true";
    function modifyBoolPropertyState(key: string, newValue: boolean) {
        setServerProperties((oldProperties) => {
            if (oldProperties === null) return null;
            const properties = new Map(oldProperties);
            properties.set(key, newValue ? "true" : "false");
            return properties;
        });
    }

    function applyProperties() {
        if (serverProperties != null)
            invoke('write_properties', { serverId: server.server.server_id, newProperties: propertiesMapToString(serverProperties) });
    }

    function reloadProperties() {
        invoke("read_properties_lines", { serverId: server.server.server_id }).then((p) => {
            let properties = p as string[];
            if (properties.length > 0)
                setServerProperties(getMapFromProperties(properties))
            else
                setServerProperties(null);
        });
    }

    // load properties on load
    useEffect(() => {
        reloadProperties()
    }, [server.server.server_id]);

    if (serverProperties === null)
        return <NoPropertiesFound />;
        
    return (
        <>
            <div className="flex-1 h-full bg-bg-2 flex flex-col space-y-4 pb-4">

            <div className={"flex flex-col max-h-100.25 h-100.25 overflow-y-scroll scrollbar-hide"}>
                <div className="bg-bg-2 p-3">
                    <div className="flex items-center gap-2 mb-3">
                        <Settings className="w-4 h-4 text-mauve" />
                        <p className={"text-base font-semibold text-mauve"}>General Settings</p>
                    </div>
                    <div>
                        {serverProperties.has('server-port') &&
                            <SettingContainer name={"Server Port"} description={"The server will run on this port"}>
                                <Input type={"number"} placeholder={"25565"}
                                    value={serverProperties.get("server-port")!}
                                    onChange={(event) => modifyPropertyState("server-port", event.target.value)}/>
                            </SettingContainer>
                        }
                        {serverProperties.has("max-players") &&
                            <SettingContainer name={"Max Players"} description={"The maximum amount of players"}>
                                <Input type={"number"} placeholder={"20"}
                                    value={serverProperties.get("max-players")!}
                                    onChange={(event) => modifyPropertyState("max-players", event.target.value)}/>
                            </SettingContainer>
                        }
                        {serverProperties.has("online-mode") &&
                            <SettingContainer name={"Online Mode"} description={"Players must be authenticated to join"}>
                                <Switch checked={getBoolPropertyState("online-mode")} onChecked={(checked) => modifyBoolPropertyState("online-mode", checked)}/>
                            </SettingContainer>
                        }
                    </div>
                </div>

                <div className="bg-bg-2 p-3">
                    <div className="flex items-center gap-2 mb-3">
                        <Globe className="w-4 h-4 text-mauve" />
                        <p className={"text-base font-semibold text-mauve"}>World Settings</p>
                    </div>
                    <div>
                        {serverProperties.has("difficulty") &&
                            <SettingContainer name={"Difficulty"} description={"The difficulty of the world"}>
                                <Select value={serverProperties.get("difficulty")!} options={["easy", "normal", "hard", "peaceful"]} setValue={(newValue) => modifyPropertyState("difficulty", newValue)}/>
                            </SettingContainer>
                        }
                        {serverProperties.has("hardcore") &&
                            <SettingContainer name={"Hardcore"} description={"Perma-death mode"}>
                                <Switch checked={getBoolPropertyState("hardcore")} onChecked={(checked) => modifyBoolPropertyState("hardcore", checked)}/>
                            </SettingContainer>
                        }
                        {serverProperties.has("gamemode") &&
                            <SettingContainer name={"Gamemode"} description={"The default gamemode"}>
                                <Select value={serverProperties.get("gamemode")!} options={["survival", "creative", "adventure", "spectator"]} setValue={(newValue) => modifyPropertyState("gamemode", newValue)}/>
                            </SettingContainer>
                        }
                        {serverProperties.has("spawn-protection") &&
                            <SettingContainer name={"Spawn Protection"} description={"The size (in blocks) of the spawn protected area"}>
                                <Input type={"number"} placeholder={"16"}
                                    value={serverProperties.get("spawn-protection")!}
                                    onChange={(event) => modifyPropertyState("spawn-protection", event.target.value)}/>
                            </SettingContainer>
                        }
                        {serverProperties.has("view-distance") &&
                            <SettingContainer name={"Allowed Render Distance"} description={"The maximum render distance a player can have"}>
                                <Input type={"number"} placeholder={"10"}
                                    value={serverProperties.get("view-distance")!}
                                    onChange={(event) => modifyPropertyState("view-distance", event.target.value)}/>
                            </SettingContainer>
                        }
                        {serverProperties.has("simulation-distance") &&
                            <SettingContainer name={"Simulation Distance"} description={"How many chunks around the player the server updates"}>
                                <Input type={"number"} placeholder={"10"}
                                    value={serverProperties.get("simulation-distance")!}
                                    onChange={(event) => modifyPropertyState("simulation-distance", event.target.value)}/>
                            </SettingContainer>
                        }
                        {serverProperties.has("level-name") &&
                            <SettingContainer name={"World Name"} description={"The name of the world folder"}>
                                <Input type={"text"} placeholder={"Unnamed World"}
                                    value={serverProperties.get("level-name")!}
                                    onChange={(event) => modifyPropertyState("level-name", event.target.value)}/>
                            </SettingContainer>
                        }
                        {serverProperties.has("level-seed") &&
                            <SettingContainer name={"World Seed"} description={"The seed for world generation"}>
                                <Input type={"text"}
                                    value={serverProperties.get("level-seed")!}
                                    onChange={(event) => modifyPropertyState("level-seed", event.target.value)}/>
                            </SettingContainer>
                        }
                        {serverProperties.has("level-type") &&
                            <SettingContainer name={"World Type"} description={"The type of the world. Make sure to escape colons"}>
                                <Input type={"text"} placeholder={"minecraft\\:normal"}
                                    value={serverProperties.get("level-type")!}
                                    onChange={(event) => modifyPropertyState("level-type", event.target.value)}/>
                            </SettingContainer>
                        }
                    </div>
                </div>
            </div>
        </div>
        <div className={"flex flex-row w-full space-x-4 bg-bg-2 border-t border-border p-2.5"}>
            <Button onClick={() => applyProperties()} color={"primary"}>
                <Check className={"w-4 h-4"}/>
                <p>Apply</p>
            </Button>
            <Button onClick={() => reloadProperties()} color={"red"}>
                <X className={"w-4 h-4"}/>
                <p>Revert</p>
            </Button>
        </div>
        </>
    );
}