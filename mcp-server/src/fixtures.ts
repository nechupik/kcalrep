// Shared test fixtures: a small, hand-checkable dataset around "today" = 2026-09-19 in Europe/Moscow (UTC+3).
import type { DataSource } from "./data-source.js";
import type { DiaryEntry, Norm, NormSnapshot } from "./models.js";

export const TZ = "Europe/Moscow";
export const TODAY = "2026-09-19";
/** 12:00 UTC = 15:00 Moscow on the 19th. */
export const NOW = new Date("2026-09-19T12:00:00Z");

/** Epoch ms of a Moscow wall-clock time. */
export const moscow = (date: string, time: string): number => Date.parse(`${date}T${time}:00+03:00`);

export const currentNorm: Norm = {
  calories: 2000,
  protein: 130,
  fat: 60,
  carbs: 220,
  bmr: 1700,
  tdee: 2400,
  activityLevel: "light",
  activityFactor: 1.375,
  goal: "lose",
  goalMultiplier: 0.85,
  gender: "male",
  age: 30,
  height: 180,
  mode: "auto",
  energyEstimated: true,
  updatedAt: "2026-09-18T10:00:00.000Z",
};

export const normHistory: NormSnapshot[] = [
  { date: "2026-09-10", calories: 1900, protein: 125, fat: 58, carbs: 200, bmr: 1690, tdee: 2300, activityLevel: "light", goalMultiplier: 0.85, energyEstimated: true },
  { date: "2026-09-18", calories: 2000, protein: 130, fat: 60, carbs: 220, bmr: 1700, tdee: 2400, activityLevel: "light", goalMultiplier: 0.85, energyEstimated: true },
];

/** What the app stores when the user types targets in by hand: BMR = TDEE = calories, ×1.2, sedentary, multiplier 1. */
export const manualNorm: Norm = {
  calories: 1850,
  protein: 138,
  fat: 75,
  carbs: 140,
  bmr: 1850,
  tdee: 1850,
  activityLevel: "sedentary",
  activityFactor: 1.2,
  goal: "lose",
  goalMultiplier: 1,
  gender: "male",
  age: 22,
  height: 178,
  mode: "manual",
  energyEstimated: false,
  updatedAt: "2026-09-06T10:00:00.000Z",
};

export const manualHistory: NormSnapshot[] = [
  { date: "2026-09-06", calories: 1850, protein: 138, fat: 75, carbs: 140, bmr: 1850, tdee: 1850, activityLevel: "sedentary", goalMultiplier: 1, energyEstimated: false },
];

const entry = (id: string, date: string, addedAt: number, name: string, calories: number, protein = 10): DiaryEntry => ({
  id,
  date,
  addedAt,
  name,
  grams: 100,
  calories,
  protein,
  fat: 5,
  carbs: 20,
});

export const diary: DiaryEntry[] = [
  entry("a", "2026-09-17", moscow("2026-09-17", "09:00"), "Овсянка", 500),
  entry("b", "2026-09-17", moscow("2026-09-17", "19:30"), "Курица | гриль", 1200),
  // Backdated: eaten on the 18th but typed in on the morning of the 19th.
  entry("c", "2026-09-18", moscow("2026-09-19", "08:00"), "Паста", 1800),
  // Today, still in progress.
  entry("d", "2026-09-19", moscow("2026-09-19", "08:00"), "Кофе с молоком", 300),
];

export const weights = [
  { date: "2026-09-17", weight: 82.0, createdAt: 1 },
  { date: "2026-09-19", weight: 81.6, createdAt: 2 },
];

export function fakeDb(overrides: Partial<DataSource> = {}): DataSource {
  const inRange = <T extends { date: string }>(rows: T[], start: string, end: string) =>
    rows.filter((r) => r.date >= start && r.date <= end);

  return {
    getProfile: async () => ({ name: "Тест" }),
    getNorm: async () => currentNorm,
    getSettings: async () => ({ activityTrackingEnabled: true, deficitPercent: 15 }),
    getDiary: async (s, e) => inRange(diary, s, e),
    getWeight: async (s, e) => inRange(weights, s, e),
    getBodyComposition: async (s, e) =>
      inRange([{ date: "2026-09-17", weight: 82.0, bodyFatPercent: 21.5, lbmKg: 64.4, bmrFromScale: 1750 }], s, e),
    getActivity: async (s, e) =>
      inRange([{ date: "2026-09-17", type: "calories", value: 400, caloriesBurned: 400 }], s, e),
    getNormHistory: async (s, e) => {
      const before = normHistory.filter((n) => n.date < s).slice(-1);
      return [...before, ...inRange(normHistory, s, e)];
    },
    ...overrides,
  };
}

/** A DataSource whose targets were typed in manually (placeholder BMR/TDEE). */
export const manualDb = () =>
  fakeDb({
    getNorm: async () => manualNorm,
    getNormHistory: async () => manualHistory,
  });
