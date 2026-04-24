interface MacroRingProps {
  consumed: number;
  total: number;
  label: string;
  unit?: string;
  colorVar: string; // CSS variable name like "--macro-protein"
  size?: number;
}

export const MacroRing = ({ consumed, total, label, unit = "г", colorVar, size = 120 }: MacroRingProps) => {
  const pct = total > 0 ? Math.min(100, (consumed / total) * 100) : 0;
  const radius = (size - 16) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;
  const color = `hsl(var(${colorVar}))`;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90 transform">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="hsl(var(--muted))"
            strokeWidth="8"
            fill="none"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth="8"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-700 ease-out"
            style={{ filter: `drop-shadow(0 0 8px ${color}55)` }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold" style={{ color }}>
            {Math.round(consumed)}
          </span>
          <span className="text-xs text-muted-foreground">из {Math.round(total)}{unit}</span>
        </div>
      </div>
      <span className="text-sm font-medium text-foreground">{label}</span>
    </div>
  );
};
