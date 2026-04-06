import clsx from "clsx";

interface SelectProps {
    className?: string,
    value?: string,
    setValue?: (newValue: string) => void,
    options: string[];
    disabled?: boolean
}
export function Select({ className, disabled, value, setValue, options}: SelectProps) {
    return (
        <select className={clsx("bg-zinc-800 rounded-lg py-2 px-2 placeholder-gray-500 text-gray-300 focus:outline-none", className)} disabled={disabled ?? false} value={value ?? ""} onChange={(event) => setValue?.(event.target.value)}>
            {options.map((v: string) => (
                // TODO: custom options menu
                <option key={v} className={"bg-zinc-800 text-gray-300 rounded-lg"} value={v}>{v}</option>
            ))}
        </select>
    )
}