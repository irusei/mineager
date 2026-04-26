import clsx from "clsx"

interface SwitchProps {
    className?: string,
    checked: boolean,
    disabled?: boolean,
    onChecked?: (newValue: boolean) => void,
}

export function Switch({ className, checked, disabled, onChecked }: SwitchProps) {
    return (
        <label className={clsx("relative inline-flex items-center", disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer", className)}>
            <input
                type="checkbox"
                className="sr-only peer"
                checked={checked}
                disabled={disabled}
                onChange={(event) => {
                    onChecked?.(event.target.checked);
                }}
            />

            <div
                className={clsx(
                    "w-11 h-6 rounded-full bg-bg-2 border border-border",
                    "transition-all duration-200",
                    "peer-checked:bg-mauve/10",
                    "peer-checked:border-mauve/20",
                    "peer-focus:ring-2 peer-focus:ring-mauve/20"
                )}
            />

            <div
                className={clsx(
                    "absolute left-1 top-1",
                    "w-4 h-4 rounded-full bg-mauve shadow-sm",
                    "transition-transform duration-200",
                    "peer-checked:translate-x-5"
                )}
            />
        </label>
    );
}