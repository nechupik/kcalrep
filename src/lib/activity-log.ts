// Pure helpers for the manual activity log (Профиль → «Активность и шаги»). No Firebase imports.
import { toDateStr } from "./utils";

/** Sanity ceilings that catch a typo (an extra zero), not real limits. */
export const MAX_LOG_KCAL = 15000;
export const MAX_LOG_STEPS = 100000;

export type AmountParse = { ok: true; value: number | null } | { ok: false };

/** Empty input means "not entered" (null). Anything else must be a number in [0, max]; it is rounded to whole units. */
export function parseAmount(raw: string, max: number): AmountParse {
  const text = raw.trim().replace(",", ".");
  if (text === "") return { ok: true, value: null };
  const n = Number(text);
  if (!Number.isFinite(n) || n < 0 || n > max) return { ok: false };
  return { ok: true, value: Math.round(n) };
}

/** `count` calendar dates (YYYY-MM-DD) ending at `today`, newest first. */
export function recentDates(today: Date, count: number): string[] {
  return Array.from({ length: count }, (_, i) =>
    toDateStr(new Date(today.getFullYear(), today.getMonth(), today.getDate() - i))
  );
}
