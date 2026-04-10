import { Blocks } from "lucide-react";

export function NoServerSelected() {
    return (
        <div className="flex-1 flex flex-col items-center justify-center min-h-full bg-bg-2">
            <div className="w-16 h-16 rounded-lg bg-orange-500/10 flex items-center justify-center mb-4">
                <Blocks className="w-8 h-8 text-orange-500" />
            </div>
            <p className="text-text-2 text-sm">No server selected</p>
        </div>
    );
}
