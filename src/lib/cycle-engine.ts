import type {
  CycleEntry,
  CyclePrediction,
  CyclePhase,
  CyclePhaseMap,
  CycleMacroAdjustment,
  ConfidenceLevel,
  MetabolicConfig,
  DailySurvey,
  SymptomDayAverage,
  BodyCompositionEntry,
} from "./metabolic-types";
import {
  PREDICTION_WEIGHTS,
  CONFIDENCE_THRESHOLDS,
  SYMPTOM_EMA_ALPHA,
} from "./metabolic-types";

// ==========================================
// Date helpers
// ==========================================

function toDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDays(dateStr: string, days: number): string {
  const d = toDate(dateStr);
  d.setDate(d.getDate() + days);
  return toDateStr(d);
}

function daysBetween(a: string, b: string): number {
  const da = toDate(a);
  const db = toDate(b);
  return Math.round((db.getTime() - da.getTime()) / (1000 * 60 * 60 * 24));
}

function todayStr(): string {
  return toDateStr(new Date());
}

// ==========================================
// Statistical helpers
// ==========================================

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/** Median Absolute Deviation */
function computeMAD(values: number[]): number {
  if (values.length === 0) return 0;
  const med = median(values);
  const deviations = values.map((v) => Math.abs(v - med));
  return median(deviations);
}

/** Weighted median: values sorted newest-first, weights from PREDICTION_WEIGHTS */
function weightedMedian(values: number[], weights: number[]): number {
  if (values.length === 0) return 28;
  const n = Math.min(values.length, weights.length);
  const usedValues = values.slice(0, n);
  const usedWeights = weights.slice(0, n);

  // Normalize weights
  const totalW = usedWeights.reduce((s, w) => s + w, 0);
  const normW = usedWeights.map((w) => w / totalW);

  // Sort by value for weighted median calculation
  const pairs = usedValues.map((v, i) => ({ v, w: normW[i] }));
  pairs.sort((a, b) => a.v - b.v);

  let cumWeight = 0;
  for (const p of pairs) {
    cumWeight += p.w;
    if (cumWeight >= 0.5) return p.v;
  }
  return pairs[pairs.length - 1].v;
}

function confidenceFromMAD(mad: number): ConfidenceLevel {
  if (mad <= CONFIDENCE_THRESHOLDS.high) return "high";
  if (mad <= CONFIDENCE_THRESHOLDS.medium) return "medium";
  return "low";
}

// ==========================================
// Phase calculation
// ==========================================

/**
 * Given a cycle start date and predicted cycle length,
 * compute phase boundaries.
 *
 * Phases:
 *   Menstrual:   day 1 → bleedingDays
 *   Follicular:  bleedingDays+1 → ovulationDay-1
 *   Ovulation:   ovulationDay-2 → ovulationDay+2  (5-day window)
 *   Luteal:      ovulationDay+3 → cycleLength
 */
export function computePhases(
  cycleStart: string,
  cycleLength: number,
  bleedingDays: number
): CyclePhaseMap {
  const ovulationDay = cycleLength - 14; // standard luteal phase ~14 days

  const menstrualEnd = addDays(cycleStart, bleedingDays - 1);
  const follicularStart = addDays(cycleStart, bleedingDays);
  const ovulationStart = addDays(cycleStart, Math.max(ovulationDay - 2, bleedingDays));
  const follicularEnd = addDays(ovulationStart, -1);
  const ovulationEnd = addDays(cycleStart, ovulationDay + 2);
  const lutealStart = addDays(ovulationEnd, 1);
  const lutealEnd = addDays(cycleStart, cycleLength - 1);

  return {
    menstrual: { start: cycleStart, end: menstrualEnd },
    follicular: { start: follicularStart, end: follicularEnd },
    ovulation: { start: ovulationStart, end: ovulationEnd },
    luteal: { start: lutealStart, end: lutealEnd },
  };
}

/**
 * Determine which phase a given date falls into.
 */
export function getPhaseForDate(
  date: string,
  phases: CyclePhaseMap
): CyclePhase {
  if (date >= phases.luteal.start && date <= phases.luteal.end) return "luteal";
  if (date >= phases.ovulation.start && date <= phases.ovulation.end) return "ovulation";
  if (date >= phases.follicular.start && date <= phases.follicular.end) return "follicular";
  return "menstrual";
}

