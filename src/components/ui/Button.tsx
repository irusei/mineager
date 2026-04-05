import clsx from "clsx";

interface ButtonProps {
    onClick?: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
    className?: string;
    children?: Array<React.ReactElement>;
    color: "red" | "blue" | "orange"
}

export default function Button({ onClick, children, color, className }: ButtonProps) {
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
        <button onClick={(event) => _onClick(event)} className={clsx("w-full flex flex-row gap-x-3 py-2 items-center justify-center outline-1 rounded-lg hover:cursor-pointer transition-all hover:text-white font-medium", textClass[color], outlineClass[color], className)}>
            {children}
        </button>
    )
}