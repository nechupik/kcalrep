import { useEffect, useState, useMemo } from "react";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BarChart3, TrendingUp, Activity, Weight } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceLine,
} from "recharts";
import { useAuth } from "@/contexts/AuthContext";
import { loadNorm } from "@/lib/storage";
import { loadDiaryRange, saveWeight, loadWeight } from "@/lib/firestore";
import type { DiaryEntry } from "@/lib/storage";
import type { MacroResult } from "@/lib/nutrition";

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const MONTHS = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
];

interface DayData {
  date: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  count: number;
  label: string;
}

interface WeightData {
  id: string;
  weight: number;
  date: string;
}

const Stats = () => {
  const { user } = useAuth();
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [norm, setNorm] = useState<MacroResult | null>(null);
  const [weightEntries, setWeightEntries] = useState<WeightData[]>([]);
  const [weightInput, setWeightInput] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      if (!user) return;

      try {
        setLoading(true);
        
        // Load norm
        const userNorm = await loadNorm();
        setNorm(userNorm);

        // Load diary entries for last 7 days
        const today = new Date();
        const startDate = new Date(today);
        startDate.setDate(today.getDate() - 6);
        
        const startDateStr = startDate.toISOString().split('T')[0];
        const endDateStr = today.toISOString().split('T')[0];
        
        const diaryEntries = await loadDiaryRange(user.uid, startDateStr, endDateStr);
        setEntries(diaryEntries);

        // Load weight entries
        const weights = await loadWeight(user.uid, 10);
        setWeightEntries(weights);
      } catch (error) {
        console.error("Failed to load data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user]);

  // Aggregate entries by day for the last 7 days
  const weeklyData = useMemo(() => {
    const today = new Date();
    const data: DayData[] = [];
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const dayOfWeek = date.getDay();
      const weekdayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Convert to Monday=0 index
      
      const dayEntries = entries.filter(entry => entry.date === dateStr);
      const totals = dayEntries.reduce(
        (acc, entry) => ({
          calories: acc.calories + entry.calories,
          protein: acc.protein + entry.protein,
          fat: acc.fat + entry.fat,
          carbs: acc.carbs + entry.carbs,
        }),
        { calories: 0, protein: 0, fat: 0, carbs: 0 }
      );
      
      data.push({
        date: dateStr,
        ...totals,
        count: dayEntries.length,
        label: WEEKDAYS[weekdayIndex],
      });
    }
    
    return data;
  }, [entries]);

  // Monthly overview data
  const monthlyData = useMemo(() => {
    if (!norm) return [];
    
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    const days: Array<{ date: number; calories: number; color: string }> = [];
    
    for (let day = 1; day <= lastDay.getDate(); day++) {
      const date = new Date(year, month, day);
      const dateStr = date.toISOString().split('T')[0];
      const dayEntries = entries.filter(entry => entry.date === dateStr);
      
      const calories = dayEntries.reduce((sum, entry) => sum + entry.calories, 0);
      const percentage = norm.calories > 0 ? (calories / norm.calories) * 100 : 0;
      
      let color = "bg-gray-200"; // No data
      if (dayEntries.length > 0) {
        if (percentage >= 90 && percentage <= 110) {
          color = "bg-green-500";
        } else if ((percentage >= 70 && percentage < 90) || (percentage > 110 && percentage <= 130)) {
          color = "bg-yellow-500";
        } else {
          color = "bg-red-500";
        }
      }
      
      days.push({ date: day, calories, color });
    }
    
    return days;
  }, [entries, norm]);

  // Averages calculation
  const averages = useMemo(() => {
    const activeDays = weeklyData.filter(d => d.count > 0);
    if (activeDays.length === 0) {
      return {
        avgCalories: 0,
        avgProtein: 0,
        avgFat: 0,
        avgCarbs: 0,
        daysTracked: 0,
        withinNormPercent: 0,
      };
    }

    const totals = activeDays.reduce(
      (acc, day) => ({
        calories: acc.calories + day.calories,
        protein: acc.protein + day.protein,
        fat: acc.fat + day.fat,
        carbs: acc.carbs + day.carbs,
      }),
      { calories: 0, protein: 0, fat: 0, carbs: 0 }
    );

    const daysWithinNorm = norm 
      ? activeDays.filter(day => {
          const percentage = (day.calories / norm.calories) * 100;
          return percentage >= 90 && percentage <= 110;
        }).length
      : 0;

    return {
      avgCalories: Math.round(totals.calories / activeDays.length),
      avgProtein: Math.round(totals.protein / activeDays.length),
      avgFat: Math.round(totals.fat / activeDays.length),
      avgCarbs: Math.round(totals.carbs / activeDays.length),
      daysTracked: activeDays.length,
      withinNormPercent: Math.round((daysWithinNorm / activeDays.length) * 100),
    };
  }, [weeklyData, norm]);

  // Weight chart data
  const weightChartData = useMemo(() => {
    return weightEntries
      .slice()
      .reverse()
      .map(entry => ({
        date: new Date(entry.date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }),
        weight: entry.weight,
      }));
  }, [weightEntries]);

  const handleSaveWeight = async () => {
    if (!user || !weightInput) return;
    
    const weight = parseFloat(weightInput);
    if (isNaN(weight) || weight <= 0) return;

    try {
      const today = new Date().toISOString().split('T')[0];
      await saveWeight(user.uid, weight, today);
      
      // Reload weight entries
      const weights = await loadWeight(user.uid, 10);
      setWeightEntries(weights);
      setWeightInput("");
    } catch (error) {
      console.error("Failed to save weight:", error);
    }
  };

  const currentMonth = MONTHS[new Date().getMonth()];
  const currentYear = new Date().getFullYear();

  if (loading) {
    return (
      <div className="min-h-screen">
        <AppHeader />
        <div className="container max-w-5xl pt-6 pb-12">
          <div className="text-center">Загрузка...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <AppHeader />

      <section className="container max-w-5xl pt-6 pb-12">
        <div className="flex items-center gap-3 mb-6">
          <div className="rounded-xl bg-gradient-violet p-2.5 shadow-soft">
            <BarChart3 className="h-5 w-5 text-accent-foreground" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Статистика</h1>
            <p className="text-sm text-muted-foreground">Анализ вашего питания и прогресса</p>
          </div>
        </div>

        {/* SECTION 1 - Weekly Chart */}
        <Card className="p-5 md:p-6 bg-card/80 backdrop-blur-sm border-border/50 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">Калории за неделю</h2>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
                <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "0.75rem",
                    color: "hsl(var(--popover-foreground))",
                  }}
                />
                {norm && (
                  <ReferenceLine
                    y={norm.calories}
                    stroke="hsl(var(--accent))"
                    strokeDasharray="4 4"
                    label={{ value: "норма", fill: "hsl(var(--accent))", fontSize: 11, position: "right" }}
                  />
                )}
                <Bar
                  dataKey="calories"
                  fill="hsl(var(--macro-calories))"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <div className="grid md:grid-cols-2 gap-6 mb-6">
          {/* SECTION 2 - Monthly Overview */}
          <Card className="p-5 md:p-6 bg-card/80 backdrop-blur-sm border-border/50">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="h-4 w-4 text-secondary" />
              <h2 className="font-semibold">{currentMonth} {currentYear}</h2>
            </div>
            <div className="grid grid-cols-7 gap-1 text-xs">
              {WEEKDAYS.map(day => (
                <div key={day} className="text-center font-medium text-muted-foreground p-1">
                  {day}
                </div>
              ))}
              {monthlyData.map((day, index) => (
                <div
                  key={index}
                  className={`aspect-square rounded ${day.color} flex items-center justify-center text-white font-medium relative`}
                >
                  {day.calories > 0 && (
                    <span className="text-xs">{day.date}</span>
                  )}
                </div>
              ))}
            </div>
            <div className="flex gap-4 mt-4 text-xs">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-green-500 rounded"></div>
                <span>90-110%</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-yellow-500 rounded"></div>
                <span>70-90% / 110-130%</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-red-500 rounded"></div>
                <span>&lt;70% / &gt;130%</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-gray-200 rounded"></div>
                <span>Нет данных</span>
              </div>
            </div>
          </Card>

          {/* SECTION 3 - Averages Card */}
          <Card className="p-5 md:p-6 bg-card/80 backdrop-blur-sm border-border/50">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="h-4 w-4 text-tertiary" />
              <h2 className="font-semibold">Средние показатели (7 дней)</h2>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Калории</span>
                <span className="font-semibold">
                  {averages.avgCalories} {norm && `/ ${norm.calories}`}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Белки</span>
                <span className="font-semibold">{averages.avgProtein}г</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Жиры</span>
                <span className="font-semibold">{averages.avgFat}г</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Углеводы</span>
                <span className="font-semibold">{averages.avgCarbs}г</span>
              </div>
              <div className="border-t pt-3 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Дней отслежено</span>
                  <span className="font-semibold">{averages.daysTracked} / 7</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">В норме (±10%)</span>
                  <span className="font-semibold">{averages.withinNormPercent}%</span>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* SECTION 4 - Weight Tracking */}
        <Card className="p-5 md:p-6 bg-card/80 backdrop-blur-sm border-border/50">
          <div className="flex items-center gap-2 mb-4">
            <Weight className="h-4 w-4 text-macro-protein" />
            <h2 className="font-semibold">Мой вес</h2>
          </div>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <div className="flex gap-2 mb-4">
                <Input
                  type="number"
                  step="0.1"
                  placeholder="Вес в кг"
                  value={weightInput}
                  onChange={(e) => setWeightInput(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={handleSaveWeight} disabled={!weightInput}>
                  Сохранить вес
                </Button>
              </div>
              
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground">Последние записи</h3>
                {weightEntries.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Нет данных</p>
                ) : (
                  <div className="space-y-1">
                    {weightEntries.slice(0, 5).map((entry) => (
                      <div key={entry.id} className="flex justify-between text-sm">
                        <span>{new Date(entry.date).toLocaleDateString('ru-RU')}</span>
                        <span className="font-medium">{entry.weight} кг</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">График веса</h3>
              <div className="h-48">
                {weightChartData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    Нет данных
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={weightChartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                      <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
                      <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} />
                      <Tooltip
                        contentStyle={{
                          background: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "0.75rem",
                          color: "hsl(var(--popover-foreground))",
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="weight"
                        stroke="hsl(var(--macro-protein))"
                        strokeWidth={2}
                        dot={{ fill: "hsl(var(--macro-protein))", r: 3 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>
        </Card>
      </section>
      <div className="h-8" />
    </div>
  );
};


export default Stats;
