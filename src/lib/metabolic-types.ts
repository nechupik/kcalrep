// ==========================================
// Metabolic System Types
// ==========================================

/** Cycle phase names */
export type CyclePhase = 'menstrual' | 'follicular' | 'ovulation' | 'luteal';

/** Confidence level for predictions */
export type ConfidenceLevel = 'high' | 'medium' | 'low';

// ------------------------------------------
// Cycle tracking
// ------------------------------------------

/** A single recorded menstrual cycle */
export interface CycleEntry {
  id: string;
  startDate: string;   // YYYY-MM-DD
  endDate: string;      // YYYY-MM-DD (last bleeding day)
  duration: number;     // cycle length in days (startDate of this → startDate of next)
  bleedingDays: number; // endDate - startDate + 1
  confirmed: boolean;   // user-confirmed vs auto-predicted
}

/** Phase boundaries for a single cycle */
export interface CyclePhaseMap {
  menstrual: { start: string; end: string };
  follicular: { start: string; end: string };
  ovulation: { start: string; end: string };
  luteal: { start: string; end: string };
}

/** Prediction result for next cycle */
export interface CyclePrediction {
  nextPeriodStart: string;       // YYYY-MM-DD
  predictedCycleLength: number;
  predictedBleedingDays: number;
  confidence: ConfidenceLevel;
  mad: number;                   // Median Absolute Deviation
  phases: CyclePhaseMap;         // predicted phase boundaries
}

// ------------------------------------------
// Daily survey
// ------------------------------------------

/** Daily well-being survey (1–10 scale) */
export interface DailySurvey {
  date: string;         // YYYY-MM-DD
  hunger: number;       // 1 = not hungry, 10 = starving
  energy: number;       // 1 = exhausted, 10 = energized
  cravings: number;     // 1 = none, 10 = intense sweet cravings
  waterRetention: number; // 1 = none, 10 = very bloated
  mood: number;         // 1 = irritable, 10 = great mood
}

/** EMA symptom averages per cycle day (stored in metabolic config) */
export interface SymptomDayAverage {
  hunger: number;
  energy: number;
  cravings: number;
  waterRetention: number;
  mood: number;
  sampleCount: number; // how many data points contributed
}

// ------------------------------------------
// Body composition
// ------------------------------------------

/** Single body composition entry (manual input from smart scale) */
export interface BodyCompositionEntry {
  id: string;
  date: string;         // YYYY-MM-DD
  weight: number;       // kg
  bodyFatPercent?: number;
  lbmKg?: number;       // lean body mass (kg) — used for BMR and protein
  bmrFromScale?: number; // kcal, if scale provides it
}

// ------------------------------------------
// Metabolic config (per-user singleton)
// ------------------------------------------

/** Stored metabolic engine configuration */
export interface MetabolicConfig {
  // Cycle stats
  avgCycleLength: number;
  avgBleedingDays: number;
  predictionConfidence: ConfidenceLevel;
  mad: number;

  // Comfort floor (learned over time)
  comfortFloorCalories: number | null; // null = not yet learned
  carbFloor: number | null;

  // Current state
  currentPhase: CyclePhase | null;
  currentCycleDay: number | null;
  lastPeriodStart: string | null; // YYYY-MM-DD

  // Symptom learning map: cycleDay → averages
  // Stored as Record<string, SymptomDayAverage> because Firestore doesn't support numeric keys
  symptomMap: Record<string, SymptomDayAverage>;

  updatedAt: number; // timestamp ms
}

// ------------------------------------------
// Macro corrections from cycle engine
// ------------------------------------------

/** Adjustments to apply on top of base MacroResult */
export interface CycleMacroAdjustment {
  phase: CyclePhase;
  calorieAdjustment: number;   // +50 to +100
  carbAdjustment: number;      // grams added
  proteinAdjustment: number;   // usually 0
  fatAdjustment: number;       // always 0 (never cut fats for women)
  reason: string;              // human-readable explanation
  antiPanicMessage: string | null; // shown if weight gain + luteal/menstrual
}

// ------------------------------------------
// Constants
// ------------------------------------------

export const CYCLE_PHASE_LABELS: Record<CyclePhase, string> = {
  menstrual: 'Менструальная',
  follicular: 'Фолликулярная',
  ovulation: 'Овуляция',
  luteal: 'Лютеиновая',
};

export const CONFIDENCE_LABELS: Record<ConfidenceLevel, string> = {
  high: 'Высокая',
  medium: 'Средняя',
  low: 'Низкая',
};

export const SURVEY_LABELS: Record<keyof Omit<DailySurvey, 'date'>, string> = {
  hunger: 'Голод',
  energy: 'Энергия',
  cravings: 'Тяга к сладкому',
  waterRetention: 'Задержка воды',
  mood: 'Настроение',
};

/** EMA smoothing factor for symptom learning */
export const SYMPTOM_EMA_ALPHA = 0.3;

/** Prediction weights for weighted median (last 6 cycles) */
export const PREDICTION_WEIGHTS = [0.25, 0.20, 0.18, 0.15, 0.12, 0.10];

/** MAD confidence thresholds */
export const CONFIDENCE_THRESHOLDS = {
  high: 4,    // MAD ≤ 4
  medium: 7,  // MAD 5-7
  // low: 8+
};

/** Max months of data to keep on client */
export const DATA_WINDOW_MONTHS = 6;
