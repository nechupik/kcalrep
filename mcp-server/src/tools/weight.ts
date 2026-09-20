import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { MAX_LONG_RANGE_DAYS } from "../config.js";
import { dateField, dateInZone, resolveRange } from "../dates.js";
import { mdTable, renderJson, renderWithinLimit, responseFormatField, round, signed, TRUNCATION_HINT } from "../format.js";
import { registerReadTool, type ToolContext } from "../tool-kit.js";

const Input = z
  .object({
    start_date: dateField("First day, YYYY-MM-DD. Defaults to 89 days before end_date (a 90-day window).").optional(),
    end_date: dateField("Last day, YYYY-MM-DD. Defaults to today.").optional(),
    response_format: responseFormatField,
  })
  .strict();

export function registerWeightTool(server: McpServer, ctx: ToolContext): void {
  registerReadTool(
    server,
    {
      name: "kcalrep_get_weight_history",
      title: "Get weight and body composition history",
      description: `Weigh-ins (kg) and body-composition entries (body-fat %, lean/muscle mass, scale-reported BMR) for a date range, with the change between consecutive entries and over the whole period.
Read-only. Default window: last 90 days. Max range ${MAX_LONG_RANGE_DAYS} days. To see weight next to calories eaten, kcalrep_get_daily_summary also carries a weight column.

Args:
  - start_date, end_date (YYYY-MM-DD): inclusive range (default: 90 days ending today)
  - response_format ('markdown' | 'json')

Returns (json): { start, end, summary: { weighIns, first, last, change }, weights: [{ date, weight, change }], bodyComposition: [{ date, weight, bodyFatPercent, lbmKg, bmrFromScale }] }
'change' is the difference from the previous weigh-in in kg (null for the first). Several weigh-ins on one date are all listed.`,
      inputSchema: Input,
    },
    async (args) => {
      const today = dateInZone(ctx.now(), ctx.timeZone);
      const { start, end } = resolveRange(args, { defaultDays: 90, maxDays: MAX_LONG_RANGE_DAYS, today });
      const [weights, bodyComposition] = await Promise.all([
        ctx.db.getWeight(start, end),
        ctx.db.getBodyComposition(start, end),
      ]);

      const rows = weights.map((w, i) => ({
        date: w.date,
        weight: w.weight,
        change: i > 0 ? round(w.weight - weights[i - 1].weight, 1) : null,
      }));
      const first = weights[0]?.weight ?? null;
      const last = weights[weights.length - 1]?.weight ?? null;
      const summary = {
        weighIns: weights.length,
        first,
        last,
        change: first !== null && last !== null ? round(last - first, 1) : null,
      };

      const { text } = renderWithinLimit(rows, (shown, truncated) => {
        if (args.response_format === "json") {
          return renderJson({ start, end, summary, weights: shown, bodyComposition, ...(truncated ? { note: TRUNCATION_HINT } : {}) });
        }
        if (weights.length === 0 && bodyComposition.length === 0) {
          return `No weight or body-composition entries between ${start} and ${end}.`;
        }
        const lines = [`# Weight and body composition ${start} → ${end}`, ""];
        if (weights.length) {
          lines.push(`## Weigh-ins (${weights.length})`, "");
          lines.push(mdTable(["Date", "kg", "Δ vs previous"], shown.map((r) => [r.date, r.weight, signed(r.change, 1)])));
          lines.push("", `Overall: ${first} → ${last} kg (${signed(summary.change, 1)} kg)`);
        } else {
          lines.push("_No plain weigh-ins in this range._");
        }
        if (bodyComposition.length) {
          lines.push("", `## Body composition (${bodyComposition.length})`, "");
          lines.push(
            mdTable(
              ["Date", "kg", "Body fat %", "Lean mass kg", "Scale BMR kcal"],
              bodyComposition.map((b) => [b.date, b.weight, b.bodyFatPercent, b.lbmKg, b.bmrFromScale]),
            ),
          );
          const a = bodyComposition[0];
          const b = bodyComposition[bodyComposition.length - 1];
          if (a.bodyFatPercent !== null && b.bodyFatPercent !== null && bodyComposition.length > 1) {
            lines.push("", `Body fat change: ${signed(round(b.bodyFatPercent - a.bodyFatPercent, 1), 1)} pp`);
          }
          if (a.lbmKg !== null && b.lbmKg !== null && bodyComposition.length > 1) {
            lines.push(`Lean mass change: ${signed(round(b.lbmKg - a.lbmKg, 1), 1)} kg`);
          }
        }
        if (truncated) lines.push("", `_${TRUNCATION_HINT}_`);
        return lines.join("\n");
      });
      return text;
    },
  );
}
