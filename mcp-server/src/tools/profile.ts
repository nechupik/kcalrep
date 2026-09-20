import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Norm } from "../models.js";
import { renderJson, responseFormatField } from "../format.js";
import { registerReadTool, type ToolContext } from "../tool-kit.js";

const InputSchema = z.object({ response_format: responseFormatField }).strict();

/** goalMultiplier is applied to TDEE: 0.85 → 15% deficit, 1.1 → 10% surplus. */
function goalAdjustment(multiplier: number): string {
  const pct = Math.round((1 - multiplier) * 100);
  if (pct > 0) return `deficit ${pct}%`;
  if (pct < 0) return `surplus ${-pct}%`;
  return "maintenance";
}

/**
 * Manual targets carry placeholder BMR/TDEE/activity/multiplier (see Norm.energyEstimated); reporting them
 * as real numbers would mislead, so they are nulled and the flag says why.
 */
function publicNorm(norm: Norm) {
  const { bmr, tdee, activityLevel, activityFactor, goalMultiplier, ...rest } = norm;
  return norm.energyEstimated
    ? { ...rest, bmr, tdee, activityLevel, activityFactor, goalMultiplier }
    : { ...rest, bmr: null, tdee: null, activityLevel: null, activityFactor: null, goalMultiplier: null };
}

export function registerProfileTool(server: McpServer, ctx: ToolContext): void {
  registerReadTool(
    server,
    {
      name: "kcalrep_get_profile",
      title: "Get profile and daily targets",
      description: `Get the user's profile and CURRENT daily nutrition targets from kcalrep: sex, age, height, goal, calorie and macro targets (protein/fat/carbs in grams), BMR, TDEE, activity level, whether the targets are manual or auto-calculated, and app settings (calorie-deficit slider, activity tracking on/off).
Read-only. Small and quick; kcalrep_get_report already starts with these settings, so use this alone only when no period data is needed.

Args:
  - response_format ('markdown' | 'json'): default 'markdown'

Returns (json): { name, norm: { calories, protein, fat, carbs, goal, gender, age, height, mode, energyEstimated, updatedAt, bmr, tdee, activityLevel, activityFactor, goalMultiplier } | null, goalAdjustment, settings: { activityTrackingEnabled, deficitPercent } | null }
When mode is 'manual' the targets were typed in by the user: bmr, tdee, activityLevel, activityFactor, goalMultiplier and goalAdjustment are then null (the app stores only placeholders there, not real estimates).
Targets are the stored base norm; cycle-phase calorie adjustments the app may add on top are not included.`,
      inputSchema: InputSchema,
    },
    async (args) => {
      const [profile, norm, settings] = await Promise.all([
        ctx.db.getProfile(),
        ctx.db.getNorm(),
        ctx.db.getSettings(),
      ]);

      if (!profile && !norm && !settings) {
        return "No profile, norm or settings found. The account may not have finished onboarding, or KCALREP_USER_UID points at the wrong user.";
      }

      const data = {
        name: profile?.name ?? null,
        norm: norm ? publicNorm(norm) : null,
        goalAdjustment: norm?.energyEstimated ? goalAdjustment(norm.goalMultiplier) : null,
        settings,
      };
      if (args.response_format === "json") return renderJson(data);

      const lines = ["# Profile and daily targets", ""];
      if (data.name) lines.push(`- Name: ${data.name}`);
      if (norm) {
        const who = [
          norm.gender,
          norm.age !== null ? `${norm.age} y` : null,
          norm.height !== null ? `${norm.height} cm` : null,
        ].filter(Boolean);
        if (who.length) lines.push(`- ${who.join(", ")}`);
        const adjustment = data.goalAdjustment ? ` (${data.goalAdjustment})` : "";
        lines.push(
          `- Goal: ${norm.goal || "—"}${adjustment}; targets are ${norm.mode === "manual" ? "MANUAL (typed in, never auto-recalculated)" : "auto-calculated"}`,
        );
        lines.push("", `## Daily targets${norm.updatedAt ? ` (updated ${norm.updatedAt.slice(0, 10)})` : ""}`, "");
        lines.push(`- Calories: ${norm.calories} kcal`);
        lines.push(`- Protein ${norm.protein} g · Fat ${norm.fat} g · Carbs ${norm.carbs} g`);
        lines.push(
          norm.energyEstimated
            ? `- BMR ${norm.bmr} kcal · TDEE ${norm.tdee} kcal · activity level "${norm.activityLevel}" (×${norm.activityFactor})`
            : "- BMR / TDEE: not available — the targets were typed in manually, so the app stores no real estimate of them.",
        );
      } else {
        lines.push("- No norm saved yet.");
      }
      if (settings) {
        lines.push("", "## Settings", "");
        lines.push(`- Calorie-deficit slider: ${settings.deficitPercent ?? "—"}%`);
        lines.push(`- Activity tracking (Apple Watch/steps): ${settings.activityTrackingEnabled ? "on" : "off"}`);
      }
      lines.push("", "_Targets are the stored base norm; cycle-phase adjustments are not included._");
      return lines.join("\n");
    },
  );
}