/**
 * Get the current cycle day (1-indexed) from cycle start.
 */
export function getCycleDay(cycleStart: string, date?: string): number {
  const target = date || todayStr();
  return daysBetween(cycleStart, target) + 1;
}

// ==========================================
// Prediction engine
// ==========================================

/**
 * Main prediction function.
 * Takes sorted cycles (newest first) and predicts the next cycle.
 */
export function predictNextCycle(cycles: CycleEntry[]): CyclePrediction | null {
  // Need at least 2 cycles to compute any duration
  // (the last cycle needs a "next start" to know its length)
  const withDuration = cycles.filter((c) => c.duration > 0);
  if (withDuration.length < 2) return null;

  // Take last 6 cycles (newest first)
  const recent = withDuration.slice(0, 6);
  const lengths = recent.map((c) => c.duration);
  const bleedingDurations = recent.map((c) => c.bleedingDays);

  // Predicted cycle length via weighted median
  const predictedLength = Math.round(weightedMedian(lengths, PREDICTION_WEIGHTS));

  // Predicted bleeding days via simple average of last 6
  const predictedBleeding = Math.round(
    bleedingDurations.reduce((s, v) => s + v, 0) / bleedingDurations.length
  );

  // MAD and confidence
  const mad = computeMAD(lengths);
  const confidence = confidenceFromMAD(mad);

  // Last period start
  const lastCycle = cycles[0]; // newest
  const nextPeriodStart = addDays(lastCycle.startDate, predictedLength);

  // Phase boundaries for the predicted cycle
  const phases = computePhases(nextPeriodStart, predictedLength, predictedBleeding);

  return {
    nextPeriodStart,
    predictedCycleLength: predictedLength,
    predictedBleedingDays: predictedBleeding,
    confidence,
    mad,
    phases,
  };
}

/**
 * Get current phase and prediction based on all cycle data.
 * Returns { phase, cycleDay, prediction, currentPhases }
 */
export function getCurrentCycleState(cycles: CycleEntry[]) {
  if (cycles.length === 0) return null;

  const sorted = [...cycles].sort(
    (a, b) => b.startDate.localeCompare(a.startDate)
  );
  const lastCycle = sorted[0];
  const today = todayStr();

  // Determine current cycle length estimate
  const withDuration = sorted.filter((c) => c.duration > 0);
  const estimatedLength =
    withDuration.length >= 2
      ? Math.round(
          weightedMedian(
            withDuration.slice(0, 6).map((c) => c.duration),
            PREDICTION_WEIGHTS
          )
        )
      : 28; // fallback

  const avgBleeding =
    sorted.length > 0
      ? Math.round(
          sorted.slice(0, 6).reduce((s, c) => s + c.bleedingDays, 0) /
            Math.min(sorted.length, 6)
        )
      : 5;

  const cycleDay = getCycleDay(lastCycle.startDate, today);

  // Current cycle phase map
  const currentPhases = computePhases(
    lastCycle.startDate,
    estimatedLength,
    avgBleeding
  );
  const phase = getPhaseForDate(today, currentPhases);

  // Future prediction
  const prediction = predictNextCycle(sorted);

  return {
    phase,
    cycleDay,
    currentPhases,
    prediction,
    lastCycleStart: lastCycle.startDate,
    estimatedLength,
  };
}

// ==========================================
// Macro adjustments
// ==========================================

export const CYCLE_CALORIE_BOOST = 100;
export const CYCLE_PRE_START_BOOST_DAYS = 2;

export interface CycleCalorieAdjustment {
  active: boolean;
  calories: number;
  carbs: number;
  source: "recorded" | "predicted" | null;
  windowStart: string | null;
  windowEnd: string | null;
  cycleStart: string | null;
  cycleEnd: string | null;
}

function emptyCycleCalorieAdjustment(): CycleCalorieAdjustment {
  return {
    active: false,
    calories: 0,
    carbs: 0,
    source: null,
    windowStart: null,
    windowEnd: null,
    cycleStart: null,
    cycleEnd: null,
  };
}

function buildCycleCalorieAdjustment(
  source: "recorded" | "predicted",
  cycleStart: string,
  cycleEnd: string
): CycleCalorieAdjustment {
  return {
    active: true,
    calories: CYCLE_CALORIE_BOOST,
    carbs: Math.round(CYCLE_CALORIE_BOOST / 4),
    source,
    windowStart: addDays(cycleStart, -CYCLE_PRE_START_BOOST_DAYS),
    windowEnd: cycleEnd,
    cycleStart,
    cycleEnd,
  };
}

export function getCycleCalorieAdjustmentForDate(
  cycles: CycleEntry[],
  date: string = todayStr(),
  options: { includePrediction?: boolean } = {}
): CycleCalorieAdjustment {
  const sorted = calculateCycleDurations(cycles).sort((a, b) =>
    b.startDate.localeCompare(a.startDate)
  );

  const recordedCycle = sorted.find((cycle) => {
    const windowStart = addDays(cycle.startDate, -CYCLE_PRE_START_BOOST_DAYS);
    return date >= windowStart && date <= cycle.endDate;
  });

  if (recordedCycle) {
    return buildCycleCalorieAdjustment(
      "recorded",
      recordedCycle.startDate,
      recordedCycle.endDate
    );
  }

  if (options.includePrediction !== false) {
    const prediction = predictNextCycle(sorted);
    if (prediction) {
      const predictedEnd = addDays(
        prediction.nextPeriodStart,
        prediction.predictedBleedingDays - 1
      );
      const predictedWindowStart = addDays(
        prediction.nextPeriodStart,
        -CYCLE_PRE_START_BOOST_DAYS
      );

      if (date >= predictedWindowStart && date <= predictedEnd) {
        return buildCycleCalorieAdjustment(
          "predicted",
          prediction.nextPeriodStart,
          predictedEnd
        );
      }
    }
  }

  return emptyCycleCalorieAdjustment();
}

/**
 * Compute calorie/macro adjustments based on current cycle phase.
 * 
 * Rules:
 * - Menstrual: +75 kcal (recovery, reduced deficit pressure) → all carbs
 * - Follicular: no changes (highest fat-loss responsiveness)
 * - Ovulation: no changes
 * - Luteal: +75 kcal, +19g carbs (insulin resistance → carbs reduce cravings)
 * 
 * Confidence scaling: low confidence → halve adjustments
 */
export function computeMacroAdjustment(
  phase: CyclePhase,
  confidence: ConfidenceLevel,
  _bodyComp?: BodyCompositionEntry | null,
  _survey?: DailySurvey | null
): CycleMacroAdjustment {
  const scale = confidence === "low" ? 0.5 : confidence === "medium" ? 0.75 : 1.0;

  const base: CycleMacroAdjustment = {
    phase,
    calorieAdjustment: 0,
    carbAdjustment: 0,
    proteinAdjustment: 0,
    fatAdjustment: 0,
    reason: "",
    antiPanicMessage: null,
  };

  switch (phase) {
    case "menstrual": {
      const boost = Math.round(75 * scale);
      base.calorieAdjustment = boost;
      base.carbAdjustment = Math.round(boost / 4);
      base.reason =
        "Менструальная фаза: организм восстанавливается. Небольшая прибавка углеводов для поддержки энергии.";
      break;
    }
    case "follicular":
      base.reason =
        "Фолликулярная фаза: максимальная отзывчивость к дефициту. Стандартный режим.";
      break;
    case "ovulation":
      base.reason =
        "Овуляция: метаболизм ускоряется. Стандартный режим.";
      break;
    case "luteal": {
      const boost = Math.round(75 * scale);
      base.calorieAdjustment = boost;
      base.carbAdjustment = Math.round(boost / 4);
      base.reason =
        "Лютеиновая фаза: повышенная инсулинорезистентность. Дополнительные углеводы снижают тягу к сладкому.";
      break;
    }
  }

  return base;
}

/**
 * Check if anti-panic message should be shown.
 * Conditions: luteal or menstrual phase + weight increase + elevated water retention.
 */
