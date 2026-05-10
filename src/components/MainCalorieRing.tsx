interface MainCalorieRingProps {
  consumed: number;
  total: number;
  size?: number;
}

export const MainCalorieRing = ({ consumed, total, size = 200 }: MainCalorieRingProps) => {
  const pct = total > 0 ? Math.min(100, (consumed / total) * 100) : 0;
  const radius = (size - 24) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;
  const color = "var(--macro-calories)";

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90 transform">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="hsl(var(--muted))"
            strokeWidth="12"
            fill="none"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth="12"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-700 ease-out"
            style={{ filter: `drop-shadow(0 0 12px ${color}55)` }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold" style={{ color }}>
            {Math.round(consumed)}
          </span>
          <span className="text-sm text-muted-foreground">из {Math.round(total)} ккал</span>
        </div>
      </div>
      <div className="text-center">
        <span className="text-lg font-semibold text-foreground">Калории</span>
        <div className="text-sm text-muted-foreground mt-1">
          осталось {Math.max(0, total - consumed)} ккал
        </div>
      </div>
    </div>
  );
};
