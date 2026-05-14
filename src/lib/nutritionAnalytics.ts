// Аналитический движок для оценки питания
// Реализация спецификации AI Prompt для nutrition engine

export interface NutritionAnalyticsInput {
  currentWeight: number;
  targetWeight?: number;
  avgCalories: number;
  avgProtein: number;
  avgFat: number;
  avgCarbs: number;
  dailyTargetCalories: number;
  dailyTargetProtein: number;
  dailyTargetFat: number;
  dailyTargetCarbs: number;
  activityCalories: number[];
  dailyDeficit: number[];
  weightHistory: { date: string; weight: number }[];
  foodLogsByDay: {
    date: string;
    calories: number;
    protein: number;
    fat: number;
    carbs: number;
    entries: number;
  }[];
  trackedDays: number;
  streakDays: number;
  timestampsMeals: { hour: number; calories: number }[];
}

export interface ProteinComplianceResult {
  score: number;
  successDays: number;
  avgMiss: number;
  verdict: string;
}

export interface DeficitAnalysisResult {
  expectedLoss: number;
  actualLoss: number;
  discrepancy: number;
  interpretation: string;
  possibleCause?: string;
}

export interface PlateauResult {
  plateau: boolean;
  daysStuck: number;
  recommendation?: string;
}

export interface ProteinForecastResult {
  remainingProtein: number;
  urgency: 'low' | 'medium' | 'high';
  practicalAdvice: string;
}

export interface StabilityResult {
  stabilityScore: number;
  variance: number;
  explanation: string;
}

export interface PatternInsight {
  type: 'weekend' | 'weekday' | 'evening' | 'variance';
  description: string;
  severity: 'info' | 'warning' | 'alert';
}

export interface RecoveryRiskResult {
  riskLevel: 'none' | 'low' | 'medium' | 'high';
  explanation: string;
}

export interface WeightInterpretationResult {
  type: 'water' | 'fluctuation' | 'real' | 'none';
  explanation: string;
}

export interface StreaksResult {
  calorieStreak: number;
  proteinStreak: number;
  deficitStreak: number;
}

export interface NutritionAnalyticsResult {
  nutritionScore: number;
  proteinCompliance: ProteinComplianceResult;
  deficitAnalysis: DeficitAnalysisResult;
  plateau: PlateauResult;
  forecast: ProteinForecastResult | null;
  stability: StabilityResult;
  patterns: PatternInsight[];
  recovery: RecoveryRiskResult;
  weightInterpretation: WeightInterpretationResult;
  streaks: StreaksResult;
  dailyVerdict: string;
}

// Constants
const CALORIES_PER_KG = 7700;
const PROTEIN_THRESHOLD_LOW = 0.7;
const PROTEIN_THRESHOLD_HIGH = 0.9;
const DEFICIT_THRESHOLD_LOW = 300;
const DEFICIT_THRESHOLD_HIGH = 800;
const PLATEAU_DAYS = 14;
const VARIANCE_THRESHOLD_LOW = 200;
const VARIANCE_THRESHOLD_HIGH = 500;

/**
 * Calculate protein compliance score
 */