export function shouldShowAntiPanic(
  phase: CyclePhase,
  recentWeights: BodyCompositionEntry[],
  survey?: DailySurvey | null
): string | null {
  if (phase !== "luteal" && phase !== "menstrual") return null;
  if (recentWeights.length < 2) return null;

  // Check if weight went up in the last entry
  const sorted = [...recentWeights].sort((a, b) => b.date.localeCompare(a.date));
  const latest = sorted[0];
  const previous = sorted[1];

  if (latest.weight <= previous.weight) return null;

  const gain = (latest.weight - previous.weight).toFixed(1);

  // Water retention from survey enhances confidence
  const waterHigh = survey && survey.waterRetention >= 6;

  if (phase === "luteal") {
    return waterHigh
      ? `Вес вырос на ${gain} кг — это вероятная задержка воды в лютеиновой фазе. Вы также отметили повышенную задержку воды. Калории НЕ снижаем.`
      : `Вес вырос на ${gain} кг — в лютеиновой фазе это нормальная задержка жидкости. Калории НЕ снижаем.`;
  }

  return `Вес вырос на ${gain} кг — во время менструации задержка воды физиологична. Это пройдёт через несколько дней. Калории НЕ снижаем.`;
}

// ==========================================
// Symptom learning (EMA)
// ==========================================

/**
 * Update the symptom map with a new daily survey observation.
 * Uses Exponential Moving Average per cycle day.
 */
export function updateSymptomMap(
  map: Record<string, SymptomDayAverage>,
  cycleDay: number,
  survey: DailySurvey
): Record<string, SymptomDayAverage> {
  const key = String(cycleDay);
  const alpha = SYMPTOM_EMA_ALPHA;
  const existing = map[key];

  if (!existing) {
    return {
      ...map,
      [key]: {
        hunger: survey.hunger,
        energy: survey.energy,
        cravings: survey.cravings,
        waterRetention: survey.waterRetention,
        mood: survey.mood,
        sampleCount: 1,
      },
    };
  }

  return {
    ...map,
    [key]: {
      hunger: alpha * survey.hunger + (1 - alpha) * existing.hunger,
      energy: alpha * survey.energy + (1 - alpha) * existing.energy,
      cravings: alpha * survey.cravings + (1 - alpha) * existing.cravings,
      waterRetention:
        alpha * survey.waterRetention + (1 - alpha) * existing.waterRetention,
      mood: alpha * survey.mood + (1 - alpha) * existing.mood,
      sampleCount: existing.sampleCount + 1,
    },
  };
}

// ==========================================
// Full recalculation helper
// ==========================================

/**
 * Recalculate the entire MetabolicConfig from raw cycle data.
 * Called when cycles change (add/edit/delete).
 */
export function recalculateMetabolicConfig(
  cycles: CycleEntry[],
  existingConfig?: MetabolicConfig | null
): MetabolicConfig {
  const sorted = [...cycles].sort(
    (a, b) => b.startDate.localeCompare(a.startDate)
  );
  const withDuration = sorted.filter((c) => c.duration > 0);

  const lengths = withDuration.slice(0, 6).map((c) => c.duration);
  const bleedings = sorted.slice(0, 6).map((c) => c.bleedingDays);

  const avgCycleLength =
    lengths.length > 0
      ? Math.round(lengths.reduce((s, v) => s + v, 0) / lengths.length)
      : 28;
  const avgBleedingDays =
    bleedings.length > 0
      ? Math.round(bleedings.reduce((s, v) => s + v, 0) / bleedings.length)
      : 5;

  const mad = computeMAD(lengths);
  const predictionConfidence = confidenceFromMAD(mad);

  const state = getCurrentCycleState(sorted);

  return {
    avgCycleLength,
    avgBleedingDays,
    predictionConfidence,
    mad,
    comfortFloorCalories: existingConfig?.comfortFloorCalories ?? null,
    carbFloor: existingConfig?.carbFloor ?? null,
    currentPhase: state?.phase ?? null,
    currentCycleDay: state?.cycleDay ?? null,
    lastPeriodStart: sorted.length > 0 ? sorted[0].startDate : null,
    symptomMap: existingConfig?.symptomMap ?? {},
    updatedAt: Date.now(),
  };
}

/**
 * Calculate cycle durations from an array of cycles.
 * Sorts by startDate ascending, then sets duration = diff between consecutive starts.
 */
export function calculateCycleDurations(
  cycles: CycleEntry[]
): CycleEntry[] {
  const sorted = [...cycles].sort(
    (a, b) => a.startDate.localeCompare(b.startDate)
  );

  return sorted.map((cycle, i) => {
    if (i < sorted.length - 1) {
      const nextStart = sorted[i + 1].startDate;
      return { ...cycle, duration: daysBetween(cycle.startDate, nextStart) };
    }
    // Last cycle — duration unknown yet
    return { ...cycle, duration: 0 };
  });
}
