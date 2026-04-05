import { ChevronDown, Play, Square } from "lucide-react";
import { Tab } from "./ServerView";
import Button from "../ui/Button";


interface ServerTab {
    name: Tab,
    selected: boolean,
    onClick: () => void
}

function ServerTab({ name, selected, onClick }: ServerTab) {
    return (
        <div onClick={() => onClick()} className={"w-full"}>
            <div className={"px-6 py-2 flex flex-row items-center justify-between hover:bg-orange-400 transition-all font-medium " + (selected ? "bg-orange-500" : "")}>
                <p className={"text-white"}>{name}</p>
            </div>
        </div>
    )
}

interface ServerTabViewProps {
    tab: Tab,
    setTab: React.Dispatch<React.SetStateAction<Tab>>
    visible: boolean,   

    startServer: () => void,
    stopServer: () => void,
}

export function ServerTabView({ tab, setTab, visible, startServer, stopServer }: ServerTabViewProps) {
    return (
        <div className={"absolute right-0 w-75 bg-neutral-900 flex flex-col py-0 h-full border-l border-zinc-800 overflow-y-scroll scrollbar-hide " + (!visible && "hidden")}>
            <div className={"w-full p-2 flex flex-row space-x-2 font-medium text-gray-400"}>
                <ChevronDown/>
                <p>Controls</p>
            </div>
            <div className={"h-full"}>
                {(["Console", "Properties", "Settings"] as Tab[]).map((tabType: Tab) => (
                    <ServerTab key={tabType} name={tabType} selected={tabType === tab} onClick={() => setTab(tabType)} />
                ))}
            </div>
            <div className={"border-zinc-800 border-t p-3 space-y-3 py-3.5"}>
                <Button onClick={() => startServer()} className={"px-3"} color={"blue"}>
                    <Play/>
                    <p>Start</p>
                </Button>
                <Button onClick={() => stopServer()} color={"red"}>
                    <Square/>
                    <p>Stop</p>
                </Button>
            </div>
        </div>
    );
}
