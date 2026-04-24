import { useEffect, useRef, useState } from "react";
import { FrontendServer } from "../../../types/types.tsx";
import { invoke } from "@tauri-apps/api/core";
import { getConsoleColor } from "../../../utils/colors.ts";
import { listen } from "@tauri-apps/api/event";
import { Terminal, Play, Square } from "lucide-react";
import { Modal } from "../../ui/Modal";
import Button from "../../ui/Button";
interface ConsoleUpdatePayload {
    server_id: string;
    line: string;
}

interface ServerConsoleProps {
    server: FrontendServer;
    startServer: () => void;
    stopServer: () => void;
}

export function ServerConsole({ server, startServer, stopServer }: ServerConsoleProps) {
    const consoleRef = useRef<HTMLDivElement>(null);
    const [consoleInput, setConsoleInput] = useState<string>("");
    const [consoleOutput, setConsoleOutput] = useState<string[]>(["Server offline"]);
    const [shouldScroll, setShouldScroll] = useState<boolean>(false);
    const [eulaVisible, setEulaVisible] = useState<boolean>(false);

    function shouldScrollToBottom() {
        const consoleDiv: HTMLDivElement | null = consoleRef.current;
        if (consoleDiv === null) return false;
        const height = Math.abs(consoleDiv.scrollHeight - consoleDiv.scrollTop);
        return height <= consoleDiv.clientHeight + 30;
    }

    function scrollToBottom() {
        const consoleDiv: HTMLDivElement | null = consoleRef.current;
        if (consoleDiv === null) return;
        consoleDiv.scrollTop = consoleDiv.scrollHeight;
    }

    function fetchConsole() {
        if (server.status === "Online") {
            invoke("get_stdout", { serverId: server.server.server_id }).then((res) => {
                let response: string[] = res as string[];
                if (response.length > 0) {
                    if (consoleOutput != response) {
                        setShouldScroll(shouldScrollToBottom())
                        setConsoleOutput(response);
                    }
                }
            })
        }
    }    
    useEffect(() => {
        const consoleUpdateUnlisten = listen('console-update', (event) => {
            const consoleUpdatePayload = event.payload as ConsoleUpdatePayload;
            if (consoleUpdatePayload.server_id === server.server.server_id) {
                setShouldScroll(shouldScrollToBottom());
                setConsoleOutput((oldConsoleOutput) => ([
                    ...oldConsoleOutput,
                    consoleUpdatePayload.line
                ]));
            }
        });

        setConsoleOutput(["Server offline"]);
        fetchConsole(); // refresh console on server change
        
        return () => {
            consoleUpdateUnlisten.then((ul) => ul());
        };
    }, [server.server.server_id]);

    useEffect(() => {
        if (consoleOutput.length > 0 && consoleOutput[consoleOutput.length - 1].includes("eula.txt")) {
            setEulaVisible(true);
        }

        if (shouldScroll)
            scrollToBottom();
    }, [consoleOutput]);

    async function acceptEula() {
        await invoke('set_eula_accepted', { serverId: server.server.server_id, accepted: true });
        await invoke('start_server', { serverId: server.server.server_id });
        setEulaVisible(false);
    }

    async function handleCommand() {
        if (consoleInput.trim() === "") return;
        await invoke("write_stdin", { serverId: server.server.server_id, string: consoleInput });
        setConsoleInput("");
    }

    function handleKeyUp(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === "Enter") {
            handleCommand();
        }
    }

    return (
        <div className="flex-1 h-full bg-bg-1 flex flex-col gap-3">
            <div className="flex-1 flex flex-col bg-bg-2 border-b border-border overflow-hidden">
                <div className="px-4 py-3 flex items-center justify-between border-b border-border">
                    <div className="flex items-center gap-3">
                        <Terminal className="w-4 h-4 text-mauve" />
                        <div>
                            <h2 className="text-sm font-semibold text-text">Console</h2>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        {server.status === "Offline" ? (
                            <button
                                onClick={startServer}
                                className="h-8 px-3 rounded-lg bg-mauve text-crust text-sm font-medium hover:bg-mauve/90 transition-colors flex items-center gap-2"
                            >
                                <Play className="w-4 h-4" />
                                Start
                            </button>
                        ) : (
                            <button
                                onClick={stopServer}
                                className="h-8 px-3 rounded-lg bg-red text-crust text-sm font-medium hover:bg-red/90 transition-colors flex items-center gap-2"
                            >
                                <Square className="w-4 h-4" />
                                Stop
                            </button>
                        )}
                    </div>
                </div>

            {/* I'm so sorry for this :( */}
            <div
                ref={consoleRef}
                className="max-w-235 min-w-235 min-h-90 max-h-90 flex-1 px-4 py-3 overflow-x-auto overflow-y-auto font-mono text-sm scrollbar-hide bg-bg-1"
            >
                {consoleOutput.map((line, index) => (
                    <p key={index} className={`${getConsoleColor(line)} whitespace-pre-wrap wrap-break-word py-0.5`}>
                        {line}
                    </p>
                ))}
            </div>

            <div className="bg-bg-2 px-4 py-4 border-t border-border">
                <div className="flex items-center gap-2">
                    <span className="text-mauve text-sm font-mono">&gt;</span>
                    <input
                        type="text"
                        className="flex-1 h-8 bg-transparent focus:outline-none text-text font-mono placeholder-text-2 text-sm"
                        placeholder="Type a command..."
                        value={consoleInput}
                        onChange={(e) => setConsoleInput(e.target.value)}
                        onKeyUp={handleKeyUp}
                        disabled={server.status !== "Online"}
                    />
                </div>
            </div>

            <Modal
                isOpen={eulaVisible}
                onClose={() => setEulaVisible(false)}
                title="EULA Required"
                description="Accept before starting"
            >
                <p className="text-text text-sm mb-6">
                    You need to accept the Minecraft EULA (End User License Agreement) before you can start this server.
                    Please visit the official Minecraft website to read the EULA and then accept it below.
                </p>
                <div className="flex gap-3">
                    <Button onClick={() => setEulaVisible(false)} color="red" className="flex-1" children={[<p>Cancel</p>]} />
                    <Button onClick={acceptEula} color="primary" className="flex-1" children={[<p>Accept & Start</p>]} />
                </div>
            </Modal>
          </div>
        </div>
    );
}