function calculateProteinCompliance(
  foodLogsByDay: NutritionAnalyticsInput['foodLogsByDay'],
  targetProtein: number,
  avgProtein: number
): ProteinComplianceResult {
  if (foodLogsByDay.length === 0 || targetProtein === 0) {
    return { score: 0, successDays: 0, avgMiss: 0, verdict: 'Недостаточно данных' };
  }

  const daysWithData = foodLogsByDay.filter(day => day.entries > 0);
  if (daysWithData.length === 0) {
    return { score: 0, successDays: 0, avgMiss: 0, verdict: 'Недостаточно данных' };
  }

  let successDays = 0;
  let totalMiss = 0;
  let missCount = 0;

  daysWithData.forEach(day => {
    const ratio = day.protein / targetProtein;
    if (ratio >= 0.9) {
      successDays++;
    } else {
      totalMiss += (1 - ratio) * 100;
      missCount++;
    }
  });

  const score = Math.round((successDays / daysWithData.length) * 100);
  const avgMiss = missCount > 0 ? Math.round(totalMiss / missCount) : 0;

  let verdict: string;
  if (score >= 90) {
    verdict = 'Отличное выполнение белковой нормы';
  } else if (score >= 75) {
    verdict = 'Хороший результат, но есть куда расти';
  } else if (score >= 60) {
    verdict = 'Нормально, рекомендуется увеличить белок';
  } else if (score >= 40) {
    verdict = 'Требует внимания: белок недобран часто';
  } else {
    verdict = 'Критично: низкий белок влияет на сохранение мышц';
  }

  // Calculate needed protein daily
  const neededProteinDaily = targetProtein - avgProtein;
  if (neededProteinDaily > 0 && score < 90) {
    verdict += ` Для достижения цели добавьте ещё ${Math.round(neededProteinDaily)}г белка ежедневно.`;
  }

  return { score, successDays, avgMiss, verdict };
}

/**
 * Analyze expected vs real deficit and weight loss with adaptation factor
 */
function analyzeDeficit(
  dailyDeficit: number[],
  weightHistory: NutritionAnalyticsInput['weightHistory'],
  avgCalories: number,
  targetCalories: number
): DeficitAnalysisResult {
  if (dailyDeficit.length === 0 || weightHistory.length < 2) {
    return {
      expectedLoss: 0,
      actualLoss: 0,
      discrepancy: 0,
      interpretation: 'Недостаточно данных для анализа',
    };
  }

  const totalDeficit = dailyDeficit.reduce((sum, d) => sum + d, 0);
  
  // Calculate days tracked for adaptation factor
  const daysTracked = dailyDeficit.length;
  let adaptationFactor: number;
  if (daysTracked < 30) {
    adaptationFactor = 0.55;
  } else if (daysTracked <= 90) {
    adaptationFactor = 0.65;
  } else {
    adaptationFactor = 0.75;
  }
  
  const expectedLoss = (totalDeficit / CALORIES_PER_KG) * adaptationFactor;

  const sortedHistory = [...weightHistory].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  const actualLoss = sortedHistory[0].weight - sortedHistory[sortedHistory.length - 1].weight;

  const discrepancy = expectedLoss !== 0 
    ? Math.abs(((actualLoss - expectedLoss) / expectedLoss) * 100)
    : 0;

  let interpretation: string;
  let possibleCause: string | undefined;

  if (discrepancy <= 10) {
    interpretation = 'Дефицит и потеря веса совпадают отлично';
  } else if (discrepancy <= 35) {
    interpretation = 'Результат находится в пределах нормальной физиологической вариативности.';
  } else if (discrepancy <= 50) {
    interpretation = 'Наблюдается расхождение в пределах ожидаемого диапазона.';
  } else {
    interpretation = 'Значительное отклонение: рекомендуется проверить точность учёта калорий и активности.';
    
    if (actualLoss < expectedLoss * 0.8) {
      possibleCause = 'Возможные причины: недоучёт калорий, задержка воды, нестабильность логов';
    } else if (actualLoss > expectedLoss * 1.2) {
      possibleCause = 'Возможные причины: быстрая потеря воды в начале периода';
    }
  }

  return { expectedLoss, actualLoss, discrepancy, interpretation, possibleCause };
}

/**
 * Detect weight loss plateau
 */
function detectPlateau(weightHistory: NutritionAnalyticsInput['weightHistory']): PlateauResult {
  if (weightHistory.length < PLATEAU_DAYS) {
    return { plateau: false, daysStuck: 0 };
  }

  const sortedHistory = [...weightHistory].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const recentWeights = sortedHistory.slice(-PLATEAU_DAYS);
  const firstWeight = recentWeights[0].weight;
  const lastWeight = recentWeights[recentWeights.length - 1].weight;
  
  // Check if weight is essentially flat (within 0.5 kg)
  const plateau = Math.abs(lastWeight - firstWeight) < 0.5;
  const daysStuck = plateau ? PLATEAU_DAYS : 0;

  let recommendation: string | undefined;
  if (plateau) {
    recommendation = 'Рекомендации: снизить калории на 100-150 ккал, повысить активность, проверить точность логирования';
  }

  return { plateau, daysStuck, recommendation };
}

/**
 * Forecast protein needs for today
 */
function forecastProtein(
  foodLogsByDay: NutritionAnalyticsInput['foodLogsByDay'],
  targetProtein: number
): ProteinForecastResult | null {
  const now = new Date();
  const currentHour = now.getHours();

  if (currentHour <= 16) {
    return null; // Only show after 16:00
  }

  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const todayLog = foodLogsByDay.find(day => day.date === today);

  if (!todayLog || todayLog.entries === 0) {
    return {
      remainingProtein: targetProtein,
      urgency: 'high',
      practicalAdvice: 'Сегодня ещё нет записей. Добавьте белковый ужин, чтобы набрать норму.',
    };
  }

  const currentProtein = todayLog.protein;
  const ratio = currentProtein / targetProtein;

  if (ratio >= 0.7) {
    return null; // Already on track
  }

  const remainingProtein = Math.round(targetProtein - currentProtein);
  
  let urgency: 'low' | 'medium' | 'high';
  let practicalAdvice: string;

  if (ratio < 0.5) {
    urgency = 'high';
    practicalAdvice = `Срочно нужно ${remainingProtein}г белка. Варианты: 200г творога + протеиновый коктейль, или 300г куриной грудки.`;
  } else if (ratio < 0.7) {
    urgency = 'medium';
    practicalAdvice = `Осталось набрать ${remainingProtein}г белка. Добавьте на ужин: 150г рыбы или 200г творога.`;
  } else {
    urgency = 'low';
    practicalAdvice = `Немного не хватает: ${remainingProtein}г. Достаточно добавить 100г куриной грудки.`;
  }

  return { remainingProtein, urgency, practicalAdvice };
}

/**
 * Analyze calorie stability/variance
 */
function analyzeStability(foodLogsByDay: NutritionAnalyticsInput['foodLogsByDay']): StabilityResult {
  const daysWithData = foodLogsByDay.filter(day => day.entries > 0);
  
  if (daysWithData.length < 3) {
    return {
      stabilityScore: 0,
      variance: 0,
      explanation: 'Недостаточно данных для анализа стабильности',
    };
  }

  const calories = daysWithData.map(day => day.calories);
  const avg = calories.reduce((sum, c) => sum + c, 0) / calories.length;
  const variance = Math.sqrt(
    calories.reduce((sum, c) => sum + Math.pow(c - avg, 2), 0) / calories.length
  );

  let stabilityScore: number;
  let explanation: string;

  if (variance < VARIANCE_THRESHOLD_LOW) {
    stabilityScore = 90;
    explanation = 'Отличная стабильность калорий — идеально для прогресса';
  } else if (variance < VARIANCE_THRESHOLD_HIGH) {
    stabilityScore = 70;
    explanation = 'Хорошая стабильность, небольшие колебания нормальны';
  } else {
    stabilityScore = 40;
    explanation = 'Средний дефицит нормальный, но колебания мешают стабильному прогрессу';
  }

  return { stabilityScore, variance: Math.round(variance), explanation };
}

/**
 * Detect weekly patterns
 */
