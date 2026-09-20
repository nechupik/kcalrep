// Normalised shapes of the Firestore documents this server reads.
// Field names match the site's data model (see ../../src/lib/firestore.ts).
// Firestore docs written by older app versions may lack fields, so every mapper is defensive.
//
// Only what the tools expose is modelled here: collections that are not listed (cycle tracking,
// the shared product/recipe catalogue, usage stats, ...) are deliberately never read.

type Raw = Record<string, unknown>;

export function toMillis(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value && typeof value === "object" && typeof (value as { toMillis?: unknown }).toMillis === "function") {
    return (value as { toMillis: () => number }).toMillis();
  }
  return null;
}

export function toIso(value: unknown): string | null {
  const ms = toMillis(value);
  return ms === null ? null : new Date(ms).toISOString();
}

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const numOrNull = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v: unknown, fallback = ""): string => (typeof v === "string" ? v : fallback);
const strOrNull = (v: unknown): string | null => (typeof v === "string" && v !== "" ? v : null);

export interface DiaryEntry {
  id: string;
  date: string;
  /** Epoch ms when the entry was logged; null if the document has no timestamp. */
  addedAt: number | null;
  name: string;
  grams: number;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}

export function toDiaryEntry(id: string, d: Raw): DiaryEntry {
  return {
    id,
    date: str(d.date),
    addedAt: toMillis(d.addedAt),
    name: str(d.name, "(unnamed)"),
    grams: num(d.grams),
    calories: num(d.calories),
    protein: num(d.protein),
    fat: num(d.fat),
    carbs: num(d.carbs),
  };
}

export interface Norm {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  bmr: number;
  tdee: number;
  activityLevel: string;
  activityFactor: number;
  goal: string;
  /** Applied to TDEE to get the calorie target: 0.85 = 15% deficit, 1.1 = 10% surplus. */
  goalMultiplier: number;
  gender: string | null;
  age: number | null;
  height: number | null;
  /** "manual" = numbers typed in by the user and never auto-recalculated. */
  mode: "manual" | "auto";
  /**
   * False when bmr/tdee/activityLevel/goalMultiplier are placeholders, not real estimates:
   * manual mode stores bmr = tdee = calories, ×1.2, "sedentary" and multiplier 1.
   */
  energyEstimated: boolean;
  updatedAt: string | null;
}

/** A real TDEE never equals BMR (activity factor ≥ 1.2), so bmr = tdee = calories marks a manual norm. */
function isPlaceholderEnergy(calories: number, bmr: number, tdee: number): boolean {
  return calories > 0 && bmr === calories && tdee === calories;
}

export function toNorm(d: Raw): Norm {
  const calories = num(d.calories);
  const bmr = num(d.bmr);
  const tdee = num(d.tdee);
  const mode = d.mode === "manual" ? "manual" : "auto";
  return {
    calories,
    protein: num(d.protein),
    fat: num(d.fat),
    carbs: num(d.carbs),
    bmr,
    tdee,
    activityLevel: str(d.activityLabel),
    activityFactor: num(d.activityFactor),
    goal: str(d.goal),
    goalMultiplier: num(d.goalMultiplier),
    gender: strOrNull(d.gender),
    age: numOrNull(d.age),
    height: numOrNull(d.height),
    mode,
    energyEstimated: mode !== "manual" && !isPlaceholderEnergy(calories, bmr, tdee),
    updatedAt: toIso(d.updatedAt),
  };
}

/** One dated entry of `normHistory`: the targets that were in force from `date` onwards. */
export interface NormSnapshot {
  date: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  bmr: number;
  tdee: number;
  activityLevel: string;
  goalMultiplier: number;
  /** False when bmr/tdee/activityLevel/goalMultiplier are manual-mode placeholders (see Norm.energyEstimated). */
  energyEstimated: boolean;
}

export function toNormSnapshot(d: Raw): NormSnapshot {
  const calories = num(d.calories);
  const bmr = num(d.bmr);
  const tdee = num(d.tdee);
  return {
    date: str(d.date),
    calories,
    protein: num(d.protein),
    fat: num(d.fat),
    carbs: num(d.carbs),
    bmr,
    tdee,
    activityLevel: str(d.activityLabel),
    goalMultiplier: num(d.goalMultiplier),
    // Snapshots carry no `mode`, so detect manual ones by their placeholder signature.
    energyEstimated: !isPlaceholderEnergy(calories, bmr, tdee),
  };
}

export interface UserSettings {
  activityTrackingEnabled: boolean;
  /** The "calorie deficit" slider value, in percent. */
  deficitPercent: number | null;
}

export function toUserSettings(d: Raw): UserSettings {
  return {
    activityTrackingEnabled: d.activityTrackingEnabled !== false,
    deficitPercent: numOrNull(d.deficitPercent),
  };
}

export interface WeightEntry {
  date: string;
  weight: number;
  /** Epoch ms of when it was entered; used only to order several weigh-ins on one date. */
  createdAt: number | null;
}

export function toWeightEntry(d: Raw): WeightEntry {
  return { date: str(d.date), weight: num(d.weight), createdAt: toMillis(d.createdAt) };
}

export interface BodyCompositionEntry {
  date: string;
  weight: number;
  bodyFatPercent: number | null;
  /** Lean body mass, kg. */
  lbmKg: number | null;
  bmrFromScale: number | null;
}

export function toBodyComposition(d: Raw): BodyCompositionEntry {
  return {
    date: str(d.date),
    weight: num(d.weight),
    bodyFatPercent: numOrNull(d.bodyFatPercent),
    lbmKg: numOrNull(d.lbmKg),
    bmrFromScale: numOrNull(d.bmrFromScale),
  };
}

export interface ActivityEntry {
  date: string;
  /** "calories" = Apple Watch kcal, "steps" = step count, "home" = stayed home (no activity). */
  type: string;
  value: number;
  caloriesBurned: number;
}

export function toActivity(d: Raw): ActivityEntry {
  return { date: str(d.date), type: str(d.type), value: num(d.value), caloriesBurned: num(d.caloriesBurned) };
}

export interface UserProfile {
  name: string | null;
}

export function toUserProfile(d: Raw): UserProfile {
  // The e-mail address is deliberately not exposed: nothing here needs it.
  return { name: strOrNull(d.name) };
}
