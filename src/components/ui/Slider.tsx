interface SliderProps {
    min: number;
    max: number;
    step: number;
    value: number;
    unit: string;
    onChange: (value: number) => void;
}

export function Slider({ min, max, step, value, unit, onChange }: SliderProps) {
    const percentage = ((value - min) / (max - min)) * 100;

    return (
        <div className="flex flex-col gap-2 w-64">
            <div className="flex justify-between text-sm text-text-2">
                <span>{min}{unit}</span>
                <span className="text-text font-medium">{value}{unit}</span>
                <span>{max}{unit}</span>
            </div>
            <div className="relative w-full -mx-1 h-6 flex items-center">
                <div className="absolute left-0 right-0 h-1.5 bg-border rounded-full" />
                <div
                    className="absolute h-1.5 bg-mauve rounded-full left-0 transition-all"
                    style={{ width: `${percentage}%` }}
                />
                <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={value}
                    onChange={(e) => onChange(Number(e.target.value))}
                    className="absolute w-full h-6 opacity-0 cursor-pointer"
                />
                <div
                    className="absolute w-4 h-4 bg-mauve rounded-full border-2 border-bg-2 shadow-sm pointer-events-none transition-all"
                    style={{ left: `calc(${percentage}% - 8px)` }}
                />
            </div>
        </div>
    );
}
