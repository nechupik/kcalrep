import { useEffect, useState, useMemo } from "react";
import { AppHeader } from "@/components/AppHeader";
import { EatenFoodsList } from "@/components/EatenFoodsList";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MonthPicker } from "@/components/ui/month-picker";
import { UserDataViewer } from "@/components/UserDataViewer";
import { BarChart3, TrendingUp, Activity, X, Eye, Brain, Clock } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceLine,
  Area,
  AreaChart,
} from "recharts";
import { useAuth } from "@/contexts/AuthContext";
import { ADMIN_UID } from "@/lib/config";
import { toDateStr } from "@/lib/utils";
import { applyCycleAdjustmentToNorm, loadNorm } from "@/lib/storage";
import { loadDiaryRange, loadWeight, loadFullNormData, deleteDiaryEntry, loadActivityRange, loadNormHistory, type ActivityEntry, type NormHistoryEntry } from "@/lib/firestore";
import { loadCycles } from "@/lib/metabolic-firestore";
import { getCycleCalorieAdjustmentForDate } from "@/lib/cycle-engine";
import { type NutritionAnalyticsInput } from "@/lib/nutritionAnalytics";
import { analyzeWithGemini, type AIAnalyticsResult } from "@/lib/gemini";
import type { DiaryEntry } from "@/lib/storage";
import type { MacroResult } from "@/lib/nutrition";
import type { CycleEntry } from "@/lib/metabolic-types";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  targetCalories: number;
  targetProtein: number;
  targetFat: number;
  targetCarbs: number;
}

interface WeightData {
  id: string;
  weight: number;
  date: string;
}

