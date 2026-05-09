// Питательные расчёты и база продуктов

const MIN_CALORIES_FEMALE = 1200;
const MIN_CALORIES_MALE = 1500;

export type Gender = "male" | "female";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "veryActive";
export type Goal = "lose" | "maintain" | "gain";
export type ActivityMode = "steps" | "workouts" | "both";

export interface WorkoutsInfo {
  perWeek: number; // 0..14
  intensity: "light" | "moderate" | "hard";
}

export interface CalcInput {
  gender: Gender;
  age: number;
  height: number;
  weight: number;
  activityMode: ActivityMode;
  steps?: number;
  workouts?: WorkoutsInfo;
  goal: Goal;
}

export interface MacroResult {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  bmr: number;
  tdee: number;
  activityFactor: number;
  activityLabel: ActivityLevel;
  goalMultiplier: number;
  warning?: string;
}

const ACTIVITY_FACTOR: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  veryActive: 1.9,
};

const GOAL_ADJUSTMENT: Record<Goal, number> = {
  lose: -0.10,
  maintain: 0,
  gain: 0.10,
};

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: "Минимальная",
  light: "Лёгкая",
  moderate: "Средняя",
  active: "Высокая",
  veryActive: "Очень высокая",
};

export const GOAL_LABELS: Record<Goal, string> = {
  lose: "Снижение веса",
  maintain: "Поддержание",
  gain: "Набор массы",
};

export const ACTIVITY_MODE_LABELS: Record<ActivityMode, string> = {
  steps: "По шагам в день",
  workouts: "По тренировкам",
  both: "Шаги + тренировки",
};

function levelFromSteps(steps: number): ActivityLevel {
  if (steps < 4000) return "sedentary";
  if (steps < 7500) return "light";
  if (steps < 10500) return "moderate";
  if (steps < 13500) return "active";
  return "active"; // Cap at active (1.725), not veryActive (1.9) for steps alone
}

function levelFromWorkouts(w: WorkoutsInfo): ActivityLevel {
  const order: ActivityLevel[] = ["sedentary", "light", "moderate", "active", "veryActive"];
  let level: ActivityLevel = "sedentary";
  if (w.perWeek <= 0) level = "sedentary";
  else if (w.perWeek <= 2) level = "light";
  else if (w.perWeek <= 4) level = "moderate";
  else if (w.perWeek <= 6) level = "active";
  else level = "veryActive";
  const idx = order.indexOf(level);
  const shift = w.intensity === "hard" ? 1 : w.intensity === "light" ? -1 : 0;
  return order[Math.max(0, Math.min(order.length - 1, idx + shift))];
}

function combineLevels(a: ActivityLevel, b: ActivityLevel): ActivityLevel {
  const order: ActivityLevel[] = ["sedentary", "light", "moderate", "active", "veryActive"];
  const ia = order.indexOf(a);
  const ib = order.indexOf(b);
  return order[Math.min(Math.max(ia, ib), order.length - 1)];
}

export function resolveActivityLevel(input: CalcInput): ActivityLevel {
  if (input.activityMode === "steps") return levelFromSteps(input.steps ?? 0);
  if (input.activityMode === "workouts")
    return levelFromWorkouts(input.workouts ?? { perWeek: 0, intensity: "moderate" });
  const fromSteps = levelFromSteps(input.steps ?? 0);
  const fromWorkouts = levelFromWorkouts(input.workouts ?? { perWeek: 0, intensity: "moderate" });
  return combineLevels(fromSteps, fromWorkouts);
}

