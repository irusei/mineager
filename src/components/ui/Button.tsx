import clsx from "clsx";

interface ButtonProps {
    onClick?: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
    className?: string;
    children?: Array<React.ReactElement>;
    color: "red" | "blue" | "orange";
    disabled?: boolean;
    title?: string;
}

export default function Button({ onClick, children, color, className, disabled, title }: ButtonProps) {
    const baseClasses: Record<ButtonProps["color"], string> = {
        red: "bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20",
        blue: "bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/20",
        orange: "bg-orange-500/10 text-orange-400 border-orange-500/20 hover:bg-orange-500/20",
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
                clsx("flex flex-row gap-x-3 py-2 items-center justify-center outline-1 rounded-lg transition-all font-medium border",
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