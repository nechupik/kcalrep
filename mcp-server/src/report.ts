import { pickNorm } from "./aggregate.js";
import { eachDate, timeInZone } from "./dates.js";
import type {
  ActivityEntry,
  BodyCompositionEntry,
  DiaryEntry,
  Norm,
  NormSnapshot,
  UserSettings,
  WeightEntry,
} from "./models.js";

/**
 * The Markdown report the website produces under Профиль → «Выгрузка данных»
 * (`generateMarkdownReport` in ../../src/lib/exportReport.ts), ported so Claude receives the very same
 * document the user used to download and paste. Wording, columns, rounding and section order are
 * intentional copies: if the site's export changes, change this file with it.
 *
 * Deliberate differences from the site's file:
 *  - a `|` inside a product name is escaped, so it can't break a table row;
 *  - an entry with no timestamp shows "—" instead of the current time;
 *  - one italic note under section 3 when the targets were typed in manually (there the app stores
 *    TDEE = the calorie target, so «Дефицит к TDEE» merely repeats «Дефицит к цели»);
 *  - section 2 (every meal) can be replaced by a pointer to kcalrep_get_diary when the report is too long.
 */

export interface ReportInput {
  start: string;
  end: string;
  /** Calendar date the report is generated on (YYYY-MM-DD), printed as «Сформирован». */
  generatedOn: string;
  timeZone: string;
  diary: DiaryEntry[];
  weight: WeightEntry[];
  activity: ActivityEntry[];
  bodyComposition: BodyCompositionEntry[];
  /** Snapshots in force during the range, oldest first (including the one in force on `start`). */
  normHistory: NormSnapshot[];
  currentNorm: Norm | null;
  settings: UserSettings | null;
  /** When set, section 2 is replaced by this text instead of listing every meal. */
  omitMealsReason?: string;
}

const GOAL_LABELS: Record<string, string> = {
  lose: "Снижение веса",
  maintain: "Поддержание",
  gain: "Набор массы",
};

const ACTIVITY_LEVEL_LABELS: Record<string, string> = {
  sedentary: "Сидячий",
  light: "Лёгкая",
  moderate: "Умеренная",
  active: "Высокая",
  veryActive: "Очень высокая",
};

const formatDateRu = (date: string): string => {
  const [y, m, d] = date.split("-");
  return `${d}.${m}.${y}`;
};

/** Same convention as the site: zero and up get an explicit "+". */
const signed = (n: number): string => (n >= 0 ? `+${n}` : `${n}`);

const activityTypeLabel = (type: string): string => {
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
};

const activityLevelLabel = (level: string | undefined): string => {
  if (!level) return "—";
  return ACTIVITY_LEVEL_LABELS[level] ?? level;
};

const goalMultiplierLabel = (multiplier: number | undefined): string => {
  if (!multiplier) return "—";
  const pct = Math.round((1 - multiplier) * 100);
  if (pct > 0) return `Дефицит ${pct}%`;
  if (pct < 0) return `Профицит ${Math.abs(pct)}%`;
  return "Поддержание";
};

const genderLabel = (gender: string | null | undefined): string => {
  if (gender === "female") return "Женский";
  if (gender === "male") return "Мужской";
  return "—";
};

const escapePipes = (text: string): string => text.replace(/\|/g, "\\|");

