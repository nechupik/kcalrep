import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerNutritionTools } from "./tools/nutrition.js";
import { registerProfileTool } from "./tools/profile.js";
import { registerReportTool } from "./tools/report.js";
import { registerWeightTool } from "./tools/weight.js";
import type { ToolContext } from "./tool-kit.js";

export const SERVER_NAME = "kcalrep-mcp-server";
export const SERVER_VERSION = "1.0.0";

/** Build the server with every tool registered. Transport-agnostic, so tests can drive it in-memory. */
export function createServer(ctx: ToolContext): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });
  registerReportTool(server, ctx);
  registerProfileTool(server, ctx);
  registerNutritionTools(server, ctx);
  registerWeightTool(server, ctx);
  return server;
}
