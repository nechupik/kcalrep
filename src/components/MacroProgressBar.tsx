interface MacroProgressBarProps {
  consumed: number;
  total: number;
  label: string;
  unit?: string;
  colorVar: string; // CSS variable name like "--macro-protein"
}

export const MacroProgressBar = ({ consumed, total, label, unit = "г", colorVar }: MacroProgressBarProps) => {
  const pct = total > 0 ? Math.min(100, (consumed / total) * 100) : 0;
  const color = `var(${colorVar})`;

  return (
    <div className="flex-1 min-w-[80px] max-w-[120px]">
      <div className="flex items-center justify-center mb-1">
        <span className="text-xs font-medium text-foreground">{label}</span>
      </div>
      <div className="relative h-1.5 bg-muted rounded-full overflow-hidden mb-2">
        <div
          className="absolute left-0 top-0 h-full rounded-full transition-all duration-700 ease-out"
          style={{
            width: `${pct}%`,
            backgroundColor: color,
            filter: `drop-shadow(0 0 2px ${color}55)`
          }}
        />
      </div>
      <div className="text-xs text-muted-foreground text-center mb-1">
        {Math.round(consumed)}/{Math.round(total)}{unit}
      </div>
    </div>
  );
};
