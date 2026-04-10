import clsx from "clsx";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useState, useRef, useEffect } from "react";

interface SelectProps {
    className?: string;
    value?: string;
    setValue?: (newValue: string) => void;
    options: string[];
    disabled?: boolean;
}

export function Select({ className, disabled, value, setValue, options }: SelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={containerRef}>
            <button
                type="button"
                className={clsx(
                    "text-white w-full py-2 px-3 rounded-lg bg-bg-2 border border-border flex items-center justify-betweentext-text appearance-none cursor-pointer transition-colors",
                    disabled
                        ? "opacity-50 cursor-not-allowed pointer-events-none"
                        : "hover:border-border-2 focus:outline-none focus:border-border-2 focus:ring-1 focus:ring-orange-500/50",
                    className
                )}
                disabled={disabled ?? false}
                onClick={() => !disabled && setIsOpen(!isOpen)}
            >
                <span className="flex-1 text-left truncate">{value || "Select an option"}</span>
                <div className="ml-3 shrink-0">
                    {isOpen ? (
                        <ChevronUp className="w-5 h-5 text-text-2" />
                    ) : (
                        <ChevronDown className="w-5 h-5 text-text-2" />
                    )}
                </div>
            </button>
            {isOpen && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-bg-2 border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto scrollbar-hide z-10">
                    {options.map((option) => (
                        <button
                            key={option}
                            type="button"
                            className={clsx(
                                "w-full px-3 py-2 text-left transition-colors",
                                value === option
                                    ? "bg-orange-500/10 text-orange-500"
                                    : "text-text hover:bg-border"
                            )}
                            onClick={() => {
                                setValue?.(option);
                                setIsOpen(false);
                            }}
                        >
                            {option}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
