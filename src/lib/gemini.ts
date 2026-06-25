import type { NutritionAnalyticsInput } from "./nutritionAnalytics";

export interface AISection {
  title: string;
  icon: string;
  content: string;
  type: "success" | "warning" | "danger" | "info";
}

export interface AIAnalyticsResult {
  score: number;
  scoreLabel: string;
  dailyVerdict: string;
  sections: AISection[];
  recommendations: string[];
}

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

function buildPrompt(input: NutritionAnalyticsInput): string {
  const activeDays = input.foodLogsByDay.filter(d => d.entries > 0);
  const last7 = activeDays.slice(-7);

  const daysSummary = last7.map(d =>
    `${d.date}:${d.calories}/${d.targetCalories ?? input.dailyTargetCalories} Б${Math.round(d.protein)} Ж${Math.round(d.fat)} У${Math.round(d.carbs)}`
  ).join("\n");

  const weightStr = input.weightHistory.length > 0
    ? input.weightHistory.slice(-5).map(w => `${w.date}:${w.weight}`).join(", ")
    : "нет";

  const avgDeficit = input.dailyDeficit.length > 0
    ? Math.round(input.dailyDeficit.reduce((s, d) => s + d, 0) / input.dailyDeficit.length)
    : 0;

  return `Нутрициолог-аналитик. Анализ данных пользователя (без учёта текущего дня).

Вес:${input.currentWeight}кг${input.targetWeight ? ` цель:${input.targetWeight}` : ""}
Трекинг:${input.trackedDays}д/30 серия:${input.streakDays}д деф:${avgDeficit}ккал/д
Норма: ${input.dailyTargetCalories}ккал Б${input.dailyTargetProtein} Ж${input.dailyTargetFat} У${input.dailyTargetCarbs}
Средние: ${Math.round(input.avgCalories)}ккал Б${Math.round(input.avgProtein)} Ж${Math.round(input.avgFat)} У${Math.round(input.avgCarbs)}

Последние 7 дней (факт/норма ккал, БЖУг):
${daysSummary || "нет"}

Вес: ${weightStr}

JSON ответ (без markdown):
{"score":0-100,"scoreLabel":"Отлично/Хорошо/Нормально/Требует внимания/Критично","dailyVerdict":"вывод по последним дням и совет 1-2 предл","sections":[{"title":"","icon":"эмодзи","content":"2-3 предл с цифрами","type":"success|warning|danger|info"}],"recommendations":["1","2","3"]}

4-6 секций, 3-4 рекомендации. Русский. Кратко. Реальные цифры из данных.`;
}

export async function analyzeWithGemini(input: NutritionAnalyticsInput): Promise<AIAnalyticsResult> {
  const prompt = buildPrompt(input);

  const response = await fetch(GEMINI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.7,
        maxOutputTokens: 1024,
      },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error("Empty response from Gemini");
  }

  const parsed: AIAnalyticsResult = JSON.parse(text);

  if (typeof parsed.score !== "number" || !Array.isArray(parsed.sections)) {
    throw new Error("Invalid response structure from Gemini");
  }

  parsed.score = Math.max(0, Math.min(100, Math.round(parsed.score)));

  return parsed;
}
