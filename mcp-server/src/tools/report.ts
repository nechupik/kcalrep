import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { CHARACTER_LIMIT, MAX_REPORT_DAYS } from "../config.js";
import { dateField, dateInZone, resolveRange } from "../dates.js";
import { buildMarkdownReport } from "../report.js";
import { registerReadTool, type ToolContext } from "../tool-kit.js";

const Input = z
  .object({
    start_date: dateField("First day, YYYY-MM-DD. Defaults to 6 days before end_date (a 7-day window).").optional(),
    end_date: dateField("Last day, YYYY-MM-DD. Defaults to today.").optional(),
    include_meals: z
      .boolean()
      .default(true)
      .describe("Include section 2 — every meal of every day (the longest part). Set false for a compact report."),
  })
  .strict();

export function registerReportTool(server: McpServer, ctx: ToolContext): void {
  registerReadTool(
    server,
    {
      name: "kcalrep_get_report",
      title: "Get nutrition and activity report",
      description: `The same Markdown report the kcalrep website downloads under Профиль → «Выгрузка данных», for a date range. In Russian, six sections plus the current profile settings:
  1. meal periods per day (first meal, last meal, eating window, number of meals)
  2. every meal of every day (time, product, grams, kcal, protein, fat, carbs)
  3. daily totals and the deficit versus the target and versus TDEE
  4. the norm and settings that applied each day (BMR, activity level, goal multiplier, protein/fat/carb targets)
  5. weight change and body composition (body fat %, lean mass)
  6. activity (Apple Watch kcal / steps) and TDEE per day
Read-only. USE THIS FIRST for any question about eating, deficit, weight or activity over a period — it is what the user would otherwise export and paste by hand.

Args:
  - start_date, end_date (YYYY-MM-DD): inclusive range (default: the last 7 days ending today; max ${MAX_REPORT_DAYS} days — for longer periods use kcalrep_get_daily_summary, up to 92 days)
  - include_meals (boolean, default true): set false to skip section 2 for a shorter report. If the full report would exceed the output limit, section 2 is left out automatically and a note says so; kcalrep_get_diary then gives the individual meals.

Returns: the report as Markdown text.
Reading it: a positive deficit means the user ate LESS than the target/TDEE, negative means a surplus. Meal times are when each entry was typed into the app (a meal added later for an earlier day shows the time it was entered). A day with no entries still gets a row in section 3, with 0 kcal eaten. Today's row is incomplete until the day ends. When the norm was typed in manually, TDEE simply equals the norm (a note says so).`,
      inputSchema: Input,
    },
    async (args) => {
      const today = dateInZone(ctx.now(), ctx.timeZone);
      const { start, end } = resolveRange(args, { defaultDays: 7, maxDays: MAX_REPORT_DAYS, today });

      const [diary, weight, activity, bodyComposition, normHistory, currentNorm, settings] = await Promise.all([
        ctx.db.getDiary(start, end),
        ctx.db.getWeight(start, end),
        ctx.db.getActivity(start, end),
        ctx.db.getBodyComposition(start, end),
        ctx.db.getNormHistory(start, end),
        ctx.db.getNorm(),
        ctx.db.getSettings(),
      ]);

      const build = (omitMealsReason?: string) =>
        buildMarkdownReport({
          start,
          end,
          generatedOn: today,
          timeZone: ctx.timeZone,
          diary,
          weight,
          activity,
          bodyComposition,
          normHistory,
          currentNorm,
          settings,
          omitMealsReason,
        });

      if (!args.include_meals) {
        return build("Раздел пропущен (include_meals=false). Отдельные приёмы пищи: инструмент kcalrep_get_diary.");
      }
      const full = build();
      if (full.length <= CHARACTER_LIMIT) return full;

      const compact = build(
        "Раздел пропущен: полный отчёт не помещается в лимит вывода. Отдельные приёмы пищи за нужные дни: инструмент kcalrep_get_diary.",
      );
      return compact.length <= CHARACTER_LIMIT
        ? compact
        : `${compact.slice(0, CHARACTER_LIMIT)}\n\n_Отчёт обрезан по лимиту вывода. Возьмите период короче._`;
    },
  );
}
