import { useEffect, useMemo, useState } from "react";
import { Flame, Calculator } from "lucide-react";
import { Link } from "react-router-dom";
import { Diary } from "@/components/Diary";
import { MacroRing } from "@/components/MacroRing";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  loadDiary,
  loadNorm,
  saveDiary,
  todayKey,
  type DiaryEntry,
} from "@/lib/storage";
import type { MacroResult } from "@/lib/nutrition";

const Index = () => {
  const [norm, setNorm] = useState<MacroResult | null>(null);
  const [entries, setEntries] = useState<DiaryEntry[]>([]);

  useEffect(() => {
    const loadData = async () => {
      const normData = await loadNorm();
      const diaryData = await loadDiary();
      setNorm(normData);
      setEntries(Array.isArray(diaryData) ? diaryData : []);
    };
    
    loadData();
  }, []);

  const handleAddEntry = async (entry: DiaryEntry) => {
    const next = [...entries, entry];
    setEntries(next);
    await saveDiary(next);
    toast.success(`Добавлено: ${entry.name}`);
  };

  const handleRemoveEntry = async (id: string) => {
    const next = entries.filter((e) => e.id !== id);
    setEntries(next);
    await saveDiary(next);
  };

  const todayTotals = useMemo(() => {
    const today = entries.filter((e) => e.date === todayKey());
    return today.reduce(
      (acc, e) => ({
        calories: acc.calories + e.calories,
        protein: acc.protein + e.protein,
        fat: acc.fat + e.fat,
        carbs: acc.carbs + e.carbs,
      }),
      { calories: 0, protein: 0, fat: 0, carbs: 0 },
    );
  }, [entries]);

  return (
    <div className="min-h-screen">
      <AppHeader />

      {/* Пустой "герой" */}
      <section className="container pt-2 pb-6 max-w-5xl" aria-hidden />

      {/* Daily progress */}
      <section className="container max-w-5xl mb-8">
        {norm ? (
          <Card className="p-6 md:p-8 shadow-soft border-border/50 backdrop-blur-sm bg-card/80">
            <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
              <div>
                <h2 className="text-xl font-bold">Сегодня</h2>
                <p className="text-sm text-muted-foreground">
                  {todayTotals.calories} из {norm.calories} ккал · осталось{" "}
                  <span className="font-semibold text-foreground">
                    {Math.max(0, norm.calories - todayTotals.calories)}
                  </span>{" "}
                  ккал
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 justify-items-center">
              <MacroRing consumed={todayTotals.calories} total={norm.calories} label="Калории" unit=" ккал" colorVar="--macro-calories" />
              <MacroRing consumed={todayTotals.protein} total={norm.protein} label="Белки" colorVar="--macro-protein" />
              <MacroRing consumed={todayTotals.fat} total={norm.fat} label="Жиры" colorVar="--macro-fat" />
              <MacroRing consumed={todayTotals.carbs} total={norm.carbs} label="Углеводы" colorVar="--macro-carbs" />
            </div>
          </Card>
        ) : (
          <Card className="p-8 md:p-10 flex flex-col items-center text-center bg-gradient-sunset-soft border-dashed border-2 border-primary/30">
            <div className="rounded-2xl bg-gradient-sunset p-4 shadow-glow mb-4">
              <Flame className="h-8 w-8 text-primary-foreground" />
            </div>
            <h3 className="text-xl font-bold mb-2">Сначала рассчитайте норму</h3>
            <p className="text-sm text-muted-foreground max-w-md mb-5">
              Норму КБЖУ задают один раз — при регистрации или в профиле. Дневник начнёт показывать прогресс после расчёта.
            </p>
            <Button asChild size="lg" className="bg-gradient-sunset border-0 text-primary-foreground hover:opacity-90 shadow-glow">
              <Link to="/profile">
                <Calculator className="h-4 w-4 mr-2" />
                Перейти в профиль
              </Link>
            </Button>
          </Card>
        )}
      </section>

      {/* Diary */}
      <section className="container max-w-5xl pb-20">
        <Diary entries={entries} onAdd={handleAddEntry} onRemove={handleRemoveEntry} />
      </section>

      <footer className="container py-8 text-center text-xs text-muted-foreground border-t border-border/40">
        Расчёт по формуле Миффлина–Сан Жеора. Данные хранятся локально в браузере.
      </footer>
    </div>
  );
};

export default Index;
