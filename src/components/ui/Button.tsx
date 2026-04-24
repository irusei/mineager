import clsx from "clsx";

interface ButtonProps {
    onClick?: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
    className?: string;
    children?: Array<React.ReactElement>;
    color: "red" | "blue" | "primary";
    disabled?: boolean;
    title?: string;
}

export default function Button({ onClick, children, color, className, disabled, title }: ButtonProps) {
    const baseClasses: Record<ButtonProps["color"], string> = {
        red: "bg-red/10 text-red/80 hover:bg-red/20",
        blue: "bg-blue/10 text-blue/80 hover:bg-blue/20",
        primary: "bg-mauve/10 text-mauve hover:bg-mauve/20",
    };

    function _onClick(event: React.MouseEvent<HTMLButtonElement, MouseEvent>) {
        event.preventDefault();
        if (onClick != undefined) {
            onClick(event);
        }
    }

    return (
        <button onClick={(event) => _onClick(event)} disabled={disabled ?? false} title={title ?? ""}
            className={
                clsx("flex flex-row gap-2 py-2 px-4 items-center justify-center rounded-md transition-all font-medium border border-transparent",
                baseClasses[color],
                className,
                (className && className.includes("w-")) ? "" : "w-full",
                disabled
                    ? "opacity-50 cursor-not-allowed pointer-events-none"
                    : "hover:cursor-pointer"
            )}>
            {children}
        </button>
    )
}