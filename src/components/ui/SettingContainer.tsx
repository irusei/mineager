interface SettingContainerProps {
    name: string,
    description?: string | React.ReactNode,
    children: React.ReactNode,
}
    
export function SettingContainer({ name, description, children }: SettingContainerProps) {
    return (
        <div className="flex flex-row justify-between items-center py-3 border-b border-border last:border-b-0">
            <div className="flex-1 pr-4">
                <p className="font-medium text-text">
                    {name}
                </p>
                {description != null &&
                <p className="text-sm text-text-2 mt-1">
                    {description}
                </p>
                }
            </div>
            {children}
        </div>
    )
}