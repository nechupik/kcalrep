import { describe, expect, it } from "vitest";
import { currentNorm, diary, manualHistory, manualNorm, normHistory, TZ, weights } from "./fixtures.js";
import { buildMarkdownReport, type ReportInput } from "./report.js";

const input = (over: Partial<ReportInput> = {}): ReportInput => ({
  start: "2026-09-16",
  end: "2026-09-19",
  generatedOn: "2026-09-19",
  timeZone: TZ,
  diary,
  weight: weights,
  activity: [{ date: "2026-09-17", type: "calories", value: 400, caloriesBurned: 400 }],
  activityLog: [
    { date: "2026-09-17", calories: 450, steps: 8200 },
    { date: "2026-09-18", calories: null, steps: 6100 },
  ],
  bodyComposition: [{ date: "2026-09-17", weight: 82.0, bodyFatPercent: 21.5, lbmKg: 64.4, bmrFromScale: 1750 }],
  normHistory,
  currentNorm,
  settings: { activityTrackingEnabled: true, deficitPercent: 15 },
  ...over,
});

const lines = (over: Partial<ReportInput> = {}) => buildMarkdownReport(input(over)).split("\n");

describe("buildMarkdownReport — mirrors the site's «Выгрузка данных»", () => {
  it("has the site's title, period, generation date and all seven sections, in order", () => {
    const text = buildMarkdownReport(input());
    expect(text.startsWith("# Отчёт по питанию и активности\n")).toBe(true);
    expect(text).toContain("**Период:** 16.09.2026 — 19.09.2026");
    expect(text).toContain("**Сформирован:** 19.09.2026");
    const headings = text.split("\n").filter((l) => l.startsWith("## "));
    expect(headings).toEqual([
      "## Текущие настройки профиля",
      "## 1. Периоды приёма пищи",
      "## 2. Приёмы пищи по дням",
      "## 3. Дневные итоги и дефицит",
      "## 4. Норма и настройки по дням",
      "## 5. Изменение веса и состава тела",
      "## 6. Активность и TDEE",
      "## 7. Активность и шаги (ручной ввод)",
    ]);
  });

  it("prints the current profile settings with the site's wording", () => {
    const l = lines();
    expect(l).toContain("- Пол: Мужской");
    expect(l).toContain("- Возраст: 30");
    expect(l).toContain("- Рост: 180 см");
    expect(l).toContain("- Цель: Снижение веса");
    expect(l).toContain("- Слайдер «Дефицит калорий» (текущее значение): 15%");
    expect(l).toContain("- Учёт активности (Apple Watch): Включён");
    expect(l).toContain("- Текущий BMR: 1700 ккал");
    expect(l).toContain("- Текущий TDEE: 2400 ккал");
    expect(l).toContain("- Текущий множитель цели: Дефицит 15%");
  });

  it("1. meal periods: first, last, window, count — and a dash row for an empty day", () => {
    const l = lines();
    expect(l).toContain("| 16.09.2026 | — | — | — | 0 |");
    expect(l).toContain("| 17.09.2026 | 09:00 | 19:30 | 10 ч 30 мин | 2 |");
    // A single meal has no window.
    expect(l).toContain("| 19.09.2026 | 08:00 | 08:00 | — | 1 |");
  });

  it("1. like the site, an entry added later for an earlier day keeps the time it was typed in", () => {
    // "Паста" belongs to the 18th but was entered at 08:00 on the 19th.
    expect(lines()).toContain("| 18.09.2026 | 08:00 | 08:00 | — | 1 |");
  });

  it("2. lists every meal with grams and one-decimal macros, escaping pipes in names", () => {
    const l = lines();
    expect(l).toContain("### 17.09.2026");
    expect(l).toContain("| Время | Продукт | Граммы | Ккал | Белки | Жиры | Углеводы |");
    expect(l).toContain("| 09:00 | Овсянка | 100 г | 500 | 10.0 | 5.0 | 20.0 |");
    expect(l).toContain("| 19:30 | Курица \\| гриль | 100 г | 1200 | 10.0 | 5.0 | 20.0 |");
    expect(l).toContain("_Нет записей_");
  });

  it("3. daily totals: eaten, target and TDEE of that day, signed deficits (empty days included)", () => {
    const l = lines();
    expect(l).toContain("| 16.09.2026 | 0 | 0.0 | 0.0 | 0.0 | 1900 | 2300 | +1900 | +2300 |");
    expect(l).toContain("| 17.09.2026 | 1700 | 20.0 | 10.0 | 40.0 | 1900 | 2300 | +200 | +600 |");
    // The 18th switches to the newer snapshot.
    expect(l).toContain("| 18.09.2026 | 1800 | 10.0 | 5.0 | 20.0 | 2000 | 2400 | +200 | +600 |");
    expect(l).toContain("_Положительное значение — калорийность ниже нормы/TDEE (дефицит), отрицательное — профицит._");
  });

  it("3. shows a surplus with a minus sign", () => {
    const l = lines({ diary: [{ ...diary[0], date: "2026-09-17", calories: 2600 }] });
    expect(l).toContain("| 17.09.2026 | 2600 | 10.0 | 5.0 | 20.0 | 1900 | 2300 | -700 | -300 |");
  });

  it("4. per-day norm with Russian labels and a two-decimal multiplier", () => {
    const l = lines();
    expect(l).toContain("| 17.09.2026 | 1690 | Лёгкая | 0.85 | Дефицит 15% | 125 | 58 | 200 |");
    expect(l).toContain("| 18.09.2026 | 1700 | Лёгкая | 0.85 | Дефицит 15% | 130 | 60 | 220 |");
  });

  it("5. weight table with changes and the period total, then body composition with its deltas", () => {
    const l = lines();
    expect(l).toContain("| 17.09.2026 | 82 | — |");
    expect(l).toContain("| 19.09.2026 | 81.6 | -0.4 |");
    expect(l).toContain("**Итого за период:** -0.4 кг (с 82 до 81.6 кг)");
    expect(l).toContain("| 17.09.2026 | 82 | 21.5 | 64.4 | 1750 |");
    // Site convention: zero change still gets a plus sign.
    expect(l).toContain("**Изменение % жира:** +0%");
    expect(l).toContain("**Изменение мышечной массы:** +0 кг");
  });

  it("5. says so when there is no weight or body-composition data", () => {
    const l = lines({ weight: [], bodyComposition: [] });
    expect(l).toContain("_Нет записей веса за период_");
    expect(l).toContain("_Нет данных состава тела (% жира, мышечная масса) за период_");
  });

  it("6. activity per day with the type label, TDEE, and the average over days with data", () => {
    const l = lines();
    expect(l).toContain("| 17.09.2026 | 400 | Apple Watch | 2300 |");
    expect(l).toContain("| 18.09.2026 | — | — | 2400 |");
    expect(l).toContain("**Средняя активность за период:** 400 ккал/день (1 дн. с данными)");
  });

  it("6. omits the average line when no day has activity", () => {
    // Section 7 has its own average line ("… за период (ручной ввод):"), so match section 6's exact wording.
    expect(buildMarkdownReport(input({ activity: [] }))).not.toContain("**Средняя активность за период:**");
  });

  it("7. hand-entered kcal and steps per day, with a dash for a value never entered, plus averages", () => {
    const l = lines();
    expect(l).toContain("| Дата | Активность, ккал | Шаги |");
    expect(l).toContain("| 16.09.2026 | — | — |");
    expect(l).toContain("| 17.09.2026 | 450 | 8200 |");
    expect(l).toContain("| 18.09.2026 | — | 6100 |");
    expect(l).toContain("**Средняя активность за период (ручной ввод):** 450 ккал/день (1 дн. с данными)");
    expect(l).toContain("**Средние шаги за период:** 7150 шагов/день (2 дн. с данными)");
  });

  it("7. keeps hand-entered activity apart from section 6 (Apple Watch), which is what feeds TDEE", () => {
    const text = buildMarkdownReport(input({ activity: [] }));
    const section6 = text.slice(text.indexOf("## 6."), text.indexOf("## 7."));
    expect(section6).not.toContain("450");
    expect(section6).not.toContain("8200");
    expect(text).toContain("В расчёт нормы и TDEE не входит");
  });

  it("7. still prints the table, without averages, when nothing was entered", () => {
    const text = buildMarkdownReport(input({ activityLog: [] }));
    expect(text).toContain("| 17.09.2026 | — | — |");
    expect(text).not.toContain("(ручной ввод):**");
    expect(text).not.toContain("Средние шаги");
  });

  it("falls back to the current norm for days before the first snapshot", () => {
    const l = lines({ normHistory: [], start: "2026-09-17", end: "2026-09-17" });
    expect(l).toContain("| 17.09.2026 | 1700 | 20.0 | 10.0 | 40.0 | 2000 | 2400 | +300 | +700 |");
  });

  it("shows dashes when there is no norm at all", () => {
    const text = buildMarkdownReport(input({ normHistory: [], currentNorm: null, settings: null }));
    expect(text).toContain("- Пол: —");
    expect(text).toContain("- Слайдер «Дефицит калорий» (текущее значение): —%");
    expect(text).toContain("| 17.09.2026 | 1700 | 20.0 | 10.0 | 40.0 | — | — | — | — |");
  });

  it("reports activity tracking as off only when explicitly disabled", () => {
    expect(buildMarkdownReport(input({ settings: { activityTrackingEnabled: false, deficitPercent: null } }))).toContain(
      "- Учёт активности (Apple Watch): Выключен",
    );
    expect(buildMarkdownReport(input({ settings: null }))).toContain("- Учёт активности (Apple Watch): Включён");
  });
});

describe("buildMarkdownReport — deliberate differences", () => {
  it("replaces section 2 with the given note but keeps every other section", () => {
    const text = buildMarkdownReport(input({ omitMealsReason: "Раздел пропущен." }));
    expect(text).toContain("## 2. Приёмы пищи по дням\n\n_Раздел пропущен._");
    expect(text).not.toContain("### 17.09.2026");
    expect(text).not.toContain("Овсянка");
    expect(text).toContain("## 3. Дневные итоги и дефицит");
  });

  it("adds a note under section 3 only when the norm was typed in manually", () => {
    const manual = buildMarkdownReport(input({ normHistory: manualHistory, currentNorm: manualNorm }));
    expect(manual).toContain("_Примечание: если норма введена вручную");
    // The figures themselves stay exactly as the site prints them.
    expect(manual).toContain("| 17.09.2026 | 1700 | 20.0 | 10.0 | 40.0 | 1850 | 1850 | +150 | +150 |");
    expect(manual).toContain("| 17.09.2026 | 1850 | Сидячий | 1.00 | Поддержание | 138 | 75 | 140 |");

    expect(buildMarkdownReport(input())).not.toContain("_Примечание");
  });

  it("shows a dash for an entry with no timestamp instead of inventing a time", () => {
    const text = buildMarkdownReport(input({ diary: [{ ...diary[0], date: "2026-09-17", addedAt: null }] }));
    expect(text).toContain("| — | Овсянка | 100 г | 500 |");
    expect(text).toContain("| 17.09.2026 | — | — | — | 1 |");
  });
});
