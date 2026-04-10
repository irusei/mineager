import { FrontendServer } from "../../types/types.tsx";
import { getStatusColor } from "../../utils/colors.ts";

interface SidebarServerProps {
    server: FrontendServer;
    selected: boolean;
    onSelected: () => void
}

export function SidebarServer({ server, selected, onSelected }: SidebarServerProps) {
    const statusColor = getStatusColor(server.status);

    return (
        <div
            onClick={() => onSelected()}
            className={`group relative bg-bg-2 rounded-md cursor-pointer
                       transition-all p-2
                       ${selected
                           ? 'border-orange-500/50 bg-orange-500/5'
                           : ''}`}
        >
            <div className="flex gap-3 items-center space-x-1">
                <div className={`w-2 h-2 rounded-full shrink-0
                                ${statusColor}`} />

                <div className="flex-1 min-w-0">
                    <div className="flex justify-between gap-2">
                        <h3 className="font-medium text-text text-sm truncate">{server.server.server_name}</h3>
                        <span className={"text-xs text-text-2"}>v{server.server.server_version}</span>
                    </div>
                </div>
            </div>
        </div>
    )
}