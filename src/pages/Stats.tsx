import { useEffect, useState, useMemo } from "react";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MonthPicker } from "@/components/ui/month-picker";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { BarChart3, TrendingUp, Activity, Weight, X, Trash2 } from "lucide-react";
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
import { loadDiaryRange, saveWeight, loadWeight, loadFullNormData, saveNorm as saveNormToFirestore, loadActivity, deleteDiaryEntry } from "@/lib/firestore";
import { recalculateNormWithNewWeight } from "@/lib/nutrition";
import type { DiaryEntry } from "@/lib/storage";
import type { MacroResult } from "@/lib/nutrition";
import { toast } from "sonner";

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
  const [isInterestingOpen, setIsInterestingOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [monthlyDetailEntries, setMonthlyDetailEntries] = useState<DiaryEntry[]>([]);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<string | null>(null);
  const [dayEntries, setDayEntries] = useState<DiaryEntry[]>([]);
  const [dayActivity, setDayActivity] = useState<any | null>(null);
  const [loadingDay, setLoadingDay] = useState(false);

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
        
        const startDateStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;
        const endDateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        
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

  useEffect(() => {
    const loadMonthlyDetail = async () => {
      if (!user || !isInterestingOpen) return;
      const [year, month] = selectedMonth.split('-').map(Number);
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;
      const entries = await loadDiaryRange(user.uid, startDate, endDate);
      setMonthlyDetailEntries(entries);
    };
    loadMonthlyDetail();
  }, [user, isInterestingOpen, selectedMonth]);

  // Aggregate entries by day for the last 7 days
  const weeklyData = useMemo(() => {
    const today = new Date();
    const data: DayData[] = [];
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
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
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
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

  // Product statistics for interesting stats section
  const productStats = useMemo(() => {
    const map = new Map<string, {
      name: string;
      totalGrams: number;
      totalCalories: number;
      totalProtein: number;
      totalCarbs: number;
      totalFat: number;
      count: number;
    }>();

    monthlyDetailEntries.forEach(entry => {
      const existing = map.get(entry.name);
      if (existing) {
        existing.totalGrams += entry.grams;
        existing.totalCalories += entry.calories;
        existing.totalProtein += entry.protein;
        existing.totalCarbs += entry.carbs;
        existing.totalFat += entry.fat;
        existing.count += 1;
      } else {
        map.set(entry.name, {
          name: entry.name,
          totalGrams: entry.grams,
          totalCalories: entry.calories,
          totalProtein: entry.protein,
          totalCarbs: entry.carbs,
          totalFat: entry.fat,
          count: 1,
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => b.totalCalories - a.totalCalories);
  }, [monthlyDetailEntries]);

  // Monthly totals summary
  const monthlyTotals = useMemo(() => {
    return productStats.reduce((acc, p) => ({
      grams: acc.grams + p.totalGrams,
      calories: acc.calories + p.totalCalories,
      protein: acc.protein + p.totalProtein,
      carbs: acc.carbs + p.totalCarbs,
      fat: acc.fat + p.totalFat,
    }), { grams: 0, calories: 0, protein: 0, carbs: 0, fat: 0 });
  }, [productStats]);

  const handleDayClick = async (dayNumber: number) => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`;
    
    setSelectedDay(dateStr);
    setLoadingDay(true);
    
    try {
      const [entries, activity] = await Promise.all([
        loadDiaryRange(user!.uid, dateStr, dateStr),
        loadActivity(user!.uid, dateStr),
      ]);
      setDayEntries(entries);
      setDayActivity(activity);
    } catch (error) {
      console.error('Error loading day details:', error);
    } finally {
      setLoadingDay(false);
    }
  };

  const handleRemoveEntry = async (id: string) => {
    setEntryToDelete(id);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!entryToDelete) return;
    try {
      await deleteDiaryEntry(user.uid, entryToDelete);
      setMonthlyDetailEntries(prev => prev.filter(e => e.id !== entryToDelete));
      toast.success('Запись удалена');
    } catch (error) {
      toast.error('Ошибка удаления записи');
    } finally {
      setDeleteConfirmOpen(false);
      setEntryToDelete(null);
    }
  };

  const cancelDelete = () => {
    setDeleteConfirmOpen(false);
    setEntryToDelete(null);
  };

  const handleSaveWeight = async () => {
    console.log('handleSaveWeight: Starting...');
    console.log('handleSaveWeight: Current user:', user?.uid);
    console.log('handleSaveWeight: Weight input:', weightInput);
    
    if (!user || !weightInput) return;
    
    const weight = parseFloat(weightInput);
    if (isNaN(weight) || weight <= 0) return;

    try {
      const today = new Date().toISOString().split('T')[0];
      console.log('handleSaveWeight: Saving weight:', weight, 'for date:', today, 'user:', user.uid);
      await saveWeight(user.uid, weight, today);
      console.log('handleSaveWeight: Weight saved successfully');
      
      // Reload weight entries
      const weights = await loadWeight(user.uid, 10);
      setWeightEntries(weights);
      setWeightInput("");
      
      // Auto-recalculate norm with new weight
      const currentNormData = await loadFullNormData(user.uid);
      if (currentNormData && currentNormData.gender) {
        const newNormResult = recalculateNormWithNewWeight(currentNormData, weight);
        await saveNormToFirestore(user.uid, newNormResult, {
          gender: currentNormData.gender,
          height: currentNormData.height,
          age: currentNormData.age,
          goal: currentNormData.goal,
        });
        
        // Update local norm state
        setNorm(newNormResult);
        
        toast.success(`Вес сохранён. Норма КБЖУ пересчитана: ${newNormResult.calories} ккал`);
      } else {
        toast.success('Вес сохранён');
      }
    } catch (error) {
      console.error("Failed to save weight:", error);
      toast.error('Ошибка сохранения веса');
    }
  };

  const currentMonth = MONTHS[new Date().getMonth()];
  const currentYear = new Date().getFullYear();
  const firstDayOfMonth = new Date(currentYear, new Date().getMonth(), 1).getDay();
  const calendarOffset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

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
        
        {/* SECTION 1 - Weekly Chart */}
        <Card className="p-5 md:p-6 bg-card/80 backdrop-blur-sm border-border/50 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">Калории за неделю</h2>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }} barCategoryGap="5%" barGap={0}>
                <CartesianGrid
                  vertical={true}
                  horizontal={true}
                  strokeDasharray="3 3"
                  stroke="rgba(107, 107, 138, 0.2)"
                  verticalCoordinatesGenerator={(props) => {
                    const { width, offset } = props;
                    const step = (width - offset.left - offset.right) / 7;
                    return Array.from({ length: 6 }, (_, i) => offset.left + step * (i + 1));
                  }}
                />
                <XAxis 
                  dataKey="label" 
                  tick={{ fill: '#6B6B8A', fontSize: 11 }} 
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip
                  cursor={{ fill: 'transparent' }}
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
                  fill="hsl(var(--foreground))"
                  radius={[10, 10, 0, 0]}
                  activeBar={false}
                  onClick={(data) => {
                    // Handle bar click if needed
                    console.log('Bar clicked:', data);
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <div className="grid md:grid-cols-2 gap-6 mb-6">
          {/* SECTION 2 - Monthly Overview */}
          <Card className="p-5 md:p-6 bg-card/80 backdrop-blur-sm border-border/50">
            <div className="mb-4 text-left">
              <h2 className="font-semibold">{currentMonth} {currentYear}</h2>
            </div>
            <div className="grid grid-cols-7 gap-1 text-xs">
              {WEEKDAYS.map(day => (
                <div key={day} className="text-center font-medium text-muted-foreground p-1">
                  {day}
                </div>
              ))}
              {/* Empty offset cells */}
              {Array.from({ length: calendarOffset }).map((_, i) => (
                <div key={`empty-${i}`} className="aspect-square" />
              ))}
              {/* Day cells */}
              {monthlyData.map((day, index) => (
                <div
                  key={index}
                  onClick={() => handleDayClick(day.date)}
                  className={`aspect-square rounded cursor-pointer hover:opacity-80 transition-smooth ${day.color} flex items-center justify-center font-medium relative`}
                >
                  <span className={`text-xs ${day.calories > 0 ? 'text-white font-medium' : 'text-gray-500'}`}>
                    {day.date}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex gap-4 mt-4 text-xs">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-green-500 rounded-full" style={{ width: '12px', height: '12px', aspectRatio: '1/1' }}></div>
                <span>90-110%</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-yellow-500 rounded-full" style={{ width: '12px', height: '12px', aspectRatio: '1/1' }}></div>
                <span>70-90% / 110-130%</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-red-500 rounded-full" style={{ width: '12px', height: '12px', aspectRatio: '1/1' }}></div>
                <span>&lt;70% / &gt;130%</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-gray-200 rounded-full" style={{ width: '12px', height: '12px', aspectRatio: '1/1' }}></div>
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
                <Button 
                  onClick={handleSaveWeight} 
                  disabled={!weightInput}
                  className="flex items-center gap-3 rounded-2xl bg-gradient-to-r from-[#0a0520] to-[#1a0a3d] px-8 py-4 text-foreground font-bold text-lg shadow-glow hover:opacity-90 transition-smooth"
                >
                  Сохранить вес
                </Button>
              </div>
              
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground">Последние записи</h3>
                {weightEntries.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Нет данных</p>
                ) : (
                  <div className="space-y-1">
                    {weightEntries.slice(0, 3).map((entry) => (
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
                        stroke="hsl(var(--foreground))"
                        strokeWidth={2}
                        dot={{ fill: "hsl(var(--foreground))", r: 3 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* SECTION 5 - Interesting Statistics */}
        <Card className="p-5 md:p-6 bg-card/80 backdrop-blur-sm border-border/50">
          <button
            onClick={() => setIsInterestingOpen(!isInterestingOpen)}
            className="w-full flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">🔍</span>
              <h2 className="font-semibold">Интересная статистика</h2>
            </div>
            <span className="text-muted-foreground text-sm">{isInterestingOpen ? '▲' : '▼'}</span>
          </button>

          {isInterestingOpen && (
            <div className="mt-4 space-y-4">
              {/* Month selector */}
              <div className="flex items-center gap-2">
                <label className="text-sm text-muted-foreground">Месяц:</label>
                <MonthPicker
                  value={selectedMonth}
                  onChange={setSelectedMonth}
                />
              </div>

              {/* Monthly totals summary */}
              {productStats.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Всего съедено', value: `${monthlyTotals.grams.toLocaleString()}г`, icon: '⚖️' },
                    { label: 'Калорий', value: `${monthlyTotals.calories.toLocaleString()} ккал`, icon: '🔥' },
                    { label: 'Белков', value: `${Math.round(monthlyTotals.protein)}г`, icon: '💪' },
                    { label: 'Углеводов', value: `${Math.round(monthlyTotals.carbs)}г`, icon: '🌾' },
                  ].map(stat => (
                    <div key={stat.label} className="rounded-xl bg-muted/40 p-3">
                      <div className="text-lg">{stat.icon}</div>
                      <div className="font-bold">{stat.value}</div>
                      <div className="text-xs text-muted-foreground">{stat.label}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Per product breakdown */}
              {productStats.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Нет данных за этот месяц</p>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">По продуктам</p>
                  {productStats.map(p => (
                    <div key={p.name} className="rounded-xl bg-muted/30 px-4 py-3">
                      <div className="flex justify-between items-start mb-[5px]">
                        <span className="font-medium text-sm">{p.name}</span>
                        <span className="text-xs text-muted-foreground">{p.count} раз</span>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span>⚖️ {p.totalGrams.toLocaleString()}г</span>
                        <span>🔥 {p.totalCalories.toLocaleString()} ккал</span>
                        <span>💪 Б {Math.round(p.totalProtein)}г</span>
                        <span>🌾 У {Math.round(p.totalCarbs)}г</span>
                        <span>🧈 Ж {Math.round(p.totalFat)}г</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </Card>

        {/* Day Detail Modal */}
        {selectedDay && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
            <div onClick={() => setSelectedDay(null)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <div className="relative w-full sm:max-w-lg bg-background border border-border/50 rounded-t-3xl sm:rounded-2xl shadow-2xl p-6 max-h-[85vh] overflow-y-auto">
              
              {/* Header */}
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-xl font-bold">
                    {new Date(selectedDay + 'T00:00:00').toLocaleDateString('ru-RU', { 
                      weekday: 'long', day: 'numeric', month: 'long' 
                    })}
                  </h2>
                  <p className="text-sm text-muted-foreground">Детальная статистика</p>
                </div>
                <button
                  onClick={() => setSelectedDay(null)}
                  className="rounded-xl p-2 hover:bg-muted/50 transition-smooth"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {loadingDay ? (
                <div className="text-center py-8 text-muted-foreground">Загрузка...</div>
              ) : (
                <>
                  {/* Totals */}
                  {dayEntries.length > 0 ? (
                    <>
                      {(() => {
                        const totals = dayEntries.reduce((acc, e) => ({
                          calories: acc.calories + e.calories,
                          protein: acc.protein + e.protein,
                          fat: acc.fat + e.fat,
                          carbs: acc.carbs + e.carbs,
                        }), { calories: 0, protein: 0, fat: 0, carbs: 0 });

                        return (
                          <>
                            {/* Summary grid */}
                            <div className="grid grid-cols-2 gap-3 mb-5">
                              {[
                                { label: 'Калории', value: `${totals.calories} ккал`, norm: norm?.calories, icon: '🔥' },
                                { label: 'Белки', value: `${Math.round(totals.protein)}г`, norm: norm?.protein, icon: '💪' },
                                { label: 'Жиры', value: `${Math.round(totals.fat)}г`, norm: norm?.fat, icon: '🧈' },
                                { label: 'Углеводы', value: `${Math.round(totals.carbs)}г`, norm: norm?.carbs, icon: '🌾' },
                              ].map(stat => (
                                <div key={stat.label} className="rounded-xl bg-muted/40 p-3">
                                  <div className="text-lg mb-1">{stat.icon}</div>
                                  <div className="font-bold">{stat.value}</div>
                                  <div className="text-xs text-muted-foreground">{stat.label}</div>
                                  {stat.norm && (
                                    <div className="text-xs mt-1">
                                      <span className={
                                        (stat.label === 'Калории' ? totals.calories : 
                                         stat.label === 'Белки' ? totals.protein :
                                         stat.label === 'Жиры' ? totals.fat : totals.carbs) / stat.norm >= 0.9
                                          ? 'text-green-400' : 'text-yellow-400'
                                      }>
                                        {Math.round(
                                          (stat.label === 'Калории' ? totals.calories : 
                                           stat.label === 'Белки' ? totals.protein :
                                           stat.label === 'Жиры' ? totals.fat : totals.carbs) / stat.norm * 100
                                        )}% от нормы
                                      </span>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>

                            {/* Activity */}
                            {dayActivity && dayActivity.caloriesBurned > 0 && (
                              <div className="rounded-xl bg-muted/30 px-4 py-3 mb-4 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span>{dayActivity.type === 'calories' ? '⌚' : '👣'}</span>
                                  <span className="text-sm font-medium">
                                    {dayActivity.type === 'calories' ? 'Apple Watch' : 
                                     dayActivity.type === 'steps' ? `${dayActivity.value.toLocaleString()} шагов` : 'Дома'}
                                  </span>
                                </div>
                                <span className="text-sm font-bold text-green-400">+{dayActivity.caloriesBurned} ккал</span>
                              </div>
                            )}

                            {/* Deficit */}
                            {norm && dayActivity !== undefined && (
                              <div className="rounded-xl bg-muted/30 px-4 py-3 mb-5 grid grid-cols-3 gap-2 text-center">
                                <div>
                                  <div className="text-xs text-muted-foreground mb-1">Сожжено</div>
                                  <div className="font-bold text-sm">{norm.bmr + (dayActivity?.caloriesBurned || 0)} ккал</div>
                                </div>
                                <div>
                                  <div className="text-xs text-muted-foreground mb-1">Съедено</div>
                                  <div className="font-bold text-sm">{totals.calories} ккал</div>
                                </div>
                                <div>
                                  <div className="text-xs text-muted-foreground mb-1">Дефицит</div>
                                  <div className={`font-bold text-sm ${
                                    (norm.bmr + (dayActivity?.caloriesBurned || 0)) - totals.calories > 0 
                                      ? 'text-green-400' : 'text-red-400'
                                  }`}>
                                    {(() => {
                                      const d = (norm.bmr + (dayActivity?.caloriesBurned || 0)) - totals.calories;
                                      return `${d > 0 ? '+' : ''}${d} ккал`;
                                    })()}
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Foods list */}
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Съедено</p>
                              <div className="space-y-2">
                                {dayEntries.map((entry) => (
                                  <div key={entry.id} className="rounded-xl bg-muted/30 px-3 py-2.5">
                                    <div className="flex justify-between items-start">
                                      <span className="text-sm font-medium">{entry.name}</span>
                                      <span className="text-xs font-bold text-macro-calories">{entry.calories} ккал</span>
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-0.5">
                                      {entry.grams > 1 ? `${entry.grams}г` : '1 порция'} · Б {entry.protein}г · Ж {entry.fat}г · У {entry.carbs}г
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </>
                        );
                      })()}
                    </>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <div className="text-4xl mb-3">📭</div>
                      <p className="text-sm">Нет записей за этот день</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Eaten Foods List */}
      {monthlyDetailEntries.length > 0 && (
        <Card className="p-5 md:p-6 shadow-card border-border/50 backdrop-blur-sm bg-card/80">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Съедено</h3>
            <span className="text-xs text-muted-foreground">{monthlyDetailEntries.length} шт.</span>
          </div>
          <div className="space-y-2">
            {monthlyDetailEntries.slice().reverse().map((e) => (
              <div
                key={e.id}
                className="flex items-center justify-between gap-2 rounded-xl bg-muted/40 px-3 py-2.5 group hover:bg-muted/70 transition-smooth"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{e.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {e.grams > 1 ? `${e.grams}г · ` : '1 порция · '}
                    <span className="text-macro-calories font-semibold">{e.calories}</span> ккал ·
                    Б {e.protein}г · Ж {e.fat}г · У {e.carbs}г
                  </div>
                </div>
                <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
                  <AlertDialogTrigger asChild>
                    <button
                      onClick={() => handleRemoveEntry(e.id)}
                      className="opacity-60 sm:opacity-0 sm:group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-smooth p-1 shrink-0"
                      aria-label="Удалить"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Удалить запись?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Вы уверены, что хотите удалить "{e.name}"? Это действие нельзя отменить.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel onClick={cancelDelete}>Отмена</AlertDialogCancel>
                      <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        Удалить
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ))}
          </div>
        </Card>
      )}
      <div className="h-8" />
    </div>
  );
};

export default Stats;