export function calculateMacros(input: CalcInput): MacroResult {
  const { gender, age, height, weight, goal } = input;

  const bmr =
    gender === "male"
      ? 10 * weight + 6.25 * height - 5 * age + 5
      : 10 * weight + 6.25 * height - 5 * age - 161;

  const level = resolveActivityLevel(input);
  const factor = ACTIVITY_FACTOR[level];
  const tdee = bmr * factor;
  const goalMultiplier = 1 + GOAL_ADJUSTMENT[goal];
  const calories = Math.round(tdee * goalMultiplier);

  const bmi = weight / ((height / 100) ** 2);
  const proteinPerKg = gender === 'female' ? 1.7 : 2.0;
  const rawProtein = Math.round(weight * proteinPerKg);
  const protein = bmi > 30
    ? Math.round(Math.min(rawProtein, weight * 1.6))
    : rawProtein;
  const fatFromPercent = Math.round((calories * 0.27) / 9);
  const fatFromWeight = Math.round(weight * 1.0);
  const fat = Math.max(fatFromPercent, fatFromWeight);
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4));

  let warning: string | undefined;

  // Minimum fat floor - gender specific
  const minFat = Math.round(weight * 1.0);

  let finalFat = Math.max(fat, minFat);

  // Recalculate carbs if fat was bumped up
  let finalCarbs = Math.max(0, Math.round((calories - protein * 4 - finalFat * 9) / 4));

  // Minimum calorie floor
  const minCalories = gender === 'female' ? MIN_CALORIES_FEMALE : MIN_CALORIES_MALE;
  let finalCalories = calories;

  if (calories < minCalories) {
    finalCalories = minCalories;
    // Recalculate carbs with new calorie floor
    finalCarbs = Math.max(0, Math.round((finalCalories - protein * 4 - finalFat * 9) / 4));
    warning = gender === 'female'
      ? 'Калораж близок к минимуму для женского здоровья. Чтобы худеть без вреда для гормонов, рекомендуем увеличить активность до 8–10 тыс. шагов в день — это поднимет норму калорий.'
      : 'Калораж близок к минимуму. Рекомендуем увеличить активность, чтобы не снижать обмен веществ.';
  } else if (gender === 'female' && calories < 1400) {
    warning = 'Калораж невысокий. Регулярная активность (8–10 тыс. шагов) позволит поднять норму и худеть комфортнее.';
  }

  return {
    calories: finalCalories,
    protein,
    fat: finalFat,
    carbs: finalCarbs,
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    activityFactor: factor,
    activityLabel: level,
    goalMultiplier,
    warning,
  };
}

export function recalculateNormWithNewWeight(
  currentNorm: any, // Using any since NormData is in firestore.ts
  newWeight: number
): MacroResult {
  const input: CalcInput = {
    gender: currentNorm.gender,
    age: currentNorm.age,
    height: currentNorm.height,
    weight: newWeight,
    activityMode: "steps",
    steps: 0,
    goal: currentNorm.goal as Goal,
  };
  // Manually set the activity factor instead of recalculating from steps
  const result = calculateMacros(input);
  // Override with stored activity factor to preserve original activity level
  const tdee = Math.round(result.bmr * currentNorm.activityFactor);
  const calories = Math.round(tdee * currentNorm.goalMultiplier);
  const bmi = newWeight / ((currentNorm.height / 100) ** 2);
  const gender = currentNorm.gender as Gender;
  const proteinPerKg = gender === 'female' ? 1.7 : 2.0;
  const rawProtein = Math.round(newWeight * proteinPerKg);
  const protein = bmi > 30 ? Math.round(Math.min(rawProtein, newWeight * 1.6)) : rawProtein;
  const fatFromPercent = Math.round((calories * 0.27) / 9);
  const fatFromWeight = Math.round(newWeight * 1.0);
  const fat = Math.max(fatFromPercent, fatFromWeight);
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4));

  const minFat = Math.round(newWeight * 1.0);
  const finalFat = Math.max(fat, minFat);
  const minCalories = gender === 'female' ? MIN_CALORIES_FEMALE : MIN_CALORIES_MALE;
  const finalCalories = Math.max(calories, minCalories);
  const finalCarbs = Math.max(0, Math.round((finalCalories - protein * 4 - finalFat * 9) / 4));

  let warning: string | undefined;
  if (calories < minCalories) {
    warning = gender === 'female'
      ? 'Калораж близок к минимуму для женского здоровья. Рекомендуем увеличить активность до 8–10 тыс. шагов.'
      : 'Калораж близок к минимуму. Рекомендуем увеличить активность.';
  }

  return {
    calories: finalCalories,
    protein,
    fat: finalFat,
    carbs: finalCarbs,
    bmr: result.bmr,
    tdee,
    activityFactor: currentNorm.activityFactor,
    activityLabel: currentNorm.activityLabel,
    goalMultiplier: currentNorm.goalMultiplier,
    warning,
  };
}

// База продуктов (значения на 100 г)
export interface FoodItem {
  id: string;
  name: string;
  category: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}

