import { useEffect, useRef, useState } from "react";
import {MinecraftServer} from "../../../types/types.tsx";
import {Check, ChevronRight, Terminal} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { useInterval } from "usehooks-ts";
import Button from "../../ui/Button.tsx";
import { getConsoleColor } from "../../../utils/colors.ts";

interface ServerConsoleProps {
    server: MinecraftServer
}
export function ServerConsole({ server }: ServerConsoleProps) {
    const consoleRef = useRef<HTMLDivElement>(null);
    const [consoleInput, setConsoleInput] = useState<string>();
    const [consoleOutput, setConsoleOutput] = useState<string[]>(["Server offline"]);
    const [shouldScroll, setShouldScroll] = useState<boolean>(false);
    const [eulaVisible, setEulaVisible] = useState<boolean>(false);
    const [eulaNagging, setEulaNagging] = useState<boolean>(true);


    function shouldScrollToBottom() {
        const consoleDiv: HTMLDivElement | null = consoleRef.current;
        if (consoleDiv === null) return false;

        const height = Math.abs(consoleDiv.scrollHeight - consoleDiv.scrollTop)
        return height <= consoleDiv.clientHeight
    }

    function scrollToBottom() {
        const consoleDiv: HTMLDivElement | null = consoleRef.current;
        if (consoleDiv === null) return;
        if (consoleDiv.children.length > 0)
            consoleDiv.children[consoleDiv.children.length - 1].scrollIntoView();
    }

    function fetchConsole() {
        if (server.status === "Online") {
            invoke("get_stdout", { serverId: server.server_id }).then((res) => {
                let response: string[] = res as string[];
                if (response.length > 0)
                    if (consoleOutput != response) {
                        setShouldScroll(shouldScrollToBottom())
                        setConsoleOutput(response);
                    }
            })
        }
    }

    // Refresh console on server change
    useEffect(() => {
        setConsoleOutput(["Server offline"]);
        fetchConsole();
    }, [server.server_id]);
    
    // Console output monitoring
    useEffect(() => {
        // Show eula model if should
        if (eulaNagging && consoleOutput.length > 0 && consoleOutput[consoleOutput.length - 1].includes("eula.txt")) {
            setEulaNagging(false);
            setEulaVisible(true);
        }

        // scroll
        if (shouldScroll)
            scrollToBottom();
    }, [consoleOutput])

    // TODO: redo this and make it not use intervals so it's more optimized
    useInterval(() => {
        fetchConsole();
    }, 200)

    function acceptEula() {
        invoke('set_eula_accepted', { serverId: server.server_id, accepted: true}).then(() => {
            invoke('start_server', { serverId: server.server_id })
        });

        setEulaVisible(false);
    }
    return (
        <>
            <div className="flex-1 p-4 bg-neutral-900">
                {/* Console Container */}
                <div className="rounded-lg flex flex-col h-full w-full bg-neutral-900 border-zinc-800 border">
                    {/* Console Header */}
                    <div className="bg-zinc-800 h-12 rounded-t-lg p-3 text-gray-300 flex flex-row items-center gap-x-2">
                        <Terminal className="w-5 h-5" />
                        <p className="text-sm font-medium">Console Output</p>
                    </div>

                    {/* Console Body */}
                    <div ref={consoleRef} className="flex-1 p-4 min-h-90 max-h-90 h-90 overflow-y-scroll font-mono text-sm scrollbar-hide">
                        {consoleOutput.map((line, index) => (
                            <p key={index} className={getConsoleColor(line)}>{line}</p>
                        ))}
                    </div>

                    {/* Console Input */}
                    <div className="bg-zinc-800 h-12 rounded-b-lg p-3 text-gray-300 flex flex-row items-center gap-x-2">
                        <ChevronRight className="w-5 h-5" />
                        <input
                            type="text"
                            className="flex-1 h-full bg-transparent focus:outline-none text-gray-300 font-mono placeholder-gray-500"
                            placeholder="Enter a command..."
                            value={consoleInput}
                            onChange={(e) => setConsoleInput(e.target.value)}
                            onKeyUp={(e) => {
                                if (e.keyCode === 13) {
                                    invoke("write_stdin", { serverId: server.server_id, string: consoleInput });
                                    setConsoleInput("");
                                }
                            }}
                        />
                    </div>
                </div>
            </div>
            {eulaVisible && 
                <div className={"z-50 fixed left-0 top-0 items-center w-screen h-screen backdrop-blur-sm flex justify-center"}>
                    <div className={"w-100 h-75 bg-neutral-900 rounded-lg border-zinc-800 border flex flex-col"}>
                        <div className={"w-full h-15 text-gray-300 font-medium text-2xl py-2 px-4 flex flex-row space-y-2 border-zinc-800 border-b items-center"}>
                            <p>Eula</p>
                        </div>
                        <div className={"w-full text-gray-300 font-medium text-lg p-4 border-zinc-800 border-b items-center flex"}>
                            I affirm that I have read and familiarized myself with the Minecraft Mojang EULA and understand its terms and guidelines.
                        </div>
                        <div className={"w-full items-center flex flex-col space-y-3 px-2 py-3"}>
                            <Button onClick={() => acceptEula()} color={"blue"}>
                                <Check/>
                                <p>I accept</p>
                            </Button>
                            <Button onClick={() => setEulaVisible(false)} color={"red"}>
                                <Check/>
                                <p>I decline</p>
                            </Button>
                        </div>
                    </div>
                </div>
            }
        </>
    );
}