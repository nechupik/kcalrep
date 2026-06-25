import { describe, expect, it } from "vitest";
import {
  CYCLE_CALORIE_BOOST,
  getCycleCalorieAdjustmentForDate,
} from "./cycle-engine";
import type { CycleEntry } from "./metabolic-types";

const cycles: CycleEntry[] = [
  {
    id: "cycle-1",
    startDate: "2026-06-10",
    endDate: "2026-06-14",
    duration: 0,
    bleedingDays: 5,
    confirmed: true,
  },
];

describe("getCycleCalorieAdjustmentForDate", () => {
  it("adds 100 kcal two days before the recorded cycle starts", () => {
    const adjustment = getCycleCalorieAdjustmentForDate(cycles, "2026-06-08");

    expect(adjustment.active).toBe(true);
    expect(adjustment.calories).toBe(CYCLE_CALORIE_BOOST);
    expect(adjustment.carbs).toBe(25);
    expect(adjustment.source).toBe("recorded");
  });

  it("adds 100 kcal during recorded cycle days", () => {
    const adjustment = getCycleCalorieAdjustmentForDate(cycles, "2026-06-12");

    expect(adjustment.active).toBe(true);
    expect(adjustment.calories).toBe(CYCLE_CALORIE_BOOST);
  });

  it("removes the adjustment after the recorded cycle ends", () => {
    const adjustment = getCycleCalorieAdjustmentForDate(cycles, "2026-06-15");

    expect(adjustment.active).toBe(false);
    expect(adjustment.calories).toBe(0);
    expect(adjustment.carbs).toBe(0);
  });
});
