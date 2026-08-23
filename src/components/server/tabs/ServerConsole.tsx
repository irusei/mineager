import { useEffect, useRef, useState } from "react";
import { FrontendServer } from "../../../types/types.tsx";
import { invoke } from "@tauri-apps/api/core";
import { getConsoleColor } from "../../../utils/colors.ts";
import { listen } from "@tauri-apps/api/event";
import { Terminal, Play, Square, Search, PowerOff } from "lucide-react";
import { Modal, ConfirmModal } from "../../ui/Modal";
import Button from "../../ui/Button";
interface ConsoleUpdatePayload {
  server_id: string;
  line: string;
}

interface ServerConsoleProps {
  server: FrontendServer;
}


export function ServerConsole({
  server,
}: ServerConsoleProps) {
  const consoleRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef<boolean>(true);
  const [consoleInput, setConsoleInput] = useState<string>("");
  const [consoleOutput, setConsoleOutput] = useState<string[]>([
    "Server offline",
  ]);
  const [filteredConsoleOutput, setFilteredConsoleOutput] =
    useState<string[]>(consoleOutput);
  const [eulaVisible, setEulaVisible] = useState<boolean>(false);
  const [consoleSearch, setConsoleSearch] = useState<string>("");
  const [eulaAccepted, setEulaAccepted] = useState<boolean>(true); // default to true so it doesn't spam, set to false later
  const [terminateVisible, setTerminateVisible] = useState<boolean>(false);

  async function startServer() {
    if (server.server.java_path === "")
      return alert("Please configure the Java path in settings!");

    if (server.status === "Online") return;

    await invoke("start_server", { serverId: server.server.server_id });
  }

  async function stopServer() {
    await invoke("write_stdin", {
      serverId: server.server.server_id,
      string: "stop",
    });
  }

  async function terminateServer() {
    await invoke("terminate_server", { serverId: server.server.server_id });
  }


  useEffect(() => {
    const consoleDiv = consoleRef.current;
    if (consoleDiv === null) return;

    const onScroll = () => {
      const distanceFromBottom =
        consoleDiv.scrollHeight - consoleDiv.scrollTop - consoleDiv.clientHeight;
      atBottomRef.current = distanceFromBottom <= 24;
    };

    consoleDiv.addEventListener("scroll", onScroll);
    return () => consoleDiv.removeEventListener("scroll", onScroll);
  }, []);

  function updateFilter(output: string[]) {
    if (consoleSearch === "") {
      setFilteredConsoleOutput(output);
      return;
    }

    const newConsoleOutput = output.filter((line) =>
      line.toLowerCase().includes(consoleSearch.toLowerCase()),
    );
    setFilteredConsoleOutput(newConsoleOutput);
  }

  // make highlighted logs when searching
  function getSearchHighlights(consoleLine: string) {
    if (consoleSearch === "") return consoleLine;

    let elements = [];
    let lcs = consoleSearch.toLowerCase();
    let lcl = consoleLine.toLowerCase();
    // find occurences of words
    let index = 0;
    while (index < consoleLine.length) {
      if (lcs[0] != lcl[index]) {
        elements.push(consoleLine[index]);
        index++;
        continue;
      }

      if (lcl.slice(index, index + lcs.length) === lcs) {
        elements.push(
          <mark key={`${consoleOutput.indexOf(consoleLine)}-${index}`}>
            {consoleLine.slice(index, index + lcs.length)}
          </mark>,
        );

        index += consoleSearch.length;
        continue;
      }

      elements.push(consoleLine[index]);
      index++;
    }

    return elements;
  }

  function startServerWithEula() {
    if (eulaAccepted) {
      startServer();
    } else {
      setEulaVisible(true);
    }
  }

  function fetchConsole() {
    if (server.status === "Online") {
      invoke("get_stdout", { serverId: server.server.server_id }).then(
        (res) => {
          let response: string[] = res as string[];
          if (response.length > 0) {
            if (consoleOutput != response) {
              setConsoleOutput(response);
            }
          }
        },
      );
    }
  }
  useEffect(() => {
    const consoleUpdateUnlisten = listen("console-update", (event) => {
      const consoleUpdatePayload = event.payload as ConsoleUpdatePayload;
      if (consoleUpdatePayload.server_id === server.server.server_id) {
        setConsoleOutput((oldConsoleOutput) => [
          ...oldConsoleOutput,
          consoleUpdatePayload.line,
        ]);
      }
    });

    invoke("get_eula_accepted", { serverId: server.server.server_id }).then(
      (res) => {
        let eula = res as boolean;
        setEulaAccepted(eula);
      },
    );
    setConsoleOutput(["Server offline"]);
    fetchConsole(); // refresh console on server change

    return () => {
      consoleUpdateUnlisten.then((ul) => ul());
    };
  }, [server.server.server_id]);

  useEffect(() => {
    // The world if react was decent and I could just hook this into the listen normally without stupid userefs
    updateFilter(consoleOutput);
  }, [consoleOutput]);

  // autoscroll to bottom when new lines are added
  useEffect(() => {
    if (!atBottomRef.current) return;
    const consoleDiv = consoleRef.current;
    if (consoleDiv === null) return;
    consoleDiv.scrollTop = consoleDiv.scrollHeight;
  }, [filteredConsoleOutput]);

  useEffect(() => {
    updateFilter(consoleOutput);
  }, [consoleSearch]);

  async function acceptEula() {
    setEulaVisible(false);
    setEulaAccepted(true);
    await invoke("set_eula_accepted", {
      serverId: server.server.server_id,
      accepted: true,
    });
    await invoke("start_server", { serverId: server.server.server_id });
  }

  async function handleCommand() {
    if (consoleInput.trim() === "") return;
    await invoke("write_stdin", {
      serverId: server.server.server_id,
      string: consoleInput,
    });
    setConsoleInput("");
  }

  function handleKeyUp(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      handleCommand();
    }
  }

  function confirmTerminate() {
    terminateServer();
    setTerminateVisible(false);
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
          <div className="flex gap-2 items-center">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-2" />
              <input
                type="text"
                className="w-full pl-9 pr-3 py-1.5 bg-bg-2 border border-border rounded-md
                                        text-text placeholder-text-2 text-sm focus:outline-none focus:ring-1 focus:ring-mauve/20"
                value={consoleSearch}
                onChange={(e) => setConsoleSearch(e.target.value)}
                placeholder="Search logs"
              />
            </div>
            {server.status === "Offline" ? (
              <button
                onClick={startServerWithEula}
                className="h-8 px-3 rounded-lg bg-mauve text-crust text-sm font-medium hover:bg-mauve/90 transition-colors flex items-center gap-2"
              >
                <Play className="w-4 h-4" />
                Start
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setTerminateVisible(true)}
                  title="Force kill the server process"
                  className="h-8 px-3 rounded-lg bg-red text-crust text-sm font-medium hover:bg-red/90 transition-colors flex items-center gap-2"
                >
                  <PowerOff className="w-4 h-4" />
                  Terminate
                </button>
                <button
                  onClick={stopServer}
                  className="h-8 px-3 rounded-lg bg-red text-crust text-sm font-medium hover:bg-red/90 transition-colors flex items-center gap-2"
                >
                  <Square className="w-4 h-4" />
                  Stop
                </button>
              </div>
            )}
          </div>
        </div>

        {/* I'm so sorry for this :( */}
        <div
          ref={consoleRef}
          className="max-w-235 min-w-235 min-h-[19.625rem] max-h-[19.625rem] flex-1 px-4 py-3 overflow-x-auto overflow-y-auto font-mono text-sm bg-bg-1"
        >
          {filteredConsoleOutput.map((line, index) => (
            <p
              key={index}
              className={`${getConsoleColor(line)} whitespace-pre-wrap wrap-break-word py-0.5`}
            >
              {getSearchHighlights(line)}
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
          description="You need to accept the Minecraft EULA (End User License Agreement) before you can start this server.
                    Please visit the official Minecraft website to read the EULA and then accept it below."
          footer={
            <>
              <Button
                onClick={() => setEulaVisible(false)}
                color="red"
                className="flex-1"
                children={[<p>Cancel</p>]}
              />
              <Button
                onClick={acceptEula}
                color="primary"
                className="flex-1"
                children={[<p>Accept & Start</p>]}
              />
            </>
          }
        />

        <ConfirmModal
          isOpen={terminateVisible}
          onClose={() => setTerminateVisible(false)}
          title="Terminate Server"
          description="This will forcefully kill the server process. Any unsaved data or running tasks may be lost. Are you sure?"
          confirmText="Terminate"
          onConfirm={confirmTerminate}
          confirmColor="primary"
          cancelText="Cancel"
        />
      </div>
    </div>
  );
}
