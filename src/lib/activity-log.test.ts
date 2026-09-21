import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { MAX_LOG_KCAL, MAX_LOG_STEPS, parseAmount, recentDates } from "./activity-log";

describe("the manual activity log stays out of the КБЖУ calculation", () => {
  // Everything that computes the norm, or recalculates it after a weight/activity save. Profile.tsx may only
  // render the card component; it must not read or write the log itself.
  const calculators = [
    "src/lib/nutrition.ts",
    "src/lib/storage.ts",
    "src/lib/cycle-engine.ts",
    "src/lib/nutritionAnalytics.ts",
    "src/pages/Index.tsx",
    "src/pages/Body.tsx",
    "src/pages/Profile.tsx",
  ];

  it.each(calculators)("%s does not touch the activityLog collection or its functions", (file) => {
    const code = readFileSync(resolve(process.cwd(), file), "utf8");
    expect(code).not.toMatch(/activityLog|ActivityLog(?!Card)/);
  });
});

describe("parseAmount", () => {
  it("treats empty or blank input as 'not entered'", () => {
    expect(parseAmount("", MAX_LOG_KCAL)).toEqual({ ok: true, value: null });
    expect(parseAmount("   ", MAX_LOG_KCAL)).toEqual({ ok: true, value: null });
  });

  it("accepts whole numbers, including zero", () => {
    expect(parseAmount("450", MAX_LOG_KCAL)).toEqual({ ok: true, value: 450 });
    expect(parseAmount("0", MAX_LOG_STEPS)).toEqual({ ok: true, value: 0 });
  });

  it("rounds decimals and accepts a decimal comma", () => {
    expect(parseAmount("450.6", MAX_LOG_KCAL)).toEqual({ ok: true, value: 451 });
    expect(parseAmount("450,4", MAX_LOG_KCAL)).toEqual({ ok: true, value: 450 });
  });

  it("rejects negatives, non-numbers and values above the ceiling", () => {
    expect(parseAmount("-1", MAX_LOG_KCAL)).toEqual({ ok: false });
    expect(parseAmount("abc", MAX_LOG_KCAL)).toEqual({ ok: false });
    expect(parseAmount("Infinity", MAX_LOG_KCAL)).toEqual({ ok: false });
    expect(parseAmount(String(MAX_LOG_STEPS + 1), MAX_LOG_STEPS)).toEqual({ ok: false });
    expect(parseAmount(String(MAX_LOG_STEPS), MAX_LOG_STEPS)).toEqual({ ok: true, value: MAX_LOG_STEPS });
  });
});

describe("recentDates", () => {
  it("lists days newest first, ending at today", () => {
    expect(recentDates(new Date(2026, 8, 19), 3)).toEqual(["2026-09-19", "2026-09-18", "2026-09-17"]);
  });

  it("crosses month and year boundaries", () => {
    expect(recentDates(new Date(2026, 0, 2), 4)).toEqual(["2026-01-02", "2026-01-01", "2025-12-31", "2025-12-30"]);
    expect(recentDates(new Date(2026, 2, 1), 2)).toEqual(["2026-03-01", "2026-02-28"]);
  });

  it("ignores the time of day", () => {
    expect(recentDates(new Date(2026, 8, 19, 23, 59), 2)).toEqual(["2026-09-19", "2026-09-18"]);
  });
});
