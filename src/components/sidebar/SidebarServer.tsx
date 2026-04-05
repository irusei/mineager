import { MinecraftServer } from "../../types/types.tsx";
import { getStatusColor } from "../../utils/colors.ts";

interface SidebarServerProps {
    server: MinecraftServer;
    selected: boolean;
    onSelected: () => void
}

// export function SidebarServer({ server, selected, onSelected }: SidebarServerProps) {
//     return (
//         <div onClick={() => onSelected()} className={"p-4 pl-6 w-full rounded-lg flex flex-col hover:cursor-pointer bg-zinc-800 hover:outline-orange-500 hover:outline-1 transition-all " + (selected ? "outline-1 outline-orange-500" : "")}>
//             <div className={"flex flex-row justify-between"}>
//                 <h1 className={"text-gray-300"}>{server.server_name}</h1>
//                 {/* status */}
//                 <div className={"flex flex-row items-center space-x-2"}>
//                     <div className={`rounded-xl w-2 h-2 bg-red ${getStatusColor(server.status)}`}></div>
//                     <p className={"text-gray-400"}>{server.status}</p>
//                 </div>
//             </div>
//             <div>
//                 <p className={"text-gray-400"}>{server.server_version}</p>
//             </div>
//             {/* players, ram
//             <div className={"flex flex-row items-center space-x-2 justify-between"}>
//                 {server.status != "Offline" && <>
//                 <div className={"flex flex-row items-center space-x-2"}>
//                     <User color={"#99a1af"} className={"w-4 h-4"}/>
//                     <p className={"text-gray-400"}>{players} online</p>
//                 </div>
//                 <div className={"flex flex-row items-center space-x-2"}>
//                     <MemoryStick color={"#99a1af"} className={"w-4 h-4"}/>
//                     <p className={"text-gray-400"}>{ram / 1024}MB</p>
//                 </div>
//                 </>}
//             </div> */}
//         </div>
//     )
// }

export function SidebarServer({server, selected, onSelected}: SidebarServerProps) {
    return (
        <div onClick={() => onSelected()} className={"w-full"}>
            <div className={"px-6 py-2 flex flex-row items-center justify-between hover:bg-orange-400 transition-all font-medium " + (selected ? "bg-orange-500" : "")}>
                <div className={"flex flex-row items-center space-x-2"}>
                    <div className={`rounded-xl w-2 h-2 bg-red ${getStatusColor(server.status)}`}></div>
                    <p className={"text-white"}>{server.server_name}</p>
                </div>
                <p className={"transition-all font-normal " + (selected ? "text-gray-300" : "text-zinc-600")}>{server.server_version}</p>
            </div>
        </div>
    )
}