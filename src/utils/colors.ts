export function getStatusColor(status: "Online" | "Idle" | "Offline") {
    if (status == "Online")
        return "bg-green-500"
    else if (status == "Idle")
        return "bg-yellow-500"

    return "bg-red-500"
}

export function getConsoleColor(line: string) {
    if (line.length > 1 && line[0] === ">")
        return "text-white"
    
    return "text-green-400"
}