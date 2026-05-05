import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Card } from "@/components/ui/card";
import { Flame, Activity, Target, ArrowRight, Footprints, Dumbbell } from "lucide-react";
import {
  GOAL_LABELS,
  ACTIVITY_LABELS,
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

const MODES: { value: ActivityMode; label: string; icon: typeof Footprints }[] = [
  { value: "steps", label: "Шаги", icon: Footprints },
  { value: "workouts", label: "Тренировки", icon: Dumbbell },
  { value: "both", label: "Шаги + тренировки", icon: Activity },
];

const INTENSITY_LABEL: Record<"light" | "moderate" | "hard", string> = {
  light: "Лёгкая",
  moderate: "Средняя",
  hard: "Тяжёлая",
};

export const CalculatorForm = ({ onCalculate, submitLabel = "Рассчитать норму" }: CalculatorFormProps) => {
  const [gender, setGender] = useState<Gender>("male");
  const [age, setAge] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [activityMode, setActivityMode] = useState<ActivityMode>("steps");
  const [steps, setSteps] = useState(8000);
  const [workoutsPerWeek, setWorkoutsPerWeek] = useState(3);
  const [intensity, setIntensity] = useState<"light" | "moderate" | "hard">("moderate");
  const [goal, setGoal] = useState<Goal>("maintain");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const input: CalcInput = {
      gender,
      age: Number(age),
      height: Number(height),
      weight: Number(weight),
      activityMode,
      steps,
      workouts: { perWeek: workoutsPerWeek, intensity },
      goal,
    };
    if (!input.age || !input.height || !input.weight) return;
    onCalculate(calculateMacros(input), input);
  };

  const showSteps = activityMode === "steps" || activityMode === "both";
  const showWorkouts = activityMode === "workouts" || activityMode === "both";

  // Live-предпросмотр уровня
  const previewInput: CalcInput = {
    gender,
    age: Number(age) || 25,
    height: Number(height) || 170,
    weight: Number(weight) || 70,
    activityMode,
    steps,
    workouts: { perWeek: workoutsPerWeek, intensity },
    goal,
  };
  const previewLevel = calculateMacros(previewInput).activityLabel;

  return (
    <Card className="p-6 md:p-8 shadow-card border-border/50 backdrop-blur-sm bg-card/80">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Пол */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2 text-sm font-semibold">
            <Activity className="h-4 w-4 text-primary" />
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

        {/* Режим активности */}
        <div className="space-y-3">
          <Label className="flex items-center gap-2 text-sm font-semibold">
            <Flame className="h-4 w-4 text-secondary" />
            Как считать активность
          </Label>
          <div className="grid grid-cols-3 gap-2">
            {MODES.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => setActivityMode(m.value)}
                className={`rounded-xl border-2 px-2 py-3 text-xs font-medium transition-smooth flex flex-col items-center gap-1.5 ${
                  activityMode === m.value
                    ? "border-secondary bg-secondary/15 text-foreground"
                    : "border-border bg-background text-muted-foreground hover:border-secondary/40"
                }`}
              >
                <m.icon className="h-4 w-4" />
                {m.label}
              </button>
            ))}
          </div>

          {showSteps && (
            <div className="rounded-xl border border-border/60 bg-muted/30 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2 text-sm">
                  <Footprints className="h-4 w-4 text-primary" />
                  Шаги в день
                </Label>
                <span className="text-sm font-bold text-gradient-sunset">{steps.toLocaleString("ru-RU")}</span>
              </div>
              <Slider
                value={[steps]}
                min={1000}
                max={20000}
                step={500}
                onValueChange={(v) => setSteps(v[0])}
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>1k</span>
                <span>5k</span>
                <span>10k</span>
                <span>15k</span>
                <span>20k</span>
              </div>
            </div>
          )}

          {showWorkouts && (
            <div className="rounded-xl border border-border/60 bg-muted/30 p-4 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="flex items-center gap-2 text-sm">
                    <Dumbbell className="h-4 w-4 text-accent" />
                    Тренировок в неделю
                  </Label>
                  <span className="text-sm font-bold text-accent">{workoutsPerWeek}</span>
                </div>
                <Slider
                  value={[workoutsPerWeek]}
                  min={0}
                  max={10}
                  step={1}
                  onValueChange={(v) => setWorkoutsPerWeek(v[0])}
                />
              </div>
              <div>
                <Label className="text-sm mb-2 block">Интенсивность</Label>
                <div className="grid grid-cols-3 gap-2">
                  {(["light", "moderate", "hard"] as const).map((i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setIntensity(i)}
                      className={`rounded-lg border-2 px-2 py-2 text-xs font-medium transition-smooth ${
                        intensity === i
                          ? "border-accent bg-accent/15 text-foreground"
                          : "border-border bg-background text-muted-foreground hover:border-accent/40"
                      }`}
                    >
                      {INTENSITY_LABEL[i]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="text-xs text-muted-foreground">
            Расчётный уровень активности:{" "}
            <span className="font-semibold text-foreground">{ACTIVITY_LABELS[previewLevel]}</span>
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
