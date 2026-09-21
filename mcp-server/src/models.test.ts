import { describe, expect, it } from "vitest";
import { toActivityLog, toDiaryEntry, toMillis, toNorm, toNormSnapshot, toUserProfile } from "./models.js";

describe("toMillis", () => {
  it("reads Firestore Timestamps, plain numbers, and rejects everything else", () => {
    expect(toMillis({ toMillis: () => 1234 })).toBe(1234);
    expect(toMillis(5678)).toBe(5678);
    expect(toMillis("2026-09-19")).toBeNull();
    expect(toMillis(undefined)).toBeNull();
    expect(toMillis(Number.NaN)).toBeNull();
  });
});

describe("energy placeholders (manual norms)", () => {
  const auto = { calories: 1850, bmr: 1700, tdee: 2176, activityLabel: "light", goalMultiplier: 0.85, mode: "auto" };

  it("treats a computed norm as a real estimate", () => {
    expect(toNorm(auto).energyEstimated).toBe(true);
    expect(toNormSnapshot(auto).energyEstimated).toBe(true);
  });

  it("flags mode: manual regardless of the numbers", () => {
    expect(toNorm({ ...auto, mode: "manual" }).energyEstimated).toBe(false);
  });

  it("recognises the bmr = tdee = calories signature, even where no mode is stored (snapshots)", () => {
    const manual = { calories: 1850, bmr: 1850, tdee: 1850, activityLabel: "sedentary", goalMultiplier: 1 };
    expect(toNormSnapshot(manual).energyEstimated).toBe(false);
    expect(toNorm(manual).energyEstimated).toBe(false);
  });

  it("does not mistake an empty document for a manual one", () => {
    expect(toNormSnapshot({}).energyEstimated).toBe(true);
  });
});

describe("defensive mapping", () => {
  it("fills missing diary fields instead of throwing", () => {
    expect(toDiaryEntry("x", {})).toMatchObject({ id: "x", date: "", addedAt: null, name: "(unnamed)", calories: 0 });
  });

  it("keeps a hand-entered value that was never given as null, not 0 (the site stores only what was typed)", () => {
    expect(toActivityLog({ date: "2026-09-17", steps: 8200, updatedAt: {} })).toEqual({ date: "2026-09-17", calories: null, steps: 8200 });
    expect(toActivityLog({ date: "2026-09-17", calories: 0, steps: 0 })).toEqual({ date: "2026-09-17", calories: 0, steps: 0 });
    expect(toActivityLog({})).toEqual({ date: "", calories: null, steps: null });
  });

  it("never carries the e-mail address through", () => {
    expect(toUserProfile({ name: "lovi", email: "secret@example.com" })).toEqual({ name: "lovi" });
  });
});
