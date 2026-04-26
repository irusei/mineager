import clsx from "clsx"

interface InputProps {
    className?: string,
    type: "text" | "number",
    value: string | number,
    placeholder?: string,
    disabled?: boolean,
    onChange?: (event: React.ChangeEvent<HTMLInputElement, HTMLInputElement>) => void,
    onBlur?: (event: React.FocusEvent<HTMLInputElement>) => void,
}

export function Input({ className, type, value, placeholder, disabled, onChange, onBlur }: InputProps) {
    return (
        <input type={type} disabled={disabled} className={clsx(
            "py-2 px-3 rounded-lg bg-bg-2 border border-border focus:outline-none focus:border-border-2 focus:ring-1 focus:ring-mauve/50 placeholder-text-2 text-text",
            disabled && "opacity-50 cursor-not-allowed pointer-events-none select-none",
            className
        )} placeholder={placeholder ?? ""}
            value={value}
            onBlur={(event) => onBlur?.(event)}
            onChange={(event) => onChange?.(event)}
        />
    )
}