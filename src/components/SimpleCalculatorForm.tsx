import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Target, ArrowRight } from "lucide-react";
import {
  GOAL_LABELS,
  calculateMacros,
  type Goal,
  type CalcInput,
  type MacroResult,
  type Gender,
} from "@/lib/nutrition";
import { loadWeight } from "@/lib/firestore";

interface SimpleCalculatorFormProps {
  onCalculate: (result: MacroResult, input: CalcInput) => void;
  submitLabel?: string;
  gender: Gender;
  age: number;
  height: number;
  userId: string;
}

export const SimpleCalculatorForm = ({
  onCalculate,
  submitLabel = "Пересчитать норму",
  gender,
  age,
  height,
  userId,
}: SimpleCalculatorFormProps) => {
  const [weight, setWeight] = useState("");
  const [lastWeight, setLastWeight] = useState<string>("");
  const [goal, setGoal] = useState<Goal>("lose");

  useEffect(() => {
    const loadCurrentWeight = async () => {
      if (userId) {
        const weightEntries = await loadWeight(userId, 1);
        if (weightEntries.length > 0) {
          const lastWeightValue = String(weightEntries[0].weight);
          setLastWeight(lastWeightValue);
          setWeight(lastWeightValue);
        }
      }
    };
    loadCurrentWeight();
  }, [userId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const input: CalcInput = {
      gender,
      age,
      height,
      weight: Number(weight),
      goal,
    };
    if (!input.weight) return;
    onCalculate(calculateMacros(input), input);
  };

  return (
    <Card className="p-6 md:p-8 shadow-card border-border/50 backdrop-blur-sm bg-card/80">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Вес */}
        <div className="space-y-2">
          <Label htmlFor="weight">Вес, кг</Label>
          <Input
            id="weight"
            type="number"
            min={30}
            max={300}
            value={weight}
            onChange={(e) => setWeight(e.target.value.replace(',', '.'))}
            placeholder={lastWeight || "75"}
            step="0.1"
          />
        </div>

        {/* Цель */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2 text-sm font-semibold">
            <Target className="h-4 w-4 text-accent" />
            Цель
          </Label>
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              {(["lose", "maintain"] as Goal[]).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGoal(g)}
                  className={`rounded-xl border-2 px-4 py-3 text-sm font-medium transition-smooth flex items-center justify-center whitespace-nowrap ${
                    goal === g
                      ? "border-accent bg-gradient-violet text-accent-foreground"
                      : "border-border bg-background text-muted-foreground hover:border-accent/40"
                  }`}
                >
                  {GOAL_LABELS[g]}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setGoal("gain")}
              className={`w-full rounded-xl border-2 px-4 py-3 text-sm font-medium transition-smooth flex items-center justify-center whitespace-nowrap ${
                goal === "gain"
                  ? "border-accent bg-gradient-violet text-accent-foreground"
                  : "border-border bg-background text-muted-foreground hover:border-accent/40"
              }`}
            >
              {GOAL_LABELS["gain"]}
            </button>
          </div>
        </div>

        <Button
          type="submit"
          size="lg"
          className="w-full bg-gradient-to-r from-[#0a0520] to-[#1a0a3d] text-foreground hover:opacity-90 shadow-glow border-0 h-12 text-base font-semibold"
        >
          {submitLabel}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </form>
    </Card>
  );
};
