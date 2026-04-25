import { Sun, Moon } from "lucide-react";
import { useLocalStorage } from "usehooks-ts";
import { useEffect } from "react";

export function ThemeToggle() {
    const [theme, setTheme] = useLocalStorage<string>("mineager-theme", "mocha");
    const isLight = theme === "latte";

    useEffect(() => {
        document.documentElement.classList.toggle("theme-latte", isLight);
    }, [isLight]);

    return (
        <button
            onClick={() => setTheme(isLight ? "mocha" : "latte")}
            className="p-1 rounded-md hover:bg-border/30 transition-colors text-text-2 hover:text-text"
            title={isLight ? "Switch to dark mode" : "Switch to light mode"}
        >
            {isLight ? (
                <Moon className="w-4 h-4" />
            ) : (
                <Sun className="w-4 h-4" />
            )}
        </button>
    );
}
