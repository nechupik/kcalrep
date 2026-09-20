import { describe, expect, it } from "vitest";
import { addDays, dateInZone, daysInclusive, eachDate, isValidDate, resolveRange, timeInZone, ToolInputError } from "./dates.js";

describe("isValidDate", () => {
  it("accepts real calendar dates", () => {
    expect(isValidDate("2026-09-19")).toBe(true);
    expect(isValidDate("2024-02-29")).toBe(true);
  });
  it("rejects malformed and impossible dates", () => {
    expect(isValidDate("2026-9-19")).toBe(false);
    expect(isValidDate("2026-02-30")).toBe(false);
    expect(isValidDate("2025-02-29")).toBe(false);
    expect(isValidDate("2026-13-01")).toBe(false);
  });
});

describe("date math", () => {
  it("adds days across month and year boundaries", () => {
    expect(addDays("2026-09-30", 1)).toBe("2026-10-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
  });
  it("counts inclusive days", () => {
    expect(daysInclusive("2026-09-19", "2026-09-19")).toBe(1);
    expect(daysInclusive("2026-09-13", "2026-09-19")).toBe(7);
  });
  it("lists every date in a range", () => {
    expect(eachDate("2026-09-29", "2026-10-02")).toEqual(["2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02"]);
  });
});

describe("time zones", () => {
  // 2026-09-18T22:30Z is already the 19th in Moscow (UTC+3) but still the 18th in UTC.
  const instant = new Date("2026-09-18T22:30:00Z");
  it("resolves the calendar date in the given zone", () => {
    expect(dateInZone(instant, "Europe/Moscow")).toBe("2026-09-19");
    expect(dateInZone(instant, "UTC")).toBe("2026-09-18");
  });
  it("renders wall-clock time, with midnight as 00:xx", () => {
    expect(timeInZone(instant, "Europe/Moscow")).toBe("01:30");
    expect(timeInZone(new Date("2026-09-18T21:05:00Z"), "Europe/Moscow")).toBe("00:05");
  });
});

describe("resolveRange", () => {
  const today = "2026-09-19";
  const opts = { defaultDays: 7, maxDays: 92, today };

  it("defaults to a window ending today", () => {
    expect(resolveRange({}, opts)).toEqual({ start: "2026-09-13", end: "2026-09-19" });
  });
  it("uses a single day when defaultDays is 1", () => {
    expect(resolveRange({}, { ...opts, defaultDays: 1 })).toEqual({ start: today, end: today });
  });
  it("honours explicit bounds", () => {
    expect(resolveRange({ start_date: "2026-09-01", end_date: "2026-09-05" }, opts)).toEqual({
      start: "2026-09-01",
      end: "2026-09-05",
    });
  });
  it("rejects reversed, impossible and oversized ranges with actionable messages", () => {
    expect(() => resolveRange({ start_date: "2026-09-10", end_date: "2026-09-01" }, opts)).toThrow(ToolInputError);
    expect(() => resolveRange({ start_date: "2026-02-30" }, opts)).toThrow(/not a real calendar date/);
    expect(() => resolveRange({ start_date: "2026-01-01", end_date: "2026-09-19" }, opts)).toThrow(/maximum is 92/);
  });
});
