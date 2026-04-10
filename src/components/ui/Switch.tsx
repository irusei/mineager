import clsx from "clsx"

interface SwitchProps {
    className?: string,
    checked: boolean,
    onChecked?: (newValue: boolean) => void,
}

export function Switch({ className, checked, onChecked }: SwitchProps) {
    return (
        <label className={clsx("relative inline-flex items-center cursor-pointer", className)}>
            <input
                type="checkbox"
                className="sr-only peer"
                checked={checked}
                onChange={(event) => {
                    onChecked?.(event.target.checked);
                }}
            />

            <div
                className={clsx(
                    "w-11 h-6 rounded-full bg-bg-2 border border-border",
                    "transition-all duration-200",
                    "peer-checked:bg-orange-500",
                    "peer-checked:border-orange-500",
                    "peer-focus:ring-2 peer-focus:ring-orange-500/50"
                )}
            />

            <div
                className={clsx(
                    "absolute left-1 top-1",
                    "w-4 h-4 rounded-full bg-white shadow-sm",
                    "transition-transform duration-200",
                    "peer-checked:translate-x-5"
                )}
            />
        </label>
    );
}