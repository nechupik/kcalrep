import type { DiaryEntry } from "./storage";
import type { MacroResult } from "./nutrition";

export interface DayTotals {
  date: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  count: number;
}

const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function aggregateByDay(entries: DiaryEntry[], days: number): DayTotals[] {
  const map = new Map<string, DayTotals>();
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const k = dayKey(d);
    map.set(k, { date: k, calories: 0, protein: 0, fat: 0, carbs: 0, count: 0 });
  }
  for (const e of entries) {
    const t = map.get(e.date);
    if (!t) continue;
    t.calories += e.calories;
    t.protein += e.protein;
    t.fat += e.fat;
    t.carbs += e.carbs;
    t.count += 1;
  }
  return Array.from(map.values());
}

export interface Recommendation {
  level: "info" | "warn" | "good";
  title: string;
  text: string;
}

export function buildRecommendations(
  entries: DiaryEntry[],
  norm: MacroResult | null,
): Recommendation[] {
  const recs: Recommendation[] = [];
  if (!norm) {
    recs.push({
      level: "info",
      title: "Сначала задайте свою норму",
      text: "Рассчитайте КБЖУ в калькуляторе и сохраните — без неё анализ невозможен.",
    });
    return recs;
  }

  const week = aggregateByDay(entries, 7).filter((d) => d.count > 0);
  const month = aggregateByDay(entries, 30).filter((d) => d.count > 0);

  if (week.length === 0) {
    recs.push({
      level: "info",
      title: "Пока нет данных",
      text: "Добавьте записи в дневник — после нескольких дней появятся персональные советы.",
    });
    return recs;
  }

  // Средние значения за неделю
  const avg = week.reduce(
    (a, d) => ({
      calories: a.calories + d.calories / week.length,
      protein: a.protein + d.protein / week.length,
      fat: a.fat + d.fat / week.length,
      carbs: a.carbs + d.carbs / week.length,
    }),
    { calories: 0, protein: 0, fat: 0, carbs: 0 },
  );

  // Калории
  const calDiff = (avg.calories - norm.calories) / norm.calories;
  if (calDiff > 0.1) {
    recs.push({
      level: "warn",
      title: "Превышение калорий",
      text: `За неделю в среднем ${Math.round(avg.calories)} ккал — это на ${Math.round(calDiff * 100)}% выше нормы. Сократите перекусы и сладкое.`,
    });
  } else if (calDiff < -0.15) {
    recs.push({
      level: "warn",
      title: "Сильный дефицит",
      text: `Среднее ${Math.round(avg.calories)} ккал — на ${Math.round(-calDiff * 100)}% ниже нормы. Добавьте сложных углеводов и полезных жиров.`,
    });
  } else {
    recs.push({
      level: "good",
      title: "Калории в норме",
      text: `Среднее за неделю — ${Math.round(avg.calories)} ккал. Так держать!`,
    });
  }

  // Белки
  if (avg.protein < norm.protein * 0.85) {
    recs.push({
      level: "warn",
      title: "Мало белка",
      text: `Получаете ${Math.round(avg.protein)}г против ${norm.protein}г. Добавьте мясо, рыбу, творог, яйца или бобовые.`,
    });
  }

  // Жиры
  if (avg.fat > norm.fat * 1.2) {
    recs.push({
      level: "warn",
      title: "Избыток жиров",
      text: `Среднее ${Math.round(avg.fat)}г при норме ${norm.fat}г. Замените жареное и фастфуд на запечённое.`,
    });
  } else if (avg.fat < norm.fat * 0.6) {
    recs.push({
      level: "warn",
      title: "Слишком мало жиров",
      text: `Жиры важны для гормонов. Добавьте орехи, авокадо, оливковое масло.`,
    });
  }

  // Углеводы
  if (avg.carbs < norm.carbs * 0.6) {
    recs.push({
      level: "info",
      title: "Низкие углеводы",
      text: `Если нет цели кето — добавьте крупы и фрукты для энергии.`,
    });
  }

  // Стрики превышения
  const last3 = aggregateByDay(entries, 3);
  const allOver = last3.every((d) => d.count > 0 && d.calories > norm.calories * 1.1);
  if (allOver) {
    recs.push({
      level: "warn",
      title: "3 дня подряд превышение",
      text: "Сделайте день с лёгким ужином: овощи + белок без гарнира.",
    });
  }

  // Стабильность за месяц
  if (month.length >= 14) {
    recs.push({
      level: "good",
      title: "Хорошая регулярность",
      text: `Вы вели дневник ${month.length} дней за месяц — это уже привычка.`,
    });
  } else if (month.length < 5 && month.length > 0) {
    recs.push({
      level: "info",
      title: "Ведите дневник чаще",
      text: "Для точного анализа отмечайте все приёмы пищи хотя бы 5 дней в неделю.",
    });
  }

  return recs;
}
