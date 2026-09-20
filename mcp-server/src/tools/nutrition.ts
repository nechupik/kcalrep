import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { buildDailySummary, type DaySummary, type PeriodSummary } from "../aggregate.js";
import { MAX_RANGE_DAYS } from "../config.js";
import { dateField, dateInZone, isValidDate, resolveRange, timeInZone, ToolInputError } from "../dates.js";
import {
  mdTable,
  pageMeta,
  renderJson,
  renderWithinLimit,
  responseFormatField,
  round,
  signed,
  TRUNCATION_HINT,
} from "../format.js";
import { registerReadTool, type ToolContext } from "../tool-kit.js";

const todayOf = (ctx: ToolContext) => dateInZone(ctx.now(), ctx.timeZone);
const rangeLabel = (start: string, end: string) => (start === end ? start : `${start} → ${end}`);

// ---------------------------------------------------------------------------
// kcalrep_get_diary
// ---------------------------------------------------------------------------

const DiaryInput = z
  .object({
    start_date: dateField("First day, YYYY-MM-DD. Defaults to end_date, i.e. a single day.").optional(),
    end_date: dateField("Last day, YYYY-MM-DD. Defaults to today.").optional(),
    limit: z.number().int().min(1).max(500).default(150).describe("Max entries to return (1-500, default 150)"),
    offset: z.number().int().min(0).default(0).describe("Entries to skip, for paging (default 0)"),
    response_format: responseFormatField,
  })
  .strict();

interface DiaryRow {
  date: string;
  /** HH:mm the entry was logged, in the user's time zone. */
  time: string | null;
  /** True when it was logged on a different calendar day than its diary date (backdated). */
  loggedOnOtherDay: boolean;
  name: string;
  grams: number;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}

// ---------------------------------------------------------------------------
// kcalrep_get_daily_summary
// ---------------------------------------------------------------------------

const SummaryInput = z
  .object({
    start_date: dateField("First day, YYYY-MM-DD. Defaults to 6 days before end_date (a 7-day window).").optional(),
    end_date: dateField("Last day, YYYY-MM-DD. Defaults to today; dates after today are clamped to today.").optional(),
    response_format: responseFormatField,
  })
  .strict();

function activityLabel(type: string): string {
  if (type === "calories") return "Apple Watch";
  if (type === "steps") return "steps";
  if (type === "home") return "home";
  return type;
}

function summaryMarkdown(
  start: string,
  end: string,
  days: DaySummary[],
  period: PeriodSummary,
  truncated: boolean,
): string {
  const rows = days.map((d) => {
    const label = d.partial ? `${d.date} (today, partial)` : d.date;
    const burned = d.activity ? `${d.activity.caloriesBurned} (${activityLabel(d.activity.type)})` : null;
    if (!d.logged) return [label, "not logged", null, null, null, null, null, null, null, null, null, burned, d.weight];
    const target = d.targets ? `${d.targets.calories}${d.targets.source === "current" ? "~" : ""}` : null;
    return [
      label,
      d.calories,
      d.protein,
      d.fat,
      d.carbs,
      d.meals,
      d.firstMeal && d.lastMeal ? `${d.firstMeal}–${d.lastMeal}` : null,
      target,
      d.targets?.tdee,
      signed(d.deficitVsTarget),
      signed(d.deficitVsTdee),
      burned,
      d.weight,
    ];
  });

  const manualTargets = days.some((d) => d.targets !== null && d.targets.tdee === null);
  const lines = [
    `# Daily summary ${rangeLabel(start, end)}`,
    "",
    "Δ columns: positive = ate LESS than the target/TDEE (deficit), negative = surplus. `~` = no dated norm existed for that day, today's norm used as an estimate. Targets are base norms without cycle-phase adjustments.",
    ...(manualTargets
      ? ["TDEE and Δ TDEE are blank where the targets were typed in manually: the app then stores no real TDEE, only the calorie target."]
      : []),
    "",
    mdTable(
      ["Date", "kcal", "P g", "F g", "C g", "Meals", "First–last", "Target", "TDEE", "Δ target", "Δ TDEE", "Burned", "Weight kg"],
      rows,
    ),
    "",
    `## Period (${period.loggedDays} of ${period.days} days logged; averages use completed logged days only)`,
    "",
  ];
  if (period.avgCalories === null) {
    lines.push("- No completed logged days in this range.");
  } else {
    lines.push(`- Average: ${period.avgCalories} kcal · P ${period.avgProtein} · F ${period.avgFat} · C ${period.avgCarbs} g`);
    const vsTdee = period.avgDeficitVsTdee === null ? "" : ` · vs TDEE: ${signed(period.avgDeficitVsTdee)} kcal`;
    lines.push(`- Average deficit vs target: ${signed(period.avgDeficitVsTarget)} kcal${vsTdee}`);
  }
  if (period.weightChange !== null) {
    lines.push(`- Weight: ${period.weightFirst} → ${period.weightLast} kg (${signed(period.weightChange, 1)} kg)`);
  }
  if (truncated) lines.push("", `_${TRUNCATION_HINT}_`);
  return lines.join("\n");
}

