import { useEffect, useMemo, useState } from "react";
import { Flame, Calculator, ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { Link } from "react-router-dom";
import { Diary } from "@/components/Diary";
import { MacroRing } from "@/components/MacroRing";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  loadDiary,
  loadNorm,
  addDiaryEntry,
  removeDiaryEntry,
  type DiaryEntry,
} from "@/lib/storage";
import type { MacroResult } from "@/lib/nutrition";

const Index = () => {
  const { user } = useAuth();
  const [norm, setNorm] = useState<MacroResult | null>(null);
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString + 'T00:00:00');
    const days = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
    return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]}`;
  };

  const navigateDate = (direction: 'prev' | 'next') => {
    const currentDate = new Date(selectedDate + 'T00:00:00');
    const newDate = new Date(currentDate);
    if (direction === 'prev') {
      newDate.setDate(newDate.getDate() - 1);
    } else {
      newDate.setDate(newDate.getDate() + 1);
    }
    const newDateString = `${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, "0")}-${String(newDate.getDate()).padStart(2, "0")}`;
    setSelectedDate(newDateString);
  };

  const goToToday = () => {
    const today = new Date();
    const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    setSelectedDate(todayString);
  };

  useEffect(() => {
    const loadData = async () => {
      if (!user) return;
      
      const normData = await loadNorm();
      const diaryData = await loadDiary(selectedDate);
      setNorm(normData);
      setEntries(Array.isArray(diaryData) ? diaryData : []);
    };
    
    loadData();
  }, [user, selectedDate]);

  const handleAddEntry = async (entry: Omit<DiaryEntry, 'id' | 'addedAt'>) => {
    try {
      const entryWithDate = { ...entry, date: selectedDate };
      await addDiaryEntry(entryWithDate);
      const diaryData = await loadDiary(selectedDate);
      setEntries(Array.isArray(diaryData) ? diaryData : []);
      toast.success(`Добавлено: ${entry.name}`);
    } catch (error) {
      toast.error('Ошибка добавления записи');
    }
  };

  const handleRemoveEntry = async (id: string) => {
    try {
      await removeDiaryEntry(id);
      const diaryData = await loadDiary(selectedDate);
      setEntries(Array.isArray(diaryData) ? diaryData : []);
    } catch (error) {
      toast.error('Ошибка удаления записи');
    }
  };

  const handleRepeatYesterday = async () => {
    const yesterday = new Date(selectedDate + 'T00:00:00');
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
    
    const yesterdayEntries = await loadDiary(yesterdayStr);
    if (yesterdayEntries.length === 0) {
      toast.info('Вчера не было записей');
      return;
    }
    
    for (const entry of yesterdayEntries) {
      await addDiaryEntry({
        foodId: entry.foodId,
        name: entry.name,
        grams: entry.grams,
        calories: entry.calories,
        protein: entry.protein,
        fat: entry.fat,
        carbs: entry.carbs,
        date: selectedDate,
      });
    }
    
    const updated = await loadDiary(selectedDate);
    setEntries(Array.isArray(updated) ? updated : []);
    toast.success(`Скопировано ${yesterdayEntries.length} записей из вчера`);
  };

  const selectedDateTotals = useMemo(() => {
    return entries.reduce(
      (acc, e) => ({
        calories: acc.calories + e.calories,
        protein: acc.protein + e.protein,
        fat: acc.fat + e.fat,
        carbs: acc.carbs + e.carbs,
      }),
      { calories: 0, protein: 0, fat: 0, carbs: 0 },
    );
  }, [entries]);

  const suggestions = useMemo(() => {
    if (!norm || entries.length === 0) return [];
    const results: string[] = [];
    
    const calPercent = (selectedDateTotals.calories / norm.calories) * 100;
    const proteinPercent = (selectedDateTotals.protein / norm.protein) * 100;
    const fatPercent = (selectedDateTotals.fat / norm.fat) * 100;
    const carbsPercent = (selectedDateTotals.carbs / norm.carbs) * 100;
    
    if (calPercent < 70) {
      const missing = norm.calories - selectedDateTotals.calories;
      results.push(`Не хватает ${missing} ккал до нормы`);
    } else if (calPercent > 110) {
      const over = selectedDateTotals.calories - norm.calories;
      results.push(`Норма калорий превышена на ${over} ккал`);
    }
    
    if (proteinPercent < 70) {
      const missing = Math.round(norm.protein - selectedDateTotals.protein);
      results.push(`Белка не хватает ${missing}г`);
    }
    
    if (fatPercent < 70) {
      const missing = Math.round(norm.fat - selectedDateTotals.fat);
      results.push(`Жиров не хватает ${missing}г`);
    }
    
    if (carbsPercent < 70) {
      const missing = Math.round(norm.carbs - selectedDateTotals.carbs);
      results.push(`Углеводов не хватает ${missing}г`);
    }
    
    if (calPercent >= 90 && calPercent <= 110 && proteinPercent >= 90 && fatPercent >= 90 && carbsPercent >= 90) {
      results.push('Отлично! Все показатели в норме 🎉');
    }
    
    return results;
  }, [norm, entries, selectedDateTotals]);

  const isToday = selectedDate === (() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  })();

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
                <h2 className="text-xl font-bold">{isToday ? 'Сегодня' : formatDate(selectedDate)}</h2>
                <p className="text-sm text-muted-foreground">
                  {selectedDateTotals.calories} из {norm.calories} ккал · осталось{" "}
                  <span className="font-semibold text-foreground">
                    {Math.max(0, norm.calories - selectedDateTotals.calories)}
                  </span>{" "}
                  ккал
                </p>
              </div>
              {!isToday && (
                <Button onClick={goToToday} variant="outline" size="sm">
                  <Calendar className="h-4 w-4 mr-2" />
                  Сегодня
                </Button>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 justify-items-center">
              <MacroRing consumed={selectedDateTotals.calories} total={norm.calories} label="Калории" unit=" ккал" colorVar="--macro-calories" />
              <MacroRing consumed={selectedDateTotals.protein} total={norm.protein} label="Белки" colorVar="--macro-protein" />
              <MacroRing consumed={selectedDateTotals.fat} total={norm.fat} label="Жиры" colorVar="--macro-fat" />
              <MacroRing consumed={selectedDateTotals.carbs} total={norm.carbs} label="Углеводы" colorVar="--macro-carbs" />
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

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <section className="container max-w-5xl mb-8">
          <Card className="p-4 md:p-5 shadow-soft border-border/50 backdrop-blur-sm bg-card/80 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">💡</span>
              <h3 className="text-sm font-semibold">Рекомендации на сегодня</h3>
            </div>
            <div className="space-y-1.5">
              {suggestions.map((tip, i) => (
                <div key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                  <span className="mt-0.5">•</span>
                  <span>{tip}</span>
                </div>
              ))}
            </div>
          </Card>
        </section>
      )}

      {/* Diary */}
      <section className="container max-w-5xl pb-20">
        <Card className="p-6 md:p-8 shadow-card border-border/50 backdrop-blur-sm bg-card/80 mb-6">
          {/* Date Navigation */}
          <div className="flex items-center justify-between mb-6">
            <Button
              onClick={() => navigateDate('prev')}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            <div className="text-center">
              <h3 className="text-lg font-semibold">{formatDate(selectedDate)}</h3>
              {isToday && <p className="text-sm text-muted-foreground">Сегодня</p>}
            </div>
            
            <Button
              onClick={() => navigateDate('next')}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          {isToday && entries.length === 0 && (
            <div className="flex justify-center mt-3">
              <Button
                onClick={handleRepeatYesterday}
                variant="outline"
                size="sm"
                className="text-sm gap-2"
              >
                🔁 Повторить вчера
              </Button>
            </div>
          )}
        </Card>
        
        <Diary entries={entries} onAdd={handleAddEntry} onRemove={handleRemoveEntry} />
      </section>

      <footer className="container py-8 text-center text-xs text-muted-foreground border-t border-border/40">
        Данные синхронизируются через Firebase
      </footer>
      <div className="h-8" />
    </div>
  );
};

export default Index;
