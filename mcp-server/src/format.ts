import { z } from "zod";
import { CHARACTER_LIMIT } from "./config.js";

export type ResponseFormat = "markdown" | "json";

export const responseFormatField = z
  .enum(["markdown", "json"])
  .default("markdown")
  .describe("'markdown' (default) for a compact readable table, 'json' for exact machine-readable data");

/** A markdown table cell: null/undefined become an em dash, pipes and newlines can't break the row. */
export function cell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  return String(value).replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

export function mdTable(headers: string[], rows: Array<Array<string | number | boolean | null | undefined>>): string {
  const lines = [`| ${headers.join(" | ")} |`, `|${headers.map(() => "---").join("|")}|`];
  for (const row of rows) lines.push(`| ${row.map(cell).join(" | ")} |`);
  return lines.join("\n");
}

/** Round to a fixed number of decimals, returning a number (so JSON output stays numeric). */
export function round(value: number, digits = 0): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

/** "+120" / "-45" / "0" — for deficits and weight deltas where the sign matters. */
export function signed(value: number | null, digits = 0): string {
  if (value === null) return "—";
  const r = round(value, digits);
  return r > 0 ? `+${r}` : String(r);
}

/** Pagination metadata for `shown` items starting at `offset` out of `total`. */
export function pageMeta(total: number, offset: number, shown: number) {
  const next = offset + shown;
  const hasMore = next < total;
  return { total, count: shown, offset, hasMore, ...(hasMore ? { nextOffset: next } : {}) };
}

export function renderJson(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

/**
 * Render `items` with `render`, halving the list until the text fits CHARACTER_LIMIT.
 * `render` gets the items that fit and whether some were dropped, so it can say so.
 * Works for JSON too (a cut string would be invalid JSON; a shorter list never is).
 */
export function renderWithinLimit<T>(
  items: T[],
  render: (shown: T[], truncated: boolean) => string,
): { text: string; shown: number } {
  let shown = items;
  let text = render(shown, false);
  while (text.length > CHARACTER_LIMIT && shown.length > 1) {
    shown = shown.slice(0, Math.max(1, Math.floor(shown.length / 2)));
    text = render(shown, true);
  }
  return { text, shown: shown.length };
}

export const TRUNCATION_HINT =
  "Output was cut to fit the size limit. Narrow the date range, lower `limit`, or page with `offset` to see the rest.";
