import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Flame, Target, ArrowRight } from "lucide-react";
import {
  GOAL_LABELS,
  calculateMacros,
  type ActivityMode,
  type CalcInput,
  type Gender,
  type Goal,
  type MacroResult,
} from "@/lib/nutrition";

interface CalculatorFormProps {
  onCalculate: (result: MacroResult, input: CalcInput) => void;
  submitLabel?: string;
}


export const CalculatorForm = ({ onCalculate, submitLabel = "Рассчитать норму" }: CalculatorFormProps) => {
  const [gender, setGender] = useState<Gender>("male");
  const [age, setAge] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [goal, setGoal] = useState<Goal>("maintain");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const input: CalcInput = {
      gender,
      age: Number(age),
      height: Number(height),
      weight: Number(weight),
      activityMode: 'steps' as ActivityMode,
      steps: 0,  // 0 steps = sedentary = 1.2 coefficient
      goal,
    };
    if (!input.age || !input.height || !input.weight) return;
    onCalculate(calculateMacros(input), input);
  };


  return (
    <Card className="p-6 md:p-8 shadow-card border-border/50 backdrop-blur-sm bg-card/80">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Пол */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2 text-sm font-semibold">
            <Flame className="h-4 w-4 text-primary" />
            Пол
          </Label>
          <div className="grid grid-cols-2 gap-2">
            {(["male", "female"] as Gender[]).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGender(g)}
                className={`rounded-xl border-2 px-4 py-3 text-sm font-medium transition-smooth ${
                  gender === g
                    ? "border-primary bg-gradient-to-r from-[#0a0520] to-[#1a0a3d] text-foreground"
                    : "border-border bg-background text-muted-foreground hover:border-primary/40"
                }`}
              >
                {g === "male" ? "Мужчина" : "Женщина"}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-2">
            <Label htmlFor="age">Возраст</Label>
            <Input id="age" type="number" min={10} max={100} value={age} onChange={(e) => setAge(e.target.value)} placeholder="28" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="height">Рост, см</Label>
            <Input id="height" type="number" min={100} max={250} value={height} onChange={(e) => setHeight(e.target.value)} placeholder="178" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="weight">Вес, кг</Label>
            <Input id="weight" type="number" min={30} max={300} value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="75" />
          </div>
        </div>


        {/* Цель */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2 text-sm font-semibold">
            <Target className="h-4 w-4 text-accent" />
            Цель
          </Label>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(GOAL_LABELS) as Goal[]).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGoal(g)}
                className={`rounded-xl border-2 px-3 py-3 text-xs font-medium transition-smooth ${
                  goal === g
                    ? "border-accent bg-gradient-violet text-accent-foreground"
                    : "border-border bg-background text-muted-foreground hover:border-accent/40"
                }`}
              >
                {GOAL_LABELS[g]}
              </button>
            ))}
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
