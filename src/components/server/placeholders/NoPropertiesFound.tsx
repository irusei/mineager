import { FileText } from "lucide-react";

export function NoPropertiesFound() {
    return (
        <div className="flex-1 flex flex-col items-center justify-center min-h-100 bg-bg-2">
            <div className="w-16 h-16 rounded-lg bg-orange-500/10 flex items-center justify-center mb-4">
                <FileText className="w-8 h-8 text-orange-500" />
            </div>
            <p className="text-text-2 text-sm">No properties found</p>
            <p className="text-text-2 text-sm">Make sure server.properties exists or the server has been started once.</p>
        </div>
    );
}
