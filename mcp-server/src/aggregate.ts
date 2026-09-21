import { dateInZone, eachDate, timeInZone } from "./dates.js";
import { round } from "./format.js";
import type { ActivityEntry, ActivityLogEntry, DiaryEntry, Norm, NormSnapshot, WeightEntry } from "./models.js";

export interface DayTargets {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  /** Null when the targets were typed in manually: the app then stores placeholders, not a real BMR/TDEE. */
  bmr: number | null;
  tdee: number | null;
  /** "history": a dated snapshot in force that day. "current": no snapshot existed yet, so today's norm is a best guess. */
  source: "history" | "current";
}

/**
 * The norm that applied on `day`: the latest snapshot dated on or before it, else the current norm.
 * `history` must be sorted oldest → newest.
 */
export function pickNorm(
  day: string,
  history: NormSnapshot[],
  current: Norm | null,
): { norm: NormSnapshot | Norm; source: "history" | "current" } | null {
  let applicable: NormSnapshot | null = null;
  for (const snapshot of history) {
    if (snapshot.date <= day) applicable = snapshot;
    else break;
  }
  if (applicable) return { norm: applicable, source: "history" };
  return current ? { norm: current, source: "current" } : null;
}

export function targetsForDay(day: string, history: NormSnapshot[], current: Norm | null): DayTargets | null {
  const picked = pickNorm(day, history, current);
  if (!picked) return null;
  const { norm, source } = picked;
  return {
    calories: norm.calories,
    protein: norm.protein,
    fat: norm.fat,
    carbs: norm.carbs,
    bmr: norm.energyEstimated ? norm.bmr : null,
    tdee: norm.energyEstimated ? norm.tdee : null,
    source,
  };
}

export interface DaySummary {
  date: string;
  /** True when the diary has at least one entry for the day. */
  logged: boolean;
  /** True for the still-running current day: its totals are incomplete, so it is left out of averages. */
  partial: boolean;
  meals: number;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  firstMeal: string | null;
  lastMeal: string | null;
  eatingWindowMinutes: number | null;
  targets: DayTargets | null;
  /** targets.calories − eaten. Positive = ate less than the target (deficit), negative = surplus. */
  deficitVsTarget: number | null;
  /** tdee − eaten. Positive = ate less than the maintenance level. Null when the TDEE is unknown (manual targets). */
  deficitVsTdee: number | null;
  activity: { type: string; value: number; caloriesBurned: number } | null;
  /** Kcal/steps typed in by hand for the day; unrelated to `activity` and to the norm. Null when nothing was entered. */
  manualActivity: { calories: number | null; steps: number | null } | null;
  /** Last weigh-in of the day, kg. */
  weight: number | null;
}

export interface PeriodSummary {
  days: number;
  loggedDays: number;
  /** Averages cover logged, completed days only — days without entries are not counted as zero intake. */
  avgCalories: number | null;
  avgProtein: number | null;
  avgFat: number | null;
  avgCarbs: number | null;
  avgDeficitVsTarget: number | null;
  avgDeficitVsTdee: number | null;
  weightFirst: number | null;
  weightLast: number | null;
  weightChange: number | null;
}

export interface SummaryInput {
  start: string;
  end: string;
  /** The user's current calendar date; that day is flagged partial. */
  today: string;
  timeZone: string;
  diary: DiaryEntry[];
  /** Sorted oldest → newest, including the snapshot in force at `start`. */
  normHistory: NormSnapshot[];
  currentNorm: Norm | null;
  activity: ActivityEntry[];
  activityLog: ActivityLogEntry[];
  weight: WeightEntry[];
}

const avg = (values: number[], digits = 0): number | null =>
  values.length ? round(values.reduce((s, v) => s + v, 0) / values.length, digits) : null;

export function buildDailySummary(input: SummaryInput): { days: DaySummary[]; period: PeriodSummary } {
  const { start, end, today, timeZone } = input;

  const diaryByDate = groupBy(input.diary, (e) => e.date);
  const activityByDate = new Map(input.activity.map((a) => [a.date, a]));
  const activityLogByDate = new Map(input.activityLog.map((a) => [a.date, a]));
  // Later weigh-ins overwrite earlier ones (input is ordered by date, then entry time).
  const weightByDate = new Map(input.weight.map((w) => [w.date, w.weight]));

  const days: DaySummary[] = eachDate(start, end).map((date) => {
    const entries = diaryByDate.get(date) ?? [];
    const eaten = {
      calories: entries.reduce((s, e) => s + e.calories, 0),
      protein: entries.reduce((s, e) => s + e.protein, 0),
      fat: entries.reduce((s, e) => s + e.fat, 0),
      carbs: entries.reduce((s, e) => s + e.carbs, 0),
    };

    // Meal times are only trustworthy when the entry was logged on the day it belongs to; an entry
    // added the next morning for yesterday carries the time it was *typed in*, not eaten.
    const timed = entries
      .filter((e) => e.addedAt !== null && dateInZone(e.addedAt, timeZone) === date)
      .map((e) => e.addedAt as number)
      .sort((a, b) => a - b);
    const first = timed[0];
    const last = timed[timed.length - 1];

    const targets = targetsForDay(date, input.normHistory, input.currentNorm);
    const logged = entries.length > 0;
    const activity = activityByDate.get(date);
    const manual = activityLogByDate.get(date);

    return {
      date,
      logged,
      partial: date === today,
      meals: entries.length,
      calories: round(eaten.calories),
      protein: round(eaten.protein, 1),
      fat: round(eaten.fat, 1),
      carbs: round(eaten.carbs, 1),
      firstMeal: first !== undefined ? timeInZone(first, timeZone) : null,
      lastMeal: last !== undefined ? timeInZone(last, timeZone) : null,
      eatingWindowMinutes: timed.length > 1 ? Math.round((last - first) / 60_000) : null,
      targets,
      deficitVsTarget: logged && targets ? round(targets.calories - eaten.calories) : null,
      deficitVsTdee: logged && targets && targets.tdee !== null ? round(targets.tdee - eaten.calories) : null,
      activity: activity
        ? { type: activity.type, value: activity.value, caloriesBurned: round(activity.caloriesBurned) }
        : null,
      manualActivity: manual
        ? { calories: manual.calories === null ? null : round(manual.calories), steps: manual.steps }
        : null,
      weight: weightByDate.get(date) ?? null,
    };
  });

  const counted = days.filter((d) => d.logged && !d.partial);
  const weights = days.filter((d) => d.weight !== null).map((d) => d.weight as number);
  const weightFirst = weights[0] ?? null;
  const weightLast = weights[weights.length - 1] ?? null;

  const period: PeriodSummary = {
    days: days.length,
    loggedDays: days.filter((d) => d.logged).length,
    avgCalories: avg(counted.map((d) => d.calories)),
    avgProtein: avg(counted.map((d) => d.protein), 1),
    avgFat: avg(counted.map((d) => d.fat), 1),
    avgCarbs: avg(counted.map((d) => d.carbs), 1),
    avgDeficitVsTarget: avg(counted.flatMap((d) => (d.deficitVsTarget === null ? [] : [d.deficitVsTarget]))),
    avgDeficitVsTdee: avg(counted.flatMap((d) => (d.deficitVsTdee === null ? [] : [d.deficitVsTdee]))),
    weightFirst,
    weightLast,
    weightChange: weightFirst !== null && weightLast !== null ? round(weightLast - weightFirst, 1) : null,
  };

  return { days, period };
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = map.get(k);
    if (list) list.push(item);
    else map.set(k, [item]);
  }
  return map;
}
