import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Flame, Beef, Droplet, Wheat, Save } from "lucide-react";
import type { MacroResult } from "@/lib/nutrition";

interface ResultsCardProps {
  result: MacroResult;
  onSave: () => void;
  saved?: boolean;
}

export const ResultsCard = ({ result, onSave, saved }: ResultsCardProps) => {
  const items = [
    { icon: Flame, label: "Калории", value: result.calories, unit: "ккал", colorClass: "text-macro-calories", bg: "bg-macro-calories/10" },
    { icon: Beef, label: "Белки", value: result.protein, unit: "г", colorClass: "text-macro-protein", bg: "bg-macro-protein/10" },
    { icon: Droplet, label: "Жиры", value: result.fat, unit: "г", colorClass: "text-macro-fat", bg: "bg-macro-fat/10" },
    { icon: Wheat, label: "Углеводы", value: result.carbs, unit: "г", colorClass: "text-macro-carbs", bg: "bg-macro-carbs/10" },
  ];

  return (
    <Card className="p-6 md:p-8 shadow-soft border-border/50 backdrop-blur-sm bg-card/80">
      <div className="mb-6 space-y-1">
        <h3 className="text-2xl font-bold">Ваша дневная норма</h3>
        <p className="text-sm text-muted-foreground">
          Базовый обмен: <span className="font-semibold text-foreground">{result.bmr}</span> ккал · 
          Расход: <span className="font-semibold text-foreground"> {result.tdee}</span> ккал
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        {items.map((it) => (
          <div key={it.label} className={`rounded-2xl p-4 ${it.bg} transition-smooth hover:scale-[1.02]`}>
            <div className="flex items-center gap-2 mb-2">
              <it.icon className={`h-4 w-4 ${it.colorClass}`} />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{it.label}</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className={`text-3xl font-bold ${it.colorClass}`}>{it.value}</span>
              <span className="text-sm text-muted-foreground">{it.unit}</span>
            </div>
          </div>
        ))}
      </div>

      {result.warning && (
        <div className="mt-4 rounded-xl border border-yellow-500/40 bg-yellow-500/10 p-4">
          <div className="flex items-start gap-2">
            <span className="text-lg">⚠️</span>
            <p className="text-sm text-yellow-200">{result.warning}</p>
          </div>
        </div>
      )}

      <Button
        onClick={onSave}
        variant="outline"
        size="lg"
        className="flex items-center gap-3 rounded-2xl bg-gradient-to-r from-[#0a0520] to-[#1a0a3d] px-8 py-4 text-foreground font-bold text-lg shadow-glow hover:opacity-90 transition-smooth"
      >
        <Save className="mr-2 h-4 w-4" />
        {saved ? "Норма сохранена" : "Сохранить как мою норму"}
      </Button>
    </Card>
  );
};