function detectPatterns(
  foodLogsByDay: NutritionAnalyticsInput['foodLogsByDay'],
  timestampsMeals: NutritionAnalyticsInput['timestampsMeals']
): PatternInsight[] {
  const patterns: PatternInsight[] = [];

  if (foodLogsByDay.length < 7) {
    return patterns;
  }

  // Weekend overeating detection
  const weekendDays = foodLogsByDay.filter(day => {
    const date = new Date(day.date);
    const dayOfWeek = date.getDay();
    return dayOfWeek === 0 || dayOfWeek === 6; // Sunday or Saturday
  });

  const weekdayDays = foodLogsByDay.filter(day => {
    const date = new Date(day.date);
    const dayOfWeek = date.getDay();
    return dayOfWeek >= 1 && dayOfWeek <= 5;
  });

  if (weekendDays.length > 0 && weekdayDays.length > 0) {
    const weekendAvg = weekendDays.reduce((sum, d) => sum + d.calories, 0) / weekendDays.length;
    const weekdayAvg = weekdayDays.reduce((sum, d) => sum + d.calories, 0) / weekdayDays.length;

    if (weekendAvg > weekdayAvg * 1.2) {
      patterns.push({
        type: 'weekend',
        description: `Переедание в выходные: +${Math.round(weekendAvg - weekdayAvg)} ккал в среднем`,
        severity: 'warning',
      });
    }
  }

  // Weekday protein deficit
  if (weekdayDays.length > 0) {
    const avgProteinWeekday = weekdayDays.reduce((sum, d) => sum + d.protein, 0) / weekdayDays.length;
    // Assuming target protein is available through comparison
    if (avgProteinWeekday < 80) { // Generic threshold
      patterns.push({
        type: 'weekday',
        description: 'Недобор белка по будням — добавьте перекусы',
        severity: 'warning',
      });
    }
  }

  // Evening overeating detection
  if (timestampsMeals.length > 0) {
    const eveningMeals = timestampsMeals.filter(m => m.hour >= 19);
    const eveningCalories = eveningMeals.reduce((sum, m) => sum + m.calories, 0);
    const totalCalories = timestampsMeals.reduce((sum, m) => sum + m.calories, 0);

    if (totalCalories > 0 && eveningCalories / totalCalories > 0.4) {
      patterns.push({
        type: 'evening',
        description: 'Вечернее переедание: более 40% калорий после 19:00',
        severity: 'alert',
      });
    }
  }

  // Calorie spikes detection
  const calories = foodLogsByDay.filter(d => d.entries > 0).map(d => d.calories);
  if (calories.length >= 5) {
    const avg = calories.reduce((sum, c) => sum + c, 0) / calories.length;
    const spikes = calories.filter(c => c > avg * 1.5).length;
    
    if (spikes >= 2) {
      patterns.push({
        type: 'variance',
        description: `Обнаружены скачки калорий: ${spikes} дня с резким превышением`,
        severity: 'info',
      });
    }
  }

  return patterns;
}

/**
 * Assess recovery risk with stricter criteria
 * High risk only if ALL conditions met:
 * - deficit >35% TDEE
 * - protein <70% of target
 * - weight loss >1% per week
 * - continues >7 days
 */
function assessRecoveryRisk(
  dailyDeficit: number[],
  avgProtein: number,
  targetProtein: number,
  activityCalories: number[],
  weightHistory: NutritionAnalyticsInput['weightHistory'],
  targetCalories: number
): RecoveryRiskResult {
  if (dailyDeficit.length < 7 || weightHistory.length < 2 || targetCalories === 0) {
    return { riskLevel: 'none', explanation: 'Недостаточно данных для оценки' };
  }

  const avgDeficit = dailyDeficit.reduce((sum, d) => sum + d, 0) / dailyDeficit.length;
  const proteinRatio = targetProtein > 0 ? avgProtein / targetProtein : 1;
  
  // Calculate weight loss rate
  const sorted = [...weightHistory].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  const currentWeight = sorted[sorted.length - 1].weight;
  const daysDiff = Math.max(1, (new Date(sorted[sorted.length - 1].date).getTime() - new Date(sorted[0].date).getTime()) / (1000 * 60 * 60 * 24));
  const weightLoss = sorted[0].weight - sorted[sorted.length - 1].weight;
  const weeklyLossRate = ((weightLoss / daysDiff) * 7) / currentWeight; // % of body weight per week

  // Count risk factors
  let riskFactors = 0;
  const deficitPercent = (avgDeficit / targetCalories) * 100;
  
  if (deficitPercent > 35) riskFactors++;
  if (proteinRatio < 0.70) riskFactors++;
  if (weeklyLossRate > 0.01) riskFactors++; // >1% per week
  if (daysDiff >= 7) riskFactors++;

  let riskLevel: 'none' | 'low' | 'medium' | 'high';
  let explanation: string;

  if (riskFactors >= 4) {
    riskLevel = 'high';
    explanation = 'Текущий дефицит может быть слишком агрессивным при длительном соблюдении. Рекомендуется увеличить калории или белок.';
  } else if (riskFactors >= 2) {
    riskLevel = 'medium';
    explanation = 'Умеренный риск. При длительном сохранении возможны снижение энергии и ухудшение восстановления.';
  } else {
    riskLevel = 'low';
    explanation = 'Низкий риск. Текущий режим поддерживает хорошее восстановление.';
  }

  return { riskLevel, explanation };
}

/**
 * Interpret weight changes with specific rate calculation
 */
function interpretWeight(weightHistory: NutritionAnalyticsInput['weightHistory']): WeightInterpretationResult {
  if (weightHistory.length < 2) {
    return { type: 'none', explanation: 'Недостаточно данных' };
  }

  const sorted = [...weightHistory].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const currentWeight = sorted[sorted.length - 1].weight;
  const daysDiff = Math.max(1, (new Date(sorted[sorted.length - 1].date).getTime() - new Date(sorted[0].date).getTime()) / (1000 * 60 * 60 * 24));
  const totalLoss = sorted[0].weight - sorted[sorted.length - 1].weight;
  const weeklyRate = (totalLoss / daysDiff) * 7;
  const weeklyRatePercent = (weeklyRate / sorted[0].weight) * 100;

  const recentChange = sorted[sorted.length - 1].weight - sorted[sorted.length - 2].weight;

  if (recentChange <= 0.2 && recentChange >= -0.2) {
    return { 
      type: 'none', 
      explanation: `Вес стабилен. Средний темп: ${weeklyRate >= 0 ? '' : '+'}${weeklyRate.toFixed(2)} кг/нед.` 
    };
  }

  if (recentChange > 0) {
    // Weight increased
    let explanation: string;
    if (recentChange < 0.5) {
      explanation = `Небольшой прирост — нормальная флуктуация. Средний темп снижения: ${Math.abs(weeklyRate).toFixed(2)} кг/нед.`;
    } else if (recentChange < 1.0) {
      explanation = `Временное увеличение — вероятно задержка воды. Средний темп: ${Math.abs(weeklyRate).toFixed(2)} кг/нед.`;
    } else {
      explanation = `Значительный прирост. Средний темп: ${Math.abs(weeklyRate).toFixed(2)} кг/нед. Проверьте калории за последние 3-5 дней.`;
    }
    return { type: recentChange < 0.5 ? 'fluctuation' : 'water', explanation };
  }

  // Weight decreased
  let explanation: string;
  if (weeklyRatePercent > 1.0) {
    explanation = `Средний темп: −${Math.abs(weeklyRate).toFixed(2)} кг/нед (${weeklyRatePercent.toFixed(1)}% массы). Темп превышает рекомендуемый, возможна потеря мышечной массы.`;
  } else if (weeklyRatePercent > 0.5) {
    explanation = `Средний темп: −${Math.abs(weeklyRate).toFixed(2)} кг/нед (${weeklyRatePercent.toFixed(1)}% массы). Это безопасный диапазон для снижения жировой массы.`;
  } else {
    explanation = `Средний темп: −${Math.abs(weeklyRate).toFixed(2)} кг/нед. Комфортное снижение веса.`;
  }
  
  return { type: 'fluctuation', explanation };
}

/**
 * Calculate streaks with user-friendly labels
 */
function calculateStreaks(
  foodLogsByDay: NutritionAnalyticsInput['foodLogsByDay'],
  dailyDeficit: number[],
  targetCalories: number,
  targetProtein: number
): StreaksResult {
  const sortedDays = [...foodLogsByDay].sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  // Calorie streak (within ±10% of target)
  let calorieStreak = 0;
  for (const day of sortedDays) {
    if (day.entries === 0) continue;
    const ratio = day.calories / targetCalories;
    if (ratio >= 0.9 && ratio <= 1.1) {
      calorieStreak++;
    } else {
      break;
    }
  }

  // Protein streak (≥90% of target)
  let proteinStreak = 0;
  for (const day of sortedDays) {
    if (day.entries === 0) continue;
    const ratio = day.protein / targetProtein;
    if (ratio >= 0.9) {
      proteinStreak++;
    } else {
      break;
    }
  }

  // Deficit streak (positive deficit)
  let deficitStreak = 0;
  const sortedDeficits = [...dailyDeficit].reverse();
  for (const deficit of sortedDeficits) {
    if (deficit > 0) {
      deficitStreak++;
    } else {
      break;
    }
  }

  return { calorieStreak, proteinStreak, deficitStreak };
}

/**
 * Format streak for display (replaces 0 with motivational text)
 */
export function formatStreak(streak: number): { value: string; label: string } {
  if (streak === 0) {
    return { value: 'Старт', label: 'Новая цель' };
  }
  return { value: String(streak), label: streak === 1 ? 'день' : streak < 5 ? 'дня' : 'дней' };
}

/**
 * Generate daily verdict
 */
function generateDailyVerdict(
  foodLogsByDay: NutritionAnalyticsInput['foodLogsByDay'],
  dailyDeficit: number[],
  targetCalories: number,
  targetProtein: number,
  plateu: PlateauResult,
  proteinCompliance: ProteinComplianceResult
): string {
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const todayLog = foodLogsByDay.find(day => day.date === todayKey);

  // Check if today has data
  if (!todayLog || todayLog.entries === 0) {
    if (plateu.plateau) {
      return 'Вес стоит на месте уже 2 недели. Сегодня важно точно попасть в норму калорий и белка.';
    }
    return 'Сегодня ещё нет записей. Начните день с белкового завтрака!';
  }

  const calorieRatio = todayLog.calories / targetCalories;
  const proteinRatio = todayLog.protein / targetProtein;
  const todayDeficit = dailyDeficit.length > 0 ? dailyDeficit[dailyDeficit.length - 1] : 0;

  // Perfect day
  if (calorieRatio >= 0.9 && calorieRatio <= 1.05 && proteinRatio >= 0.9) {
    if (todayDeficit > 300) {
      return 'Отличный день для снижения веса. Белок достигнут, дефицит умеренный.';
    }
    return 'Идеальный день — всё по плану!';
  }

  // Good calories, low protein
  if (calorieRatio >= 0.9 && calorieRatio <= 1.1 && proteinRatio < 0.9) {
    return `Калории в норме, но белок низкий (${Math.round(proteinRatio * 100)}%) — завтра возможен повышенный голод.`;
  }

  // Low calories, good protein
  if (calorieRatio < 0.9 && proteinRatio >= 0.9) {
    return 'Белок отличный, но калории слишком низкие. При длительном сохранении возможны снижение энергии и ухудшение восстановления.';
  }

  // Over calories
  if (calorieRatio > 1.1) {
    return `Сегодня превышение на ${Math.round((calorieRatio - 1) * 100)}%. Завтра вернитесь к норме.`;
  }

  // Low everything
  if (calorieRatio < 0.7) {
    return 'Слишком мало калорий сегодня. Текущий дефицит может быть слишком агрессивным.';
  }

  // Default
  return 'День в процессе. Следите за балансом калорий и белка.';
}

/**
 * Calculate overall nutrition score (0-100)
 */
function calculateNutritionScore(
  proteinCompliance: ProteinComplianceResult,
  stability: StabilityResult,
  deficitAnalysis: DeficitAnalysisResult,
  streaks: StreaksResult,
  recovery: RecoveryRiskResult
): number {
  let score = 50; // Base score

  // Protein compliance (max 25 points)
  score += (proteinCompliance.score / 100) * 25;

  // Stability (max 20 points)
  score += (stability.stabilityScore / 100) * 20;

  // Deficit accuracy (max 15 points)
  if (deficitAnalysis.discrepancy <= 10) {
    score += 15;
  } else if (deficitAnalysis.discrepancy <= 20) {
    score += 10;
  } else {
    score += 5;
  }

  // Streaks (max 20 points)
  const streakBonus = Math.min(streaks.calorieStreak, 7) * 2 + 
                      Math.min(streaks.proteinStreak, 7) * 1;
  score += Math.min(streakBonus, 20);

  // Recovery penalty
  if (recovery.riskLevel === 'high') {
    score -= 15;
  } else if (recovery.riskLevel === 'medium') {
    score -= 8;
  } else if (recovery.riskLevel === 'low') {
    score -= 3;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Main analytics function
 */
export function analyzeNutrition(input: NutritionAnalyticsInput): NutritionAnalyticsResult {
  const proteinCompliance = calculateProteinCompliance(input.foodLogsByDay, input.dailyTargetProtein, input.avgProtein);
  const deficitAnalysis = analyzeDeficit(input.dailyDeficit, input.weightHistory, input.avgCalories, input.dailyTargetCalories);
  const plateau = detectPlateau(input.weightHistory);
  const forecast = forecastProtein(input.foodLogsByDay, input.dailyTargetProtein);
  const stability = analyzeStability(input.foodLogsByDay);
  const patterns = detectPatterns(input.foodLogsByDay, input.timestampsMeals);
  const recovery = assessRecoveryRisk(input.dailyDeficit, input.avgProtein, input.dailyTargetProtein, input.activityCalories, input.weightHistory, input.dailyTargetCalories);
  const weightInterpretation = interpretWeight(input.weightHistory);
  const streaks = calculateStreaks(input.foodLogsByDay, input.dailyDeficit, input.dailyTargetCalories, input.dailyTargetProtein);
  const dailyVerdict = generateDailyVerdict(input.foodLogsByDay, input.dailyDeficit, input.dailyTargetCalories, input.dailyTargetProtein, plateau, proteinCompliance);
  const nutritionScore = calculateNutritionScore(proteinCompliance, stability, deficitAnalysis, streaks, recovery);

  return {
    nutritionScore,
    proteinCompliance,
    deficitAnalysis,
    plateau,
    forecast,
    stability,
    patterns,
    recovery,
    weightInterpretation,
    streaks,
    dailyVerdict,
  };
}

/**
 * Format analytics result for display
 */
export function formatAnalyticsForDisplay(result: NutritionAnalyticsResult) {
  return {
    ...result,
    formattedScore: `${result.nutritionScore}/100`,
    scoreLabel: result.nutritionScore >= 80 ? 'Отлично' : 
                result.nutritionScore >= 60 ? 'Хорошо' : 
                result.nutritionScore >= 40 ? 'Средне' : 'Требует внимания',
    scoreColor: result.nutritionScore >= 80 ? 'green' : 
                result.nutritionScore >= 60 ? 'yellow' : 
                result.nutritionScore >= 40 ? 'orange' : 'red',
  };
}
