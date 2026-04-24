export function getStatusColor(status: "Online" | "Offline") {
    if (status == "Online")
        return "bg-green"

    return "bg-red"
}

export function getConsoleColor(line: string) {
    if (line.length > 1 && line[0] === ">")
        return "text-mauve"

    if (line.includes("] [Server thread/INFO]:"))
        return "text-text"

    if (line.startsWith("WARNING:"))
        return "text-mauve"

    return "text-green"
}