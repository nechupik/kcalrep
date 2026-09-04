// Формирование Markdown-отчёта по данным пользователя (только чтение, без записи в БД)
import {
  loadDiaryRange,
  loadWeightRange,
  loadActivityRange,
  loadNormHistory,
  loadFullNormData,
  loadUserSettings,
  type ActivityEntry,
  type NormHistoryEntry,
  type NormData,
} from "./firestore";
import { loadBodyCompositionInRange } from "./metabolic-firestore";
import type { DiaryEntry } from "./storage";
import { GOAL_LABELS, type Goal } from "./nutrition";

export interface ExportReportResult {
  filename: string;
  content: string;
}

function formatDateRu(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${d}.${m}.${y}`;
}

function formatTime(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function eachDateInRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const cur = new Date(`${start}T00:00:00`);
  const last = new Date(`${end}T00:00:00`);
  while (cur <= last) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, "0");
    const d = String(cur.getDate()).padStart(2, "0");
    dates.push(`${y}-${m}-${d}`);
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

function signed(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

function activityTypeLabel(type: string): string {
  switch (type) {
    case "calories":
      return "Apple Watch";
    case "steps":
      return "Шаги";
    case "home":
      return "Дома";
    default:
      return type;
  }
}

const ACTIVITY_LEVEL_LABELS: Record<string, string> = {
  sedentary: "Сидячий",
  light: "Лёгкая",
  moderate: "Умеренная",
  active: "Высокая",
  veryActive: "Очень высокая",
};

function activityLevelLabel(level: string | undefined): string {
  if (!level) return "—";
  return ACTIVITY_LEVEL_LABELS[level] ?? level;
}

function goalMultiplierLabel(multiplier: number | undefined): string {
  if (multiplier == null) return "—";
  const pct = Math.round((1 - multiplier) * 100);
  if (pct > 0) return `Дефицит ${pct}%`;
  if (pct < 0) return `Профицит ${Math.abs(pct)}%`;
  return "Поддержание";
}

function genderLabel(gender: string | undefined): string {
  if (gender === "female") return "Женский";
  if (gender === "male") return "Мужской";
  return "—";
}

export async function generateMarkdownReport(
  userId: string,
  startDate: string,
  endDate: string
): Promise<ExportReportResult> {
  const [diaryEntries, weightEntries, activityEntries, normHistory, currentNormData, bodyComp, userSettings] = await Promise.all([
    loadDiaryRange(userId, startDate, endDate),
    loadWeightRange(userId, startDate, endDate),
    loadActivityRange(userId, startDate, endDate),
    loadNormHistory(userId, endDate),
    loadFullNormData(userId),
    loadBodyCompositionInRange(userId, startDate, endDate),
    loadUserSettings(userId),
  ]);

  const days = eachDateInRange(startDate, endDate);

  const diaryByDate = new Map<string, DiaryEntry[]>();
  for (const entry of diaryEntries) {
    const list = diaryByDate.get(entry.date) || [];
    list.push(entry);
    diaryByDate.set(entry.date, list);
  }
  for (const list of diaryByDate.values()) {
    list.sort((a, b) => a.addedAt - b.addedAt);
  }

  const activityByDate = new Map<string, ActivityEntry>();
  for (const a of activityEntries) activityByDate.set(a.date, a);

  const sortedHistory = [...normHistory].sort((a, b) => a.date.localeCompare(b.date));
  function normForDay(day: string): NormHistoryEntry | NormData | null {
    let applicable: NormHistoryEntry | null = null;
    for (const h of sortedHistory) {
      if (h.date <= day) applicable = h;
      else break;
    }
    return applicable || currentNormData;
  }

  const lines: string[] = [];

  lines.push(`# Отчёт по питанию и активности`);
  lines.push(``);
  lines.push(`**Период:** ${formatDateRu(startDate)} — ${formatDateRu(endDate)}`);
  lines.push(`**Сформирован:** ${formatDateRu(new Date().toISOString().split("T")[0])}`);
  lines.push(``);

  // Текущие настройки профиля (вводятся админом отдельно от дневника)
  lines.push(`## Текущие настройки профиля`);
  lines.push(``);
  lines.push(`- Пол: ${genderLabel(currentNormData?.gender)}`);
  lines.push(`- Возраст: ${currentNormData?.age ?? "—"}`);
  lines.push(`- Рост: ${currentNormData?.height ?? "—"} см`);
  lines.push(`- Цель: ${currentNormData?.goal ? (GOAL_LABELS[currentNormData.goal as Goal] ?? currentNormData.goal) : "—"}`);
  lines.push(`- Слайдер «Дефицит калорий» (текущее значение): ${userSettings?.deficitPercent ?? "—"}%`);
  lines.push(`- Учёт активности (Apple Watch): ${userSettings?.activityTrackingEnabled === false ? "Выключен" : "Включён"}`);
  lines.push(`- Текущий BMR: ${currentNormData?.bmr ?? "—"} ккал`);
  lines.push(`- Текущий TDEE: ${currentNormData?.tdee ?? "—"} ккал`);
  lines.push(`- Текущий множитель цели: ${goalMultiplierLabel(currentNormData?.goalMultiplier)}`);
  lines.push(``);

  // 1. Периоды приёма пищи
  lines.push(`## 1. Периоды приёма пищи`);
  lines.push(``);
  lines.push(`| Дата | Первый приём | Последний приём | Окно питания | Кол-во приёмов |`);
  lines.push(`|---|---|---|---|---|`);
  for (const day of days) {
    const entries = diaryByDate.get(day);
    if (!entries || entries.length === 0) {
      lines.push(`| ${formatDateRu(day)} | — | — | — | 0 |`);
      continue;
    }
    const first = entries[0].addedAt;
    const last = entries[entries.length - 1].addedAt;
    const windowMs = last - first;
    const windowH = Math.floor(windowMs / 3600000);
    const windowM = Math.round((windowMs % 3600000) / 60000);
    const windowStr = entries.length > 1 ? `${windowH} ч ${windowM} мин` : "—";
    lines.push(`| ${formatDateRu(day)} | ${formatTime(first)} | ${formatTime(last)} | ${windowStr} | ${entries.length} |`);
  }
  lines.push(``);

  // 2. Приёмы пищи по дням
  lines.push(`## 2. Приёмы пищи по дням`);
  lines.push(``);
  for (const day of days) {
    const entries = diaryByDate.get(day);
    lines.push(`### ${formatDateRu(day)}`);
    lines.push(``);
    if (!entries || entries.length === 0) {
      lines.push(`_Нет записей_`);
      lines.push(``);
      continue;
    }
    lines.push(`| Время | Продукт | Граммы | Ккал | Белки | Жиры | Углеводы |`);
    lines.push(`|---|---|---|---|---|---|---|`);
    for (const e of entries) {
      lines.push(
        `| ${formatTime(e.addedAt)} | ${e.name} | ${e.grams} г | ${Math.round(e.calories)} | ${e.protein.toFixed(1)} | ${e.fat.toFixed(1)} | ${e.carbs.toFixed(1)} |`
      );
    }
    lines.push(``);
  }

  // 3. Дневные итоги и дефицит
  lines.push(`## 3. Дневные итоги и дефицит`);
  lines.push(``);
  lines.push(`| Дата | Съедено, ккал | Белки | Жиры | Углеводы | Норма (цель) | TDEE | Дефицит к цели | Дефицит к TDEE |`);
  lines.push(`|---|---|---|---|---|---|---|---|---|`);
  for (const day of days) {
    const entries = diaryByDate.get(day) || [];
    const totalCal = entries.reduce((s, e) => s + e.calories, 0);
    const totalP = entries.reduce((s, e) => s + e.protein, 0);
    const totalF = entries.reduce((s, e) => s + e.fat, 0);
    const totalC = entries.reduce((s, e) => s + e.carbs, 0);
    const norm = normForDay(day);
    const target = norm?.calories ?? null;
    const tdee = norm?.tdee ?? null;
    const deficitToTarget = target != null ? Math.round(target - totalCal) : null;
    const deficitToTdee = tdee != null ? Math.round(tdee - totalCal) : null;
    lines.push(
      `| ${formatDateRu(day)} | ${Math.round(totalCal)} | ${totalP.toFixed(1)} | ${totalF.toFixed(1)} | ${totalC.toFixed(1)} | ${target ?? "—"} | ${tdee ?? "—"} | ${deficitToTarget != null ? signed(deficitToTarget) : "—"} | ${deficitToTdee != null ? signed(deficitToTdee) : "—"} |`
    );
  }
  lines.push(``);
  lines.push(`_Положительное значение — калорийность ниже нормы/TDEE (дефицит), отрицательное — профицит._`);
  lines.push(``);

  // 4. Норма и настройки по дням (BMR, дефицит/профицит — вводятся/пересчитываются админом)
  lines.push(`## 4. Норма и настройки по дням`);
  lines.push(``);
  lines.push(`| Дата | BMR | Активность | Множитель цели | Дефицит/профицит | Цель Б | Цель Ж | Цель У |`);
  lines.push(`|---|---|---|---|---|---|---|---|`);
  for (const day of days) {
    const norm = normForDay(day);
    lines.push(
      `| ${formatDateRu(day)} | ${norm?.bmr ?? "—"} | ${activityLevelLabel(norm?.activityLabel)} | ${norm?.goalMultiplier != null ? norm.goalMultiplier.toFixed(2) : "—"} | ${goalMultiplierLabel(norm?.goalMultiplier)} | ${norm?.protein ?? "—"} | ${norm?.fat ?? "—"} | ${norm?.carbs ?? "—"} |`
    );
  }
  lines.push(``);

  // 5. Изменение веса и состава тела
  lines.push(`## 5. Изменение веса и состава тела`);
  lines.push(``);
  if (weightEntries.length === 0) {
    lines.push(`_Нет записей веса за период_`);
    lines.push(``);
  } else {
    lines.push(`| Дата | Вес, кг | Изменение |`);
    lines.push(`|---|---|---|`);
    let prev: number | null = null;
    for (const w of weightEntries) {
      const diff = prev != null ? +(w.weight - prev).toFixed(1) : null;
      lines.push(`| ${formatDateRu(w.date)} | ${w.weight} | ${diff != null ? signed(diff) : "—"} |`);
      prev = w.weight;
    }
    const first = weightEntries[0].weight;
    const last = weightEntries[weightEntries.length - 1].weight;
    const totalDiff = +(last - first).toFixed(1);
    lines.push(``);
    lines.push(`**Итого за период:** ${signed(totalDiff)} кг (с ${first} до ${last} кг)`);
    lines.push(``);
  }

  if (bodyComp.length === 0) {
    lines.push(`_Нет данных состава тела (% жира, мышечная масса) за период_`);
    lines.push(``);
  } else {
    lines.push(`| Дата | Вес, кг | % жира | Мышечная масса, кг | BMR (весы) |`);
    lines.push(`|---|---|---|---|---|`);
    for (const b of bodyComp) {
      lines.push(`| ${formatDateRu(b.date)} | ${b.weight} | ${b.bodyFatPercent ?? "—"} | ${b.lbmKg ?? "—"} | ${b.bmrFromScale ?? "—"} |`);
    }
    lines.push(``);

    const first = bodyComp[0];
    const last = bodyComp[bodyComp.length - 1];
    if (first.bodyFatPercent != null && last.bodyFatPercent != null) {
      const fatDiff = +(last.bodyFatPercent - first.bodyFatPercent).toFixed(1);
      lines.push(`**Изменение % жира:** ${signed(fatDiff)}%`);
    }
    if (first.lbmKg != null && last.lbmKg != null) {
      const lbmDiff = +(last.lbmKg - first.lbmKg).toFixed(1);
      lines.push(`**Изменение мышечной массы:** ${signed(lbmDiff)} кг`);
    }
    lines.push(``);
  }

  // 6. Активность и TDEE
  lines.push(`## 6. Активность и TDEE`);
  lines.push(``);
  lines.push(`| Дата | Активность, ккал | Тип | TDEE (норма на день) |`);
  lines.push(`|---|---|---|---|`);
  for (const day of days) {
    const a = activityByDate.get(day);
    const norm = normForDay(day);
    lines.push(
      `| ${formatDateRu(day)} | ${a ? Math.round(a.caloriesBurned) : "—"} | ${a ? activityTypeLabel(a.type) : "—"} | ${norm?.tdee ?? "—"} |`
    );
  }
  const activityValues = activityEntries.map((a) => a.caloriesBurned).filter((v) => v > 0);
  if (activityValues.length > 0) {
    const avgActivity = Math.round(activityValues.reduce((s, v) => s + v, 0) / activityValues.length);
    lines.push(``);
    lines.push(`**Средняя активность за период:** ${avgActivity} ккал/день (${activityValues.length} дн. с данными)`);
  }
  lines.push(``);

  const content = lines.join("\n");
  const filename = `otchet_${startDate}_${endDate}.md`;

  return { filename, content };
}