export const FOODS: FoodItem[] = [
  // Мясо и птица
  { id: "chicken-breast", name: "Куриная грудка", category: "Мясо", calories: 165, protein: 31, fat: 3.6, carbs: 0 },
  { id: "beef", name: "Говядина", category: "Мясо", calories: 250, protein: 26, fat: 17, carbs: 0 },
  { id: "pork", name: "Свинина", category: "Мясо", calories: 263, protein: 17, fat: 21, carbs: 0 },
  { id: "turkey", name: "Индейка (филе)", category: "Мясо", calories: 135, protein: 30, fat: 1, carbs: 0 },
  // Рыба
  { id: "salmon", name: "Лосось", category: "Рыба", calories: 208, protein: 20, fat: 13, carbs: 0 },
  { id: "tuna", name: "Тунец", category: "Рыба", calories: 132, protein: 28, fat: 1, carbs: 0 },
  { id: "cod", name: "Треска", category: "Рыба", calories: 82, protein: 18, fat: 0.7, carbs: 0 },
  // Молочка
  { id: "milk", name: "Молоко 2.5%", category: "Молочное", calories: 52, protein: 2.8, fat: 2.5, carbs: 4.7 },
  { id: "cottage", name: "Творог 5%", category: "Молочное", calories: 121, protein: 17, fat: 5, carbs: 1.8 },
  { id: "yogurt", name: "Йогурт натуральный", category: "Молочное", calories: 60, protein: 4, fat: 1.5, carbs: 7 },
  { id: "cheese", name: "Сыр (твёрдый)", category: "Молочное", calories: 363, protein: 25, fat: 29, carbs: 0 },
  // Крупы
  { id: "rice", name: "Рис варёный", category: "Крупы", calories: 116, protein: 2.2, fat: 0.5, carbs: 25 },
  { id: "buckwheat", name: "Гречка варёная", category: "Крупы", calories: 110, protein: 4, fat: 1.1, carbs: 21 },
  { id: "oats", name: "Овсянка на воде", category: "Крупы", calories: 88, protein: 3, fat: 1.7, carbs: 15 },
  { id: "pasta", name: "Макароны варёные", category: "Крупы", calories: 131, protein: 5, fat: 1.1, carbs: 25 },
  { id: "bread", name: "Хлеб пшеничный", category: "Крупы", calories: 242, protein: 8, fat: 3.4, carbs: 48 },
  // Овощи
  { id: "potato", name: "Картофель варёный", category: "Овощи", calories: 82, protein: 2, fat: 0.4, carbs: 17 },
  { id: "tomato", name: "Помидор", category: "Овощи", calories: 20, protein: 1, fat: 0.2, carbs: 3.7 },
  { id: "cucumber", name: "Огурец", category: "Овощи", calories: 15, protein: 0.8, fat: 0.1, carbs: 2.8 },
  { id: "broccoli", name: "Брокколи", category: "Овощи", calories: 34, protein: 2.8, fat: 0.4, carbs: 7 },
  // Фрукты
  { id: "apple", name: "Яблоко", category: "Фрукты", calories: 52, protein: 0.3, fat: 0.2, carbs: 14 },
  { id: "banana", name: "Банан", category: "Фрукты", calories: 89, protein: 1.1, fat: 0.3, carbs: 23 },
  { id: "orange", name: "Апельсин", category: "Фрукты", calories: 47, protein: 0.9, fat: 0.1, carbs: 12 },
  // Орехи и масла
  { id: "almond", name: "Миндаль", category: "Орехи", calories: 579, protein: 21, fat: 50, carbs: 22 },
  { id: "peanut-butter", name: "Арахисовая паста", category: "Орехи", calories: 588, protein: 25, fat: 50, carbs: 20 },
  { id: "olive-oil", name: "Оливковое масло", category: "Масла", calories: 884, protein: 0, fat: 100, carbs: 0 },
  { id: "butter", name: "Масло сливочное", category: "Масла", calories: 717, protein: 0.9, fat: 81, carbs: 0.1 },
  // Яйца
  { id: "egg", name: "Яйцо куриное", category: "Яйца", calories: 155, protein: 13, fat: 11, carbs: 1.1 },
  // Бобовые
  { id: "lentils", name: "Чечевица варёная", category: "Бобовые", calories: 116, protein: 9, fat: 0.4, carbs: 20 },
  { id: "beans", name: "Фасоль варёная", category: "Бобовые", calories: 127, protein: 8.7, fat: 0.5, carbs: 23 },
  // Сладости
  { id: "sugar", name: "Сахар", category: "Сладости", calories: 387, protein: 0, fat: 0, carbs: 100 },
  { id: "chocolate", name: "Шоколад молочный", category: "Сладости", calories: 535, protein: 7.6, fat: 30, carbs: 59 },
  { id: "honey", name: "Мёд", category: "Сладости", calories: 304, protein: 0.3, fat: 0, carbs: 82 },
];
