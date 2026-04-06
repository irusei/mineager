import clsx from "clsx";

interface ButtonProps {
    onClick?: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
    className?: string;
    children?: Array<React.ReactElement>;
    color: "red" | "blue" | "orange",
    disabled?: boolean,
    title?: string,
}

export default function Button({ onClick, children, color, className, disabled, title }: ButtonProps) {
    const textClass: Record<ButtonProps["color"], string> = {
        red: "text-red-400",
        blue: "text-blue-400",
        orange: "text-orange-400",
    };

    const outlineClass: Record<ButtonProps["color"], string> = {
        red: "outline-red-500 hover:bg-red-500",
        blue: "outline-blue-500 hover:bg-blue-500",
        orange: "outline-orange-500 hover:bg-orange-500",
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
                clsx("flex flex-row gap-x-3 py-2 items-center justify-center outline-1 rounded-lg hover:cursor-pointer transition-all font-medium", 
                textClass[color], 
                outlineClass[color],
                className,
                (className && className.includes("w-")) ? "" : "w-full",
                disabled
                    ? "opacity-50 cursor-not-allowed pointer-events-none"
                    : "hover:cursor-pointer hover:text-white"
            )}>
            {children}
        </button>
    )
}