export function buildMarkdownReport(input: ReportInput): string {
  const { start, end, timeZone, currentNorm, settings } = input;
  const timeOf = (ms: number | null): string => (ms === null ? "—" : timeInZone(ms, timeZone));
  const byTime = (a: DiaryEntry, b: DiaryEntry) => (a.addedAt ?? 0) - (b.addedAt ?? 0);

  const days = eachDate(start, end);

  const diaryByDate = new Map<string, DiaryEntry[]>();
  for (const entry of input.diary) {
    const list = diaryByDate.get(entry.date) ?? [];
    list.push(entry);
    diaryByDate.set(entry.date, list);
  }
  for (const list of diaryByDate.values()) list.sort(byTime);

  const activityByDate = new Map<string, ActivityEntry>();
  for (const a of input.activity) activityByDate.set(a.date, a);

  const normForDay = (day: string) => pickNorm(day, input.normHistory, currentNorm)?.norm ?? null;

  const lines: string[] = [];

  lines.push(`# Отчёт по питанию и активности`);
  lines.push(``);
  lines.push(`**Период:** ${formatDateRu(start)} — ${formatDateRu(end)}`);
  lines.push(`**Сформирован:** ${formatDateRu(input.generatedOn)}`);
  lines.push(``);

  // Текущие настройки профиля
  lines.push(`## Текущие настройки профиля`);
  lines.push(``);
  lines.push(`- Пол: ${genderLabel(currentNorm?.gender)}`);
  lines.push(`- Возраст: ${currentNorm?.age ?? "—"}`);
  lines.push(`- Рост: ${currentNorm?.height ?? "—"} см`);
  lines.push(`- Цель: ${currentNorm?.goal ? (GOAL_LABELS[currentNorm.goal] ?? currentNorm.goal) : "—"}`);
  lines.push(`- Слайдер «Дефицит калорий» (текущее значение): ${settings?.deficitPercent ?? "—"}%`);
  lines.push(`- Учёт активности (Apple Watch): ${settings?.activityTrackingEnabled === false ? "Выключен" : "Включён"}`);
  lines.push(`- Текущий BMR: ${currentNorm?.bmr ?? "—"} ккал`);
  lines.push(`- Текущий TDEE: ${currentNorm?.tdee ?? "—"} ккал`);
  lines.push(`- Текущий множитель цели: ${goalMultiplierLabel(currentNorm?.goalMultiplier)}`);
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
    let windowStr = "—";
    if (entries.length > 1 && first !== null && last !== null) {
      const windowMs = last - first;
      const windowH = Math.floor(windowMs / 3600000);
      const windowM = Math.round((windowMs % 3600000) / 60000);
      windowStr = `${windowH} ч ${windowM} мин`;
    }
    lines.push(`| ${formatDateRu(day)} | ${timeOf(first)} | ${timeOf(last)} | ${windowStr} | ${entries.length} |`);
  }
  lines.push(``);

  // 2. Приёмы пищи по дням
  lines.push(`## 2. Приёмы пищи по дням`);
  lines.push(``);
  if (input.omitMealsReason) {
    lines.push(`_${input.omitMealsReason}_`);
    lines.push(``);
  } else {
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
          `| ${timeOf(e.addedAt)} | ${escapePipes(e.name)} | ${e.grams} г | ${Math.round(e.calories)} | ${e.protein.toFixed(1)} | ${e.fat.toFixed(1)} | ${e.carbs.toFixed(1)} |`,
        );
      }
      lines.push(``);
    }
  }

  // 3. Дневные итоги и дефицит
  lines.push(`## 3. Дневные итоги и дефицит`);
  lines.push(``);
  lines.push(`| Дата | Съедено, ккал | Белки | Жиры | Углеводы | Норма (цель) | TDEE | Дефицит к цели | Дефицит к TDEE |`);
  lines.push(`|---|---|---|---|---|---|---|---|---|`);
  let manualNormInRange = false;
  for (const day of days) {
    const entries = diaryByDate.get(day) ?? [];
    const totalCal = entries.reduce((s, e) => s + e.calories, 0);
    const totalP = entries.reduce((s, e) => s + e.protein, 0);
    const totalF = entries.reduce((s, e) => s + e.fat, 0);
    const totalC = entries.reduce((s, e) => s + e.carbs, 0);
    const norm = normForDay(day);
    if (norm && !norm.energyEstimated) manualNormInRange = true;
    const target = norm?.calories ?? null;
    const tdee = norm?.tdee ?? null;
    const deficitToTarget = target !== null ? Math.round(target - totalCal) : null;
    const deficitToTdee = tdee !== null ? Math.round(tdee - totalCal) : null;
    lines.push(
      `| ${formatDateRu(day)} | ${Math.round(totalCal)} | ${totalP.toFixed(1)} | ${totalF.toFixed(1)} | ${totalC.toFixed(1)} | ${target ?? "—"} | ${tdee ?? "—"} | ${deficitToTarget !== null ? signed(deficitToTarget) : "—"} | ${deficitToTdee !== null ? signed(deficitToTdee) : "—"} |`,
    );
  }
  lines.push(``);
  lines.push(`_Положительное значение — калорийность ниже нормы/TDEE (дефицит), отрицательное — профицит._`);
  if (manualNormInRange) {
    lines.push(
      `_Примечание: если норма введена вручную, приложение хранит BMR и TDEE равными норме — это не реальные значения, поэтому «Дефицит к TDEE» просто повторяет «Дефицит к цели»._`,
    );
  }
  lines.push(``);

  // 4. Норма и настройки по дням
  lines.push(`## 4. Норма и настройки по дням`);
  lines.push(``);
  lines.push(`| Дата | BMR | Активность | Множитель цели | Дефицит/профицит | Цель Б | Цель Ж | Цель У |`);
  lines.push(`|---|---|---|---|---|---|---|---|`);
  for (const day of days) {
    const norm = normForDay(day);
    lines.push(
      `| ${formatDateRu(day)} | ${norm?.bmr ?? "—"} | ${activityLevelLabel(norm?.activityLevel)} | ${norm ? norm.goalMultiplier.toFixed(2) : "—"} | ${goalMultiplierLabel(norm?.goalMultiplier)} | ${norm?.protein ?? "—"} | ${norm?.fat ?? "—"} | ${norm?.carbs ?? "—"} |`,
    );
  }
  lines.push(``);

  // 5. Изменение веса и состава тела
  lines.push(`## 5. Изменение веса и состава тела`);
  lines.push(``);
  const weights = input.weight;
  if (weights.length === 0) {
    lines.push(`_Нет записей веса за период_`);
    lines.push(``);
  } else {
    lines.push(`| Дата | Вес, кг | Изменение |`);
    lines.push(`|---|---|---|`);
    let prev: number | null = null;
    for (const w of weights) {
      const diff = prev !== null ? +(w.weight - prev).toFixed(1) : null;
      lines.push(`| ${formatDateRu(w.date)} | ${w.weight} | ${diff !== null ? signed(diff) : "—"} |`);
      prev = w.weight;
    }
    const first = weights[0].weight;
    const last = weights[weights.length - 1].weight;
    const totalDiff = +(last - first).toFixed(1);
    lines.push(``);
    lines.push(`**Итого за период:** ${signed(totalDiff)} кг (с ${first} до ${last} кг)`);
    lines.push(``);
  }

  const bodyComp = input.bodyComposition;
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
    if (first.bodyFatPercent !== null && last.bodyFatPercent !== null) {
      const fatDiff = +(last.bodyFatPercent - first.bodyFatPercent).toFixed(1);
      lines.push(`**Изменение % жира:** ${signed(fatDiff)}%`);
    }
    if (first.lbmKg !== null && last.lbmKg !== null) {
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
      `| ${formatDateRu(day)} | ${a ? Math.round(a.caloriesBurned) : "—"} | ${a ? activityTypeLabel(a.type) : "—"} | ${norm?.tdee ?? "—"} |`,
    );
  }
  const activityValues = input.activity.map((a) => a.caloriesBurned).filter((v) => v > 0);
  if (activityValues.length > 0) {
    const avgActivity = Math.round(activityValues.reduce((s, v) => s + v, 0) / activityValues.length);
    lines.push(``);
    lines.push(`**Средняя активность за период:** ${avgActivity} ккал/день (${activityValues.length} дн. с данными)`);
  }
  lines.push(``);

  return lines.join("\n");
}