export function registerNutritionTools(server: McpServer, ctx: ToolContext): void {
  registerReadTool(
    server,
    {
      name: "kcalrep_get_diary",
      title: "Get food diary entries",
      description: `List individual food-diary entries (what was eaten, when, how much, and its calories/macros) for a date range. Also returns the calorie/macro totals of the whole range.
Read-only. Defaults to today. Max range ${MAX_RANGE_DAYS} days. For per-day totals compared with targets use kcalrep_get_daily_summary instead — it is much more compact.

Args:
  - start_date, end_date (YYYY-MM-DD): inclusive range (default: today only)
  - limit (1-500, default 150), offset (default 0): paging over entries
  - response_format ('markdown' | 'json')

Returns (json): { start, end, total, count, offset, hasMore, nextOffset?, totals: { calories, protein, fat, carbs }, entries: [{ date, time, loggedOnOtherDay, name, grams, calories, protein, fat, carbs }] }
'time' is when the entry was typed into the app; if loggedOnOtherDay is true (backdated entry) it is NOT when the food was eaten.`,
      inputSchema: DiaryInput,
    },
    async (args) => {
      const { start, end } = resolveRange(args, { defaultDays: 1, maxDays: MAX_RANGE_DAYS, today: todayOf(ctx) });
      const all = await ctx.db.getDiary(start, end);

      const totals = {
        calories: round(all.reduce((s, e) => s + e.calories, 0)),
        protein: round(all.reduce((s, e) => s + e.protein, 0), 1),
        fat: round(all.reduce((s, e) => s + e.fat, 0), 1),
        carbs: round(all.reduce((s, e) => s + e.carbs, 0), 1),
      };
      const page: DiaryRow[] = all.slice(args.offset, args.offset + args.limit).map((e) => ({
        date: e.date,
        time: e.addedAt !== null ? timeInZone(e.addedAt, ctx.timeZone) : null,
        loggedOnOtherDay: e.addedAt !== null && dateInZone(e.addedAt, ctx.timeZone) !== e.date,
        name: e.name,
        grams: round(e.grams, 1),
        calories: round(e.calories),
        protein: round(e.protein, 1),
        fat: round(e.fat, 1),
        carbs: round(e.carbs, 1),
      }));

      const { text } = renderWithinLimit(page, (shown, truncated) => {
        const meta = pageMeta(all.length, args.offset, shown.length);
        if (args.response_format === "json") {
          return renderJson({ start, end, ...meta, totals, entries: shown, ...(truncated ? { note: TRUNCATION_HINT } : {}) });
        }
        if (all.length === 0) return `No diary entries between ${start} and ${end}.`;
        if (shown.length === 0) return `No entries at offset ${args.offset}: the range only has ${all.length}.`;

        const lines = [
          `# Food diary ${rangeLabel(start, end)}`,
          "",
          `${all.length} entries · totals for the whole range: ${totals.calories} kcal · P ${totals.protein} · F ${totals.fat} · C ${totals.carbs} g`,
          `Showing ${args.offset + 1}–${args.offset + shown.length}.`,
          "",
          mdTable(
            ["Date", "Time", "Food", "g", "kcal", "P", "F", "C"],
            shown.map((r) => [r.date, r.time ? `${r.time}${r.loggedOnOtherDay ? "*" : ""}` : null, r.name, r.grams, r.calories, r.protein, r.fat, r.carbs]),
          ),
        ];
        if (shown.some((r) => r.loggedOnOtherDay)) {
          lines.push("", "\\* logged on a different day than its diary date (backdated): the time is when it was typed in, not when it was eaten.");
        }
        if (meta.hasMore) lines.push("", `_More entries available — call again with offset=${meta.nextOffset}._`);
        if (truncated) lines.push("", `_${TRUNCATION_HINT}_`);
        return lines.join("\n");
      });
      return text;
    },
  );

  registerReadTool(
    server,
    {
      name: "kcalrep_get_daily_summary",
      title: "Get daily nutrition summary",
      description: `Per-day overview for a date range — the best starting point for questions like "how did I eat this week?". For every day: calories and macros eaten, number of meals, first/last meal time and eating window, the calorie/macro targets and TDEE that applied that day, deficit versus target and versus TDEE, calories burned (Apple Watch / steps), and weight. Plus period averages.
Read-only. Default window: last 7 days. Max range ${MAX_RANGE_DAYS} days. Individual foods are not listed — use kcalrep_get_diary for those.

Args:
  - start_date, end_date (YYYY-MM-DD): inclusive range (default: 7 days ending today; end is clamped to today)
  - response_format ('markdown' | 'json')

Returns (json): { start, end, period: { days, loggedDays, avgCalories, avgProtein, avgFat, avgCarbs, avgDeficitVsTarget, avgDeficitVsTdee, weightFirst, weightLast, weightChange }, days: [{ date, logged, partial, meals, calories, protein, fat, carbs, firstMeal, lastMeal, eatingWindowMinutes, targets: { calories, protein, fat, carbs, bmr, tdee, source } | null, deficitVsTarget, deficitVsTdee, activity: { type, value, caloriesBurned } | null, weight }] }
Sign convention: deficit > 0 means the user ate LESS than the target/TDEE; < 0 is a surplus. Days without diary entries are 'logged: false' and are NOT counted as zero intake. The current day is 'partial: true' and excluded from averages. First/last meal times only use entries logged on their own day. Targets exclude cycle-phase adjustments. targets.bmr/tdee and deficitVsTdee are null on days whose targets were typed in manually, because the app then stores no real TDEE.
For the exact document the website exports (with every meal listed) use kcalrep_get_report; this tool is the compact, structured alternative for longer periods.`,
      inputSchema: SummaryInput,
    },
    async (args) => {
      const today = todayOf(ctx);
      if (args.start_date && isValidDate(args.start_date) && args.start_date > today) {
        throw new ToolInputError(`start_date ${args.start_date} is in the future (today is ${today}). Use dates up to ${today}.`);
      }
      // Clamp a future end date first, so "September to December" is judged as September to today.
      const endDate = args.end_date && isValidDate(args.end_date) && args.end_date > today ? today : args.end_date;
      const { start, end } = resolveRange(
        { start_date: args.start_date, end_date: endDate },
        { defaultDays: 7, maxDays: MAX_RANGE_DAYS, today },
      );

      const [diary, normHistory, currentNorm, activity, weight] = await Promise.all([
        ctx.db.getDiary(start, end),
        ctx.db.getNormHistory(start, end),
        ctx.db.getNorm(),
        ctx.db.getActivity(start, end),
        ctx.db.getWeight(start, end),
      ]);

      const { days, period } = buildDailySummary({
        start,
        end,
        today,
        timeZone: ctx.timeZone,
        diary,
        normHistory,
        currentNorm,
        activity,
        weight,
      });

      const { text } = renderWithinLimit(days, (shown, truncated) =>
        args.response_format === "json"
          ? renderJson({ start, end, period, days: shown, ...(truncated ? { note: TRUNCATION_HINT } : {}) })
          : summaryMarkdown(start, end, shown, period, truncated),
      );
      return text;
    },
  );
}
