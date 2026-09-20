import { describe, expect, it } from "vitest";
import { buildDailySummary, targetsForDay } from "./aggregate.js";
import { currentNorm, diary, manualHistory, manualNorm, normHistory, TODAY, TZ } from "./fixtures.js";

describe("targetsForDay", () => {
  it("uses the latest snapshot dated on or before the day", () => {
    expect(targetsForDay("2026-09-10", normHistory, currentNorm)).toMatchObject({ calories: 1900, source: "history" });
    expect(targetsForDay("2026-09-17", normHistory, currentNorm)).toMatchObject({ calories: 1900, source: "history" });
    expect(targetsForDay("2026-09-18", normHistory, currentNorm)).toMatchObject({ calories: 2000, source: "history" });
  });
  it("falls back to the current norm, flagged, when the day predates all snapshots", () => {
    expect(targetsForDay("2026-09-01", normHistory, currentNorm)).toMatchObject({ calories: 2000, source: "current" });
  });
  it("returns null when there is nothing to go on", () => {
    expect(targetsForDay("2026-09-01", [], null)).toBeNull();
  });
});

describe("buildDailySummary", () => {
  const run = (over: Partial<Parameters<typeof buildDailySummary>[0]> = {}) =>
    buildDailySummary({
      start: "2026-09-16",
      end: TODAY,
      today: TODAY,
      timeZone: TZ,
      diary,
      normHistory,
      currentNorm,
      activity: [{ date: "2026-09-17", type: "calories", value: 400, caloriesBurned: 400 }],
      weight: [
        { date: "2026-09-17", weight: 82.0, createdAt: 1 },
        { date: "2026-09-19", weight: 81.6, createdAt: 2 },
      ],
      ...over,
    });

  it("emits one row per day, including days with no entries", () => {
    const { days } = run();
    expect(days.map((d) => d.date)).toEqual(["2026-09-16", "2026-09-17", "2026-09-18", "2026-09-19"]);
    expect(days[0]).toMatchObject({ logged: false, meals: 0, calories: 0, deficitVsTarget: null, deficitVsTdee: null });
  });

  it("totals a day and computes deficits against the snapshot in force (positive = ate less)", () => {
    const d17 = run().days[1];
    expect(d17).toMatchObject({ meals: 2, calories: 1700, protein: 20, firstMeal: "09:00", lastMeal: "19:30" });
    expect(d17.eatingWindowMinutes).toBe(630);
    expect(d17.targets).toMatchObject({ calories: 1900, tdee: 2300, source: "history" });
    expect(d17.deficitVsTarget).toBe(200);
    expect(d17.deficitVsTdee).toBe(600);
    expect(d17.activity).toEqual({ type: "calories", value: 400, caloriesBurned: 400 });
    expect(d17.weight).toBe(82.0);
  });

  it("reports a surplus as a negative deficit", () => {
    const d = run({ diary: [{ ...diary[0], date: "2026-09-17", calories: 2600 }] }).days[1];
    expect(d.deficitVsTarget).toBe(-700);
  });

  it("counts a backdated entry in the totals but not in the meal timing", () => {
    const d18 = run().days[2];
    expect(d18.calories).toBe(1800);
    expect(d18.meals).toBe(1);
    expect(d18.firstMeal).toBeNull();
    expect(d18.lastMeal).toBeNull();
    expect(d18.eatingWindowMinutes).toBeNull();
  });

  it("flags today as partial and leaves it out of the averages", () => {
    const { days, period } = run();
    expect(days[3].partial).toBe(true);
    expect(days[3].logged).toBe(true);
    // Only the 17th (1700) and the 18th (1800) count.
    expect(period.avgCalories).toBe(1750);
    expect(period.avgDeficitVsTarget).toBe(200); // 17th: 1900-1700, 18th: 2000-1800
    expect(period.loggedDays).toBe(3);
    expect(period.days).toBe(4);
  });

  it("does not treat unlogged days as zero intake in the averages", () => {
    // 16th has nothing logged; if it counted as 0 the average would be far lower.
    expect(run().period.avgCalories).toBe(1750);
  });

  it("summarises the weight trend across the period", () => {
    expect(run().period).toMatchObject({ weightFirst: 82.0, weightLast: 81.6, weightChange: -0.4 });
  });

  it("uses the last weigh-in when a day has several", () => {
    const { days } = run({
      weight: [
        { date: "2026-09-17", weight: 82.4, createdAt: 1 },
        { date: "2026-09-17", weight: 82.0, createdAt: 2 },
      ],
    });
    expect(days[1].weight).toBe(82.0);
  });

  it("leaves BMR/TDEE and the deficit against TDEE blank when the targets were typed in manually", () => {
    const { days, period } = run({ normHistory: manualHistory, currentNorm: manualNorm });
    expect(days[1].targets).toMatchObject({ calories: 1850, bmr: null, tdee: null });
    expect(days[1].deficitVsTarget).toBe(150);
    expect(days[1].deficitVsTdee).toBeNull();
    expect(period.avgDeficitVsTarget).toBe(100); // 17th: 1850-1700, 18th: 1850-1800
    expect(period.avgDeficitVsTdee).toBeNull();
  });

  it("has null averages and no weight change when nothing was logged", () => {
    const { period } = run({ diary: [], weight: [] });
    expect(period.avgCalories).toBeNull();
    expect(period.weightChange).toBeNull();
  });
});
