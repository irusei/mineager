interface SettingContainerProps {
    name: string,
    description?: string | React.ReactNode,
    children: React.ReactNode
}

export function SettingContainer({ name, description, children }: SettingContainerProps) {
    return (
        <div className={"flex flex-row justify-between items-center"}>
            <div className={"text-lg text-gray-300"}>
                <p className={"font-medium"}>
                    {name}
                </p>
                {description != null && 
                <p className={"text-sm text-zinc-500"}>
                    {description}
                </p>
                }
            </div>
            {children}
        </div>
    )
}