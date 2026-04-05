import clsx from "clsx"

interface InputProps {
    className?: string,
    type: "text" | "number",
    value: string | number,
    placeholder?: string,
    onChange?: (event: React.ChangeEvent<HTMLInputElement, HTMLInputElement>) => void,
}

export function Input({ className, type, value, placeholder, onChange }: InputProps) {
    return (
        <input type={type} className={clsx(
            "py-2 px-2 rounded-lg bg-zinc-800 focus:outline-none placeholder-gray-500 text-gray-300",
            className
        )} placeholder={placeholder ?? ""} 
            value={value}
            onChange={(event) => onChange?.(event)}
        />
    )
}