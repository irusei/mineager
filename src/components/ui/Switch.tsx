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
                    "w-11 h-6 rounded-full bg-zinc-700",
                    "transition-colors duration-200",
                    "peer-checked:bg-orange-500",
                    "peer-focus:ring-2 peer-focus:ring-orange-500"
                )}
            />

            <div
                className={clsx(
                    "absolute left-1 top-1",
                    "w-4 h-4 rounded-full bg-white",
                    "transition-transform duration-200",
                    "peer-checked:translate-x-5"
                )}
            />
        </label>
    );
}