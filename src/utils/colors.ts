export function getStatusColor(status: "Online" | "Offline") {
    if (status == "Online")
        return "bg-green-500"

    return "bg-red-500"
}

export function getConsoleColor(line: string) {
    if (line.length > 1 && line[0] === ">")
        return "text-white"

    if (line.includes("] [Server thread/INFO]:"))
        return "text-text"

    if (line.startsWith("WARNING:"))
        return "text-yellow-400"

    return "text-green-400"
}