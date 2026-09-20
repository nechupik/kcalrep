import { z } from "zod";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 86_400_000;

/** Thrown for bad tool input; the message is shown to the model verbatim, so make it actionable. */
export class ToolInputError extends Error {}

export function isValidDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** Zod field for a YYYY-MM-DD date argument. */
export const dateField = (description: string) =>
  z
    .string()
    .regex(DATE_RE, "Use YYYY-MM-DD, e.g. 2026-09-19")
    .describe(description);

function toUtcMs(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

export function addDays(date: string, days: number): string {
  return new Date(toUtcMs(date) + days * MS_PER_DAY).toISOString().slice(0, 10);
}

/** Number of calendar days in [start, end], inclusive. */
export function daysInclusive(start: string, end: string): number {
  return Math.round((toUtcMs(end) - toUtcMs(start)) / MS_PER_DAY) + 1;
}

export function eachDate(start: string, end: string): string[] {
  const out: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Calendar date (YYYY-MM-DD) of an instant in the given IANA time zone. */
export function dateInZone(instant: Date | number, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Wall-clock HH:mm of an instant in the given IANA time zone. */
export function timeInZone(instant: Date | number, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(instant);
}

export interface RangeOptions {
  /** Used when start_date is omitted: the range covers this many days ending at end_date. */
  defaultDays: number;
  maxDays: number;
  today: string;
}

/** Resolve optional start/end args into a validated inclusive range. */
export function resolveRange(
  args: { start_date?: string; end_date?: string },
  { defaultDays, maxDays, today }: RangeOptions,
): { start: string; end: string } {
  const end = args.end_date ?? today;
  const start = args.start_date ?? addDays(end, -(defaultDays - 1));

  for (const [label, value] of [["start_date", start], ["end_date", end]] as const) {
    if (!isValidDate(value)) {
      throw new ToolInputError(`${label} "${value}" is not a real calendar date. Use YYYY-MM-DD, e.g. ${today}.`);
    }
  }
  if (start > end) {
    throw new ToolInputError(`start_date (${start}) is after end_date (${end}). Swap them.`);
  }
  const days = daysInclusive(start, end);
  if (days > maxDays) {
    throw new ToolInputError(
      `Range is ${days} days but the maximum is ${maxDays}. Split it into several calls of at most ${maxDays} days each.`,
    );
  }
  return { start, end };
}
