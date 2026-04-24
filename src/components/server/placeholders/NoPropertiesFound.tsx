export function NoPropertiesFound() {
    return (
        <div className="flex-1 flex flex-col items-center justify-center min-h-120 bg-bg-2">
            <p className="text-text-2 text-sm">No properties found</p>
            <p className="text-text-2 text-sm">Make sure server.properties exists or the server has been started once.</p>
        </div>
    );
}