function dateRange(startDate: Date, endDate: Date): string[] {
  const dates: string[] = [];
  const cursor = new Date(startDate);
  cursor.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);

  while (cursor <= end) {
    dates.push(toDateStr(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}

function buildEffectiveNormsByDate(
  baseNorm: MacroResult | null,
  normHistory: NormHistoryEntry[],
  cycles: CycleEntry[],
  dates: string[]
): Record<string, MacroResult> {
  if (!baseNorm) return {};

  return dates.reduce<Record<string, MacroResult>>((acc, date) => {
    const historyEntry = normHistory.filter(h => h.date <= date).at(-1);
    const base: MacroResult = historyEntry ? {
      calories: historyEntry.calories,
      protein: historyEntry.protein,
      fat: historyEntry.fat,
      carbs: historyEntry.carbs,
      bmr: historyEntry.bmr,
      tdee: historyEntry.tdee,
      activityFactor: historyEntry.activityFactor,
      activityLabel: historyEntry.activityLabel as any,
      goalMultiplier: historyEntry.goalMultiplier,
    } : baseNorm;

    const adjustment = getCycleCalorieAdjustmentForDate(cycles, date);
    acc[date] = applyCycleAdjustmentToNorm(base, adjustment);
    return acc;
  }, {});
}

const Stats = () => {
  const { user } = useAuth();
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [norm, setNorm] = useState<MacroResult | null>(null);
  const [normsByDate, setNormsByDate] = useState<Record<string, MacroResult>>({});
  const [weightEntries, setWeightEntries] = useState<WeightData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isInterestingOpen, setIsInterestingOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [monthlyDetailEntries, setMonthlyDetailEntries] = useState<DiaryEntry[]>([]);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [dayEntries, setDayEntries] = useState<DiaryEntry[]>([]);
  const [loadingDay, setLoadingDay] = useState(false);
  const [showUserDataViewer, setShowUserDataViewer] = useState(false);
  const [isDayModalOpen, setIsDayModalOpen] = useState(false);
  const [animationState, setAnimationState] = useState<'enter' | 'exit' | null>(null);
  const [analytics, setAnalytics] = useState<AIAnalyticsResult | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [productPage, setProductPage] = useState(1);
  const [activityWeekData, setActivityWeekData] = useState<ActivityEntry[]>([]);
  const PRODUCTS_PER_PAGE = 10;
  // Control modal animation
  useEffect(() => {
    if (selectedDay) {
      setAnimationState('enter');
    } else {
      setAnimationState('exit');
      setTimeout(() => {
        setAnimationState(null);
      }, 650);
    }
  }, [selectedDay]);

  useEffect(() => {
    const loadData = async () => {
      if (!user) return;

      try {
        setLoading(true);
        
        const userNorm = await loadNorm();
        setNorm(userNorm);

        // Load diary entries for last 30 days (covers both weekly chart and analytics)
        const today = new Date();
        const startDate = new Date(today);
        startDate.setDate(today.getDate() - 29);

        const startDateStr = toDateStr(startDate);
        const endDateStr = toDateStr(today);

        const today7Start = new Date(today);
        today7Start.setDate(today.getDate() - 6);
        const start7Str = toDateStr(today7Start);
        const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        const normStartDate = currentMonthStart < startDate ? currentMonthStart : startDate;
        const normDates = dateRange(normStartDate, today);

        const diaryPromise = loadDiaryRange(user.uid, startDateStr, endDateStr);
        const weightPromise = loadWeight(user.uid, 30);
        const cyclesPromise = userNorm
          ? loadCycles(user.uid).catch((error) => {
              console.error("Failed to load cycles for effective norms:", error);
              return [] as CycleEntry[];
            })
          : Promise.resolve([] as CycleEntry[]);
        const activityPromise = user.uid === ADMIN_UID
          ? loadActivityRange(user.uid, start7Str, endDateStr)
          : Promise.resolve([] as ActivityEntry[]);
        const normHistoryPromise = loadNormHistory(user.uid, endDateStr).catch(() => [] as NormHistoryEntry[]);

        const [diaryEntries, weights, cycles, activityEntries, normHistory] = await Promise.all([
          diaryPromise,
          weightPromise,
          cyclesPromise,
          activityPromise,
          normHistoryPromise,
        ]);
        setNormsByDate(buildEffectiveNormsByDate(userNorm, normHistory, cycles, normDates));
        setEntries(diaryEntries);
        setWeightEntries(weights);
        if (user.uid === ADMIN_UID) {
          setActivityWeekData(activityEntries);
        }
      } catch (error) {
        console.error("Failed to load data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user]);

  // Try to load cached AI analytics on mount
  useEffect(() => {
    if (!user) return;
    try {
      const cached = localStorage.getItem(`ai-analytics-${user.uid}`);
      if (cached) {
        const { result, timestamp } = JSON.parse(cached);
        const ageHours = (Date.now() - timestamp) / (1000 * 60 * 60);
        if (ageHours < 6) {
          setAnalytics(result);
        }
      }
    } catch {}
  }, [user]);

  const runAIAnalysis = async (forceRefresh = false) => {
    if (!user || !norm) return;
    if (analyticsLoading) return;

    if (!forceRefresh) {
      try {
        const cached = localStorage.getItem(`ai-analytics-${user.uid}`);
        if (cached) {
          const { result, timestamp } = JSON.parse(cached);
          const ageHours = (Date.now() - timestamp) / (1000 * 60 * 60);
          if (ageHours < 6) {
            setAnalytics(result);
            return;
          }
        }
      } catch {}
    }

    setAnalyticsLoading(true);
    setAnalyticsError(null);
    try {
      const today = new Date();
      const todayStr = toDateStr(today);
      const foodLogsByDay: NutritionAnalyticsInput['foodLogsByDay'] = [];
      for (let i = 29; i >= 1; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dateStr = toDateStr(d);
        const dayEntries = entries.filter(e => e.date === dateStr);
        const targetNorm = normsByDate[dateStr] ?? norm;
        foodLogsByDay.push({
          date: dateStr,
          calories: dayEntries.reduce((sum, e) => sum + e.calories, 0),
          protein: dayEntries.reduce((sum, e) => sum + e.protein, 0),
          fat: dayEntries.reduce((sum, e) => sum + e.fat, 0),
          carbs: dayEntries.reduce((sum, e) => sum + e.carbs, 0),
          entries: dayEntries.length,
          targetCalories: targetNorm.calories,
          targetProtein: targetNorm.protein,
          targetFat: targetNorm.fat,
          targetCarbs: targetNorm.carbs,
        });
      }

      const dailyDeficit = foodLogsByDay.map(day => {
        const burned = norm.tdee || 0;
        return burned - day.calories;
      });

      const timestampsMeals: NutritionAnalyticsInput['timestampsMeals'] = [];
      entries.filter(e => e.date !== todayStr).forEach(entry => {
        const hour = new Date(entry.addedAt || Date.now()).getHours();
        timestampsMeals.push({ hour, calories: entry.calories });
      });

      const trackedDays = foodLogsByDay.filter(d => d.entries > 0).length;
      let streakDays = 0;
      for (let i = foodLogsByDay.length - 1; i >= 0; i--) {
        if (foodLogsByDay[i].entries > 0) streakDays++;
        else break;
      }

      const currentWeight = weightEntries.length > 0 ? weightEntries[0].weight : 70;
      const weightHistory = weightEntries.map(w => ({ date: w.date, weight: w.weight }));

      const activeDays = foodLogsByDay.filter(d => d.entries > 0);
      const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
      const avgCalories = avg(activeDays.map(d => d.calories));
      const avgProtein = avg(activeDays.map(d => d.protein));
      const avgFat = avg(activeDays.map(d => d.fat));
      const avgCarbs = avg(activeDays.map(d => d.carbs));
      const todayNorm = normsByDate[todayStr] ?? norm;
      const avgTargetCalories = activeDays.length > 0
        ? Math.round(avg(activeDays.map(d => d.targetCalories ?? norm.calories)))
        : todayNorm.calories;
      const avgTargetProtein = activeDays.length > 0
        ? Math.round(avg(activeDays.map(d => d.targetProtein ?? norm.protein)))
        : todayNorm.protein;
      const avgTargetFat = activeDays.length > 0
        ? Math.round(avg(activeDays.map(d => d.targetFat ?? norm.fat)))
        : todayNorm.fat;
      const avgTargetCarbs = activeDays.length > 0
        ? Math.round(avg(activeDays.map(d => d.targetCarbs ?? norm.carbs)))
        : todayNorm.carbs;

      const normData = await loadFullNormData(user.uid);

      const analyticsInput: NutritionAnalyticsInput = {
        currentWeight,
        targetWeight: normData?.goal === 'lose' ? currentWeight - 5 : undefined,
        avgCalories, avgProtein, avgFat, avgCarbs,
        dailyTargetCalories: avgTargetCalories,
        dailyTargetProtein: avgTargetProtein,
        dailyTargetFat: avgTargetFat,
        dailyTargetCarbs: avgTargetCarbs,
        dailyDeficit, weightHistory, foodLogsByDay,
        trackedDays, streakDays, timestampsMeals,
      };

      const result = await analyzeWithGemini(analyticsInput);
      setAnalytics(result);

      localStorage.setItem(`ai-analytics-${user.uid}`, JSON.stringify({
        result,
        timestamp: Date.now(),
      }));
    } catch (error) {
      console.error('Failed to get AI analytics:', error);
      setAnalyticsError(error instanceof Error ? error.message : 'Не удалось получить анализ от AI');
    } finally {
      setAnalyticsLoading(false);
    }
  };

  useEffect(() => {
    const loadMonthlyDetail = async () => {
      if (!user || !isInterestingOpen) return;
      const [year, month] = selectedMonth.split('-').map(Number);
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;
      const entries = await loadDiaryRange(user.uid, startDate, endDate);
      setMonthlyDetailEntries(entries);
      setProductPage(1); // Reset to page 1 when month changes
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
      const dateStr = toDateStr(date);
      const dayOfWeek = date.getDay();
      const weekdayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Convert to Monday=0 index
      
      const dayEntries = entries.filter(entry => entry.date === dateStr);
      const dayNorm = normsByDate[dateStr] ?? norm;
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
        targetCalories: dayNorm?.calories ?? 0,
        targetProtein: dayNorm?.protein ?? 0,
        targetFat: dayNorm?.fat ?? 0,
        targetCarbs: dayNorm?.carbs ?? 0,
      });
    }
    
    return data;
  }, [entries, norm, normsByDate]);

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
      const dateStr = toDateStr(new Date(year, month, day));
      const dayEntries = entries.filter(entry => entry.date === dateStr);
      const dayNorm = normsByDate[dateStr] ?? norm;

      const calories = dayEntries.reduce((sum, entry) => sum + entry.calories, 0);
      const percentage = dayNorm.calories > 0 ? (calories / dayNorm.calories) * 100 : 0;

      let color = "bg-purple-950/40"; // No data - very dark purple
      if (dayEntries.length > 0) {
        if (percentage >= 90 && percentage <= 110) {
          color = "bg-purple-300"; // On target - light purple
        } else if ((percentage >= 70 && percentage < 90) || (percentage > 110 && percentage <= 130)) {
          color = "bg-purple-500"; // Close - medium purple
        } else {
          color = "bg-purple-900"; // Off - very dark purple
        }
      }

      days.push({ date: day, calories, color });
    }

    return days;
  }, [entries, norm, normsByDate]);

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
        avgTargetCalories: 0,
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
          const percentage = day.targetCalories > 0 ? (day.calories / day.targetCalories) * 100 : 0;
          return percentage >= 90 && percentage <= 110;
        }).length
      : 0;
    const avgTargetCalories = Math.round(
      activeDays.reduce((sum, day) => sum + day.targetCalories, 0) / activeDays.length
    );

    return {
      avgCalories: Math.round(totals.calories / activeDays.length),
      avgProtein: Math.round(totals.protein / activeDays.length),
      avgFat: Math.round(totals.fat / activeDays.length),
      avgCarbs: Math.round(totals.carbs / activeDays.length),
      daysTracked: activeDays.length,
      withinNormPercent: Math.round((daysWithinNorm / activeDays.length) * 100),
      avgTargetCalories,
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

  // Meal timing analytics
  const mealTimingData = useMemo(() => {
    if (entries.length === 0) return null;

    const hourTotals: Record<number, number> = {};
    const activeDays = new Set<string>();
    const dailyFirstLast: Record<string, { first: number; last: number }> = {};

    entries.forEach(e => {
      if (!e.addedAt) return;
      const dt = new Date(e.addedAt);
      const hour = dt.getHours();
      const mins = hour * 60 + dt.getMinutes();

      hourTotals[hour] = (hourTotals[hour] || 0) + e.calories;
      activeDays.add(e.date);

      if (!dailyFirstLast[e.date]) {
        dailyFirstLast[e.date] = { first: mins, last: mins };
      } else {
        if (mins < dailyFirstLast[e.date].first) dailyFirstLast[e.date].first = mins;
        if (mins > dailyFirstLast[e.date].last) dailyFirstLast[e.date].last = mins;
      }
    });

    const daysCount = activeDays.size || 1;
    const fmt = (mins: number) =>
      `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;

    const chartData = Array.from({ length: 19 }, (_, i) => {
      const h = i + 5;
      return { hour: `${h}:00`, calories: Math.round((hourTotals[h] || 0) / daysCount) };
    });

    // Exclude today from avg calculations — today is incomplete (user may not have logged evening meals yet)
    const todayStr = (() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    })();
    const completedDayValues = Object.entries(dailyFirstLast)
      .filter(([date]) => date < todayStr)
      .map(([, times]) => times);
    const dayValues = completedDayValues.length > 0 ? completedDayValues : Object.values(dailyFirstLast);

    const avgFirstMins = dayValues.length > 0
      ? Math.round(dayValues.reduce((s, d) => s + d.first, 0) / dayValues.length) : null;
    const avgLastMins = dayValues.length > 0
      ? Math.round(dayValues.reduce((s, d) => s + d.last, 0) / dayValues.length) : null;
    const windowHours = avgFirstMins !== null && avgLastMins !== null
      ? Math.round((avgLastMins - avgFirstMins) / 60 * 10) / 10 : null;

    const peakEntry = Object.entries(hourTotals)
      .reduce<{ hour: number; cal: number }>(
        (best, [h, cal]) => cal > best.cal ? { hour: Number(h), cal } : best,
        { hour: -1, cal: 0 }
      );

    return {
      chartData,
      avgFirst: avgFirstMins !== null ? fmt(avgFirstMins) : null,
      avgLast: avgLastMins !== null ? fmt(avgLastMins) : null,
      windowHours,
      peakHour: peakEntry.hour >= 0 ? peakEntry.hour : null,
    };
  }, [entries]);

  // Admin: per-day activity + TDEE for last 7 days
  const activityStats = useMemo(() => {
    if (!norm) return null;
    const today = new Date();
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dateStr = toDateStr(date);
      const dayOfWeek = date.getDay();
      const weekdayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const entry = activityWeekData.find(e => e.date === dateStr);
      const actCal = entry?.caloriesBurned ?? 0;
      const tdee = Math.round((norm.bmr ?? 0) + actCal);
      const deficit = tdee - norm.calories;
      days.push({
        date: dateStr,
        label: WEEKDAYS[weekdayIndex],
        shortDate: `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}`,
        activity: actCal,
        tdee,
        deficit,
        hasData: !!entry,
      });
    }
    const daysWithData = days.filter(d => d.hasData);
    const avgActivity = daysWithData.length > 0
      ? Math.round(daysWithData.reduce((s, d) => s + d.activity, 0) / daysWithData.length)
      : 0;
    const avgTDEE = daysWithData.length > 0
      ? Math.round(daysWithData.reduce((s, d) => s + d.tdee, 0) / daysWithData.length)
      : Math.round(norm.bmr ?? 0);
    return { days, avgActivity, avgTDEE, daysWithData: daysWithData.length };
  }, [activityWeekData, norm]);

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

    return Array.from(map.values()).sort((a, b) => b.totalGrams - a.totalGrams);
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
      const entries = await loadDiaryRange(user!.uid, dateStr, dateStr);
      setDayEntries(entries);
    } catch (error) {
      console.error('Error loading day details:', error);
    } finally {
      setLoadingDay(false);
    }
  };

  const handleRemoveEntry = async (id: string) => {
    try {
      await deleteDiaryEntry(user.uid, id);
      setMonthlyDetailEntries(prev => prev.filter(e => e.id !== id));
      toast.success('Запись удалена');
    } catch (error) {
      toast.error('Ошибка удаления записи');
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
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="mb-4 w-full grid grid-cols-2">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Обзор
            </TabsTrigger>
            <TabsTrigger value="ai-analytics" className="flex items-center gap-2">
              <Brain className="h-4 w-4" />
              AI Аналитика
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
        
        {/* SECTION 1 - Weekly Chart */}
        <Card className="p-5 md:p-6 bg-[#0a0520]/90 backdrop-blur-sm border-border/50 mb-4">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4 text-purple-400" />
            <h2 className="font-semibold text-white">Калории за неделю</h2>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={weeklyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="caloriesGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#a855f7" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid
                  vertical={true}
                  horizontal={true}
                  strokeDasharray="3 3"
                  stroke="rgba(168, 85, 247, 0.1)"
                  verticalCoordinatesGenerator={(props) => {
                    const { width, offset } = props;
                    const step = (width - offset.left - offset.right) / 7;
                    return Array.from({ length: 6 }, (_, i) => offset.left + step * (i + 1));
                  }}
                />
                <XAxis
                  dataKey="label"
                  tick={{ fill: '#a855f7', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                />
                <YAxis stroke="#a855f7" fontSize={12} />
                <Tooltip
                  cursor={{ fill: 'rgba(168, 85, 247, 0.1)' }}
                  contentStyle={{
                    background: "rgba(10, 5, 32, 0.95)",
                    border: "1px solid rgba(168, 85, 247, 0.3)",
                    borderRadius: "0.75rem",
                    color: "#fff",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="calories"
                  name="Калории"
                  stroke="#a855f7"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#caloriesGradient)"
                />
                {norm && (
                  <Line
                    type="monotone"
                    dataKey="targetCalories"
                    name="Норма"
                    stroke="#c084fc"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={false}
                    activeDot={false}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Meal Timing Card */}
        {mealTimingData && (
          <Card className="p-5 md:p-6 bg-[#0a0520]/90 backdrop-blur-sm border-border/50 mb-4">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="h-4 w-4 text-purple-400" />
              <h2 className="font-semibold text-white">Время приёмов пищи</h2>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="rounded-xl bg-purple-500/10 p-3 text-center">
                <div className="text-xs text-purple-300 mb-1">Первый приём</div>
                <div className="font-bold text-sm text-white">{mealTimingData.avgFirst ?? '—'}</div>
                <div className="text-[10px] text-purple-300/60 mt-0.5">в среднем</div>
              </div>
              <div className="rounded-xl bg-purple-500/10 p-3 text-center">
                <div className="text-xs text-purple-300 mb-1">Последний приём</div>
                <div className="font-bold text-sm text-white">{mealTimingData.avgLast ?? '—'}</div>
                <div className="text-[10px] text-purple-300/60 mt-0.5">в среднем</div>
              </div>
              <div className="rounded-xl bg-purple-500/10 p-3 text-center">
                <div className="text-xs text-purple-300 mb-1">Окно питания</div>
                <div className="font-bold text-sm text-white">{mealTimingData.windowHours !== null ? `${mealTimingData.windowHours}ч` : '—'}</div>
                <div className="text-[10px] text-purple-300/60 mt-0.5">в среднем</div>
              </div>
            </div>

            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={mealTimingData.chartData} margin={{ top: 5, right: 5, left: -30, bottom: 0 }}>
                  <defs>
                    <linearGradient id="mealTimingGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#a855f7" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(168, 85, 247, 0.1)" />
                  <XAxis dataKey="hour" tick={{ fill: '#a855f7', fontSize: 9 }} axisLine={false} tickLine={false} interval={1} />
                  <YAxis stroke="#a855f7" fontSize={10} />
                  <Tooltip
                    cursor={{ fill: 'rgba(168, 85, 247, 0.1)' }}
                    contentStyle={{
                      background: "rgba(10, 5, 32, 0.95)",
                      border: "1px solid rgba(168, 85, 247, 0.3)",
                      borderRadius: "0.75rem",
                      color: "#fff",
                      fontSize: "12px",
                    }}
                    formatter={(value: number) => [`${value} ккал`, 'Среднее']}
                  />
                  <Area
                    type="monotone"
                    dataKey="calories"
                    stroke="#a855f7"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#mealTimingGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            {mealTimingData.peakHour !== null && (
              <p className="text-xs text-purple-300 mt-2 text-center">
                Пиковый час: <span className="font-medium text-white">{mealTimingData.peakHour}:00–{mealTimingData.peakHour + 1}:00</span> · среднее за 7 дней
              </p>
            )}
          </Card>
        )}

        <div className="grid md:grid-cols-2 gap-6 mb-4">
          {/* SECTION 2 - Monthly Overview */}
          <Card className="p-5 md:p-6 bg-[#0a0520]/90 backdrop-blur-sm border-border/50">
            <div className="mb-4 text-left">
              <h2 className="font-semibold text-white">{currentMonth} {currentYear}</h2>
            </div>
            <div className="grid grid-cols-7 gap-1 text-xs">
              {WEEKDAYS.map(day => (
                <div key={day} className="text-center font-medium text-purple-300 p-1">
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
                <div className="w-3 h-3 bg-purple-300 rounded-full" style={{ width: '12px', height: '12px', aspectRatio: '1/1' }}></div>
                <span className="text-purple-300">90-110%</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-purple-500 rounded-full" style={{ width: '12px', height: '12px', aspectRatio: '1/1' }}></div>
                <span className="text-purple-300">70-90% / 110-130%</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-purple-900 rounded-full" style={{ width: '12px', height: '12px', aspectRatio: '1/1' }}></div>
                <span className="text-purple-300">&lt;70% / &gt;130%</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-purple-950/40 rounded-full" style={{ width: '12px', height: '12px', aspectRatio: '1/1' }}></div>
                <span className="text-purple-300">Нет данных</span>
              </div>
            </div>
          </Card>

          {/* SECTION 3 - Averages Card */}
          <Card className="p-5 md:p-6 bg-[#0a0520]/90 backdrop-blur-sm border-border/50">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="h-4 w-4 text-purple-400" />
              <h2 className="font-semibold text-white">Средние показатели (7 дней)</h2>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-purple-300">Калории</span>
                <span className="font-semibold text-white">
                  {averages.avgCalories} {averages.avgTargetCalories > 0 && `/ ${averages.avgTargetCalories}`}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-purple-300">Белки</span>
                <span className="font-semibold text-white">{averages.avgProtein}г</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-purple-300">Жиры</span>
                <span className="font-semibold text-white">{averages.avgFat}г</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-purple-300">Углеводы</span>
                <span className="font-semibold text-white">{averages.avgCarbs}г</span>
              </div>
              <div className="border-t border-purple-500/20 pt-3 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-purple-300">Дней отслежено</span>
                  <span className="font-semibold text-white">{averages.daysTracked} / 7</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-purple-300">В норме (±10%)</span>
                  <span className="font-semibold text-white">{averages.withinNormPercent}%</span>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* User Data Viewer Button - Only for specific user */}
        {user?.uid === '3DXd9soOLnSZj4Axhg7zWPef2lj2' && (
          <Card className="p-4 md:p-5 bg-card/80 backdrop-blur-sm border-border/50 mb-4">
            <Button
              onClick={() => setShowUserDataViewer(true)}
              className="w-full flex items-center gap-2 justify-center bg-gradient-to-r from-[#0a0520] to-[#1a0a3d] border-0 text-foreground hover:opacity-90 shadow-glow"
            >
              <Eye className="h-4 w-4" />
              <span>Шо там Женя?</span>
            </Button>
          </Card>
        )}

        {/* Admin: Apple Watch Activity + TDEE */}
        {user?.uid === ADMIN_UID && activityStats && (
          <Card className="p-5 md:p-6 bg-[#0a0520]/90 backdrop-blur-sm border-border/50 mb-4">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="h-4 w-4 text-purple-400" />
              <h2 className="font-semibold text-white">Apple Watch — активность и TDEE (7 дней)</h2>
            </div>

            {/* Bar chart */}
            <div className="h-44 mb-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={activityStats.days} margin={{ top: 5, right: 5, left: -30, bottom: 0 }} barGap={4}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(168, 85, 247, 0.1)" />
                  <XAxis dataKey="label" tick={{ fill: '#a855f7', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis stroke="#a855f7" fontSize={10} />
                  <Tooltip
                    cursor={{ fill: 'rgba(168, 85, 247, 0.1)' }}
                    contentStyle={{
                      background: 'rgba(10, 5, 32, 0.97)',
                      border: '1px solid rgba(168, 85, 247, 0.5)',
                      borderRadius: '0.75rem',
                      color: '#fff',
                      fontSize: '12px',
                    }}
                    labelStyle={{ color: '#fff', fontWeight: 600, marginBottom: 4 }}
                    itemStyle={{ color: '#e9d5ff' }}
                    formatter={(value: number, name: string) => [
                      `${value} ккал`,
                      name === 'activity' ? 'Активность' : 'TDEE',
                    ]}
                  />
                  <Bar dataKey="activity" name="activity" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="tdee" name="tdee" fill="#a855f7" opacity={0.45} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Per-day table */}
            <div className="space-y-1 mb-4">
              <div className="grid grid-cols-4 gap-1 text-[10px] text-purple-400 uppercase tracking-wide px-2 mb-1">
                <span>День</span>
                <span className="text-right">Актив.</span>
                <span className="text-right">TDEE</span>
                <span className="text-right">Деф.</span>
              </div>
              {[...activityStats.days].reverse().map(day => (
                <div
                  key={day.date}
                  className={`grid grid-cols-4 gap-1 rounded-lg px-2 py-1.5 text-xs ${
                    day.hasData ? 'bg-purple-500/10' : 'bg-purple-950/20'
                  }`}
                >
                  <span className="font-medium text-white">{day.label}</span>
                  <span className={`text-right font-medium ${
                    day.hasData ? 'text-white' : 'text-purple-700'
                  }`}>
                    {day.hasData ? `${day.activity}` : '—'}
                  </span>
                  <span className={`text-right font-medium ${
                    day.hasData ? 'text-purple-200' : 'text-purple-700'
                  }`}>
                    {day.hasData ? `${day.tdee}` : '—'}
                  </span>
                  <span className={`text-right text-[11px] ${
                    !day.hasData ? 'text-purple-700' :
                    day.deficit >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {day.hasData ? `${day.deficit >= 0 ? '+' : ''}${day.deficit}` : '—'}
                  </span>
                </div>
              ))}
            </div>

            {/* Summary */}
            <div className="border-t border-purple-500/20 pt-3 grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-purple-500/10 p-3">
                <div className="text-xs text-purple-300 mb-0.5">BMR</div>
                <div className="font-bold text-white">{Math.round(norm?.bmr ?? 0)} ккал</div>
              </div>
              <div className="rounded-xl bg-purple-500/10 p-3">
                <div className="text-xs text-purple-300 mb-0.5">Ср. активность ({activityStats.daysWithData} дн.)</div>
                <div className="font-bold text-white">{activityStats.avgActivity} ккал</div>
              </div>
              <div className="rounded-xl bg-purple-500/10 p-3">
                <div className="text-xs text-purple-300 mb-0.5">Ср. TDEE за неделю</div>
                <div className="font-bold text-white">{activityStats.avgTDEE} ккал</div>
              </div>
              <div className="rounded-xl bg-purple-500/10 p-3">
                <div className="text-xs text-purple-300 mb-0.5">TDEE нормы (текущий)</div>
                <div className="font-bold text-white">{norm?.tdee ?? '—'} ккал</div>
              </div>
              <div className="col-span-2 rounded-xl bg-purple-900/20 p-3 border border-purple-500/20">
                <div className="text-xs text-purple-300 mb-0.5">Целевые калории (норма)</div>
                <div className="font-bold text-purple-200">{norm?.calories ?? '—'} ккал</div>
              </div>
            </div>
          </Card>
        )}

        {/* SECTION 5 - Interesting Statistics */}
        <Card className="p-5 md:p-6 bg-[#0a0520]/90 backdrop-blur-sm border-border/50">
          <button
            onClick={() => setIsInterestingOpen(!isInterestingOpen)}
            className="w-full flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">🔍</span>
              <h2 className="font-semibold text-white">Интересная статистика</h2>
            </div>
            <span className="text-purple-300 text-sm">{isInterestingOpen ? '▲' : '▼'}</span>
          </button>

          {isInterestingOpen && (
            <div className="mt-4 space-y-4">
              {/* Month selector */}
              <div className="flex items-center gap-2">
                <label className="text-sm text-purple-300">Месяц:</label>
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
                    { label: 'Жиров', value: `${Math.round(monthlyTotals.fat)}г`, icon: '🧈' },
                    { label: 'Углеводов', value: `${Math.round(monthlyTotals.carbs)}г`, icon: '🌾' },
                  ].map(stat => (
                    <div key={stat.label} className="rounded-xl bg-purple-500/10 p-3">
                      <div className="text-lg">{stat.icon}</div>
                      <div className="font-bold text-white">{stat.value}</div>
                      <div className="text-xs text-purple-300">{stat.label}</div>
                    </div>
                  ))}
                </div>
              )}

            </div>
          )}
        </Card>

        {/* Day Detail Modal */}
        {selectedDay && (
          <div className="fixed inset-x-0 top-0 z-50 flex items-end sm:items-center justify-center" style={{ height: 'var(--modal-vh, 100dvh)' }}>
            <div
              onClick={() => setSelectedDay(null)}
              className={`absolute inset-0 bg-black/60 backdrop-blur-sm ${animationState === 'enter' ? 'overlay-enter' : animationState === 'exit' ? 'overlay-exit' : ''}`} 
            />
            <div
              className={`relative w-full sm:max-w-2xl bg-background border border-border/50 rounded-t-3xl sm:rounded-2xl shadow-2xl p-6 max-h-[85vh] overflow-y-auto ${animationState === 'enter' ? 'modal-enter' : animationState === 'exit' ? 'modal-exit' : ''}`}
              style={{ transform: animationState === null ? 'translateY(100%)' : undefined }}
            >
              
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
                  onClick={() => {
                    setIsDayModalOpen(false);
                    setTimeout(() => setSelectedDay(null), 650);
                  }}
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
                        const selectedDayNorm = selectedDay
                          ? normsByDate[selectedDay] ?? norm
                          : norm;

                        return (
                          <>
                            {/* Summary grid */}
                            <div className="grid grid-cols-2 gap-3 mb-5">
                              {[
                                { label: 'Калории', value: `${Math.round(totals.calories)} ккал`, norm: selectedDayNorm?.calories, icon: '🔥' },
                                { label: 'Белки', value: `${Math.round(totals.protein)}г`, norm: selectedDayNorm?.protein, icon: '💪' },
                                { label: 'Жиры', value: `${Math.round(totals.fat)}г`, norm: selectedDayNorm?.fat, icon: '🧈' },
                                { label: 'Углеводы', value: `${Math.round(totals.carbs)}г`, norm: selectedDayNorm?.carbs, icon: '🌾' },
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

                            {/* Deficit */}
                            {selectedDayNorm && (
                              <div className="rounded-xl bg-muted/30 px-4 py-3 mb-5 grid grid-cols-3 gap-2 text-center">
                                <div>
                                  <div className="text-xs text-muted-foreground mb-1">Сожжено</div>
                                  <div className="font-bold text-sm">{selectedDayNorm.tdee} ккал</div>
                                </div>
                                <div>
                                  <div className="text-xs text-muted-foreground mb-1">Съедено</div>
                                  <div className="font-bold text-sm">{Math.round(totals.calories)} ккал</div>
                                </div>
                                <div>
                                  <div className="text-xs text-muted-foreground mb-1">Дефицит</div>
                                  <div className={`font-bold text-sm ${
                                    selectedDayNorm.tdee - totals.calories > 0 ? 'text-green-400' : 'text-red-400'
                                  }`}>
                                    {(() => {
                                      const d = Math.round(selectedDayNorm.tdee - totals.calories);
                                      return `${d > 0 ? '+' : ''}${d} ккал`;
                                    })()}
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Foods list */}
                            <EatenFoodsList
                              entries={dayEntries}
                              onRemove={handleRemoveEntry}
                              className="p-5 md:p-6"
                            />
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
          </TabsContent>

          {/* AI Analytics Tab */}
          <TabsContent value="ai-analytics" className="space-y-4">
            {/* Loading state with progress bar */}
            {analyticsLoading && (
              <Card className="p-8 bg-[#0a0520]/90 backdrop-blur-sm border-border/50">
                <div className="text-center">
                  <Brain className="h-12 w-12 mx-auto mb-4 text-purple-400 animate-pulse" />
                  <p className="text-purple-300 font-medium mb-3">Gemini анализирует ваши данные...</p>
                  <div className="w-full max-w-xs mx-auto bg-purple-500/20 rounded-full h-2 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full animate-loading-bar" />
                  </div>
                  <p className="text-xs text-purple-400/60 mt-3">Обычно занимает 5-10 секунд</p>
                </div>
              </Card>
            )}

            {/* Error state */}
            {!analyticsLoading && analyticsError && (
              <Card className="p-8 text-center bg-red-500/10 border-red-500/30">
                <Brain className="h-12 w-12 mx-auto mb-4 text-red-400" />
                <p className="text-red-400 font-medium mb-2">Ошибка AI анализа</p>
                <p className="text-sm text-purple-300 mb-4">{analyticsError}</p>
                <Button
                  variant="outline"
                  onClick={() => { setAnalyticsError(null); runAIAnalysis(true); }}
                >
                  Попробовать снова
                </Button>
              </Card>
            )}

            {/* Results */}
            {!analyticsLoading && !analyticsError && analytics && (
              <>
                {/* Overall Score */}
                <Card className="p-5 md:p-6 bg-[#0a0520]/90 backdrop-blur-sm border-border/50">
                  <div className="flex items-center gap-2 mb-4">
                    <Brain className="h-5 w-5 text-purple-400" />
                    <h2 className="font-semibold text-white">AI Оценка питания</h2>
                    <span className="ml-auto text-[10px] text-purple-500/60 bg-purple-500/10 px-2 py-0.5 rounded-full">Gemini 2.5 Flash</span>
                  </div>
                  <div className="text-center py-4">
                    <div className={`text-5xl font-bold mb-2 ${
                      analytics.score >= 90 ? 'text-green-500' :
                      analytics.score >= 75 ? 'text-lime-500' :
                      analytics.score >= 60 ? 'text-yellow-500' :
                      analytics.score >= 40 ? 'text-orange-500' : 'text-red-500'
                    }`}>
                      {analytics.score}/100
                    </div>
                    <p className="text-lg text-purple-300">{analytics.scoreLabel}</p>
                  </div>
                </Card>

                {/* Daily Verdict */}
                <Card className="p-5 md:p-6 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-purple-500/20">
                  <div className="flex items-start gap-3">
                    <div className="bg-purple-500/20 rounded-full p-2 mt-0.5">
                      <Activity className="h-5 w-5 text-purple-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white mb-1">Сводка дня</h3>
                      <p className="text-purple-300">{analytics.dailyVerdict}</p>
                    </div>
                  </div>
                </Card>

                {/* Dynamic AI Sections */}
                {analytics.sections.map((section, idx) => (
                  <Card key={idx} className={`p-5 md:p-6 backdrop-blur-sm ${
                    section.type === 'danger' ? 'bg-red-500/10 border-red-500/30' :
                    section.type === 'warning' ? 'bg-yellow-500/10 border-yellow-500/30' :
                    section.type === 'success' ? 'bg-green-500/10 border-green-500/30' :
                    'bg-[#0a0520]/90 border-border/50'
                  }`}>
                    <div className="flex items-start gap-3">
                      <div className={`rounded-full p-2 mt-0.5 shrink-0 ${
                        section.type === 'danger' ? 'bg-red-500/20' :
                        section.type === 'warning' ? 'bg-yellow-500/20' :
                        section.type === 'success' ? 'bg-green-500/20' :
                        'bg-purple-500/20'
                      }`}>
                        <span className="text-lg">{section.icon}</span>
                      </div>
                      <div>
                        <h3 className={`font-semibold mb-1 ${
                          section.type === 'danger' ? 'text-red-400' :
                          section.type === 'warning' ? 'text-yellow-400' :
                          section.type === 'success' ? 'text-green-400' :
                          'text-white'
                        }`}>{section.title}</h3>
                        <p className="text-sm text-purple-300 leading-relaxed">{section.content}</p>
                      </div>
                    </div>
                  </Card>
                ))}

                {/* AI Recommendations */}
                {analytics.recommendations.length > 0 && (
                  <Card className="p-5 md:p-6 bg-[#0a0520]/90 backdrop-blur-sm border-border/50">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="bg-purple-500/20 rounded-full p-2">
                        <span className="text-lg">💡</span>
                      </div>
                      <h3 className="font-semibold text-white">Рекомендации</h3>
                    </div>
                    <div className="space-y-2">
                      {analytics.recommendations.map((rec, idx) => (
                        <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-purple-500/10">
                          <span className="text-purple-400 font-bold text-sm mt-0.5">{idx + 1}</span>
                          <p className="text-sm text-purple-200">{rec}</p>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                {/* Refresh button */}
                <Button
                  variant="outline"
                  className="w-full border-purple-500/30 text-purple-300 hover:bg-purple-500/10"
                  onClick={() => runAIAnalysis(true)}
                  disabled={analyticsLoading}
                >
                  <Brain className="h-4 w-4 mr-2" />
                  Обновить анализ
                </Button>
              </>
            )}

            {/* Initial state — no analysis yet, show button */}
            {!analyticsLoading && !analyticsError && !analytics && (
              <Card className="p-8 text-center bg-[#0a0520]/90 backdrop-blur-sm border-border/50">
                <Brain className="h-16 w-16 mx-auto mb-4 text-purple-400/60" />
                <h3 className="text-lg font-semibold text-white mb-2">AI Аналитика питания</h3>
                <p className="text-sm text-purple-300 mb-6 max-w-sm mx-auto">
                  Нейросеть Gemini проанализирует ваши данные за 30 дней и даст персональные рекомендации
                </p>
                <Button
                  onClick={() => runAIAnalysis()}
                  disabled={!norm || loading}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-8 py-3 text-base"
                >
                  <Brain className="h-5 w-5 mr-2" />
                  Анализировать
                </Button>
                {!norm && (
                  <p className="text-xs text-purple-400/60 mt-3">
                    Сначала рассчитайте норму КБЖУ в калькуляторе
                  </p>
                )}
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </section>

      <div className="h-8" />

      {/* User Data Viewer Modal */}
      <UserDataViewer
        isOpen={showUserDataViewer}
        onClose={() => setShowUserDataViewer(false)}
        targetUserId="irXSByiUKYg9S5g3UXF5xSXHijC3"
        targetUserName="Пользователь"
      />
    </div>
  );
};

export default Stats;
