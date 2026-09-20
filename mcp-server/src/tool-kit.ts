import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { DataSource } from "./data-source.js";
import { ToolInputError } from "./dates.js";

/** What every tool gets: the read-only database and the user's time zone. */
export interface ToolContext {
  db: DataSource;
  timeZone: string;
  /** Injected so tests can pin "today". */
  now: () => Date;
}

/**
 * Turn a thrown error into a message that tells the model (and through it the user) what to do next.
 * Anything unrecognised is passed through rather than swallowed.
 */
export function describeError(error: unknown): string {
  if (error instanceof ToolInputError) return error.message;

  const err = error as { code?: number | string; message?: string };
  const message = err?.message ?? String(error);

  // gRPC status codes surfaced by @google-cloud/firestore.
  if (err?.code === 7 || /PERMISSION_DENIED/.test(message)) {
    return (
      "Firestore denied access. The service account behind KCALREP_SERVICE_ACCOUNT_KEY needs the " +
      '"Cloud Datastore Viewer" role on the Firebase project (see mcp-server/README.md, step 2).'
    );
  }
  if (
    err?.code === 16 ||
    /UNAUTHENTICATED|Could not load the default credentials|Unable to detect a Project Id|invalid_grant|invalid_rapt/i.test(message)
  ) {
    return (
      "Could not authenticate to Firestore. Set KCALREP_SERVICE_ACCOUNT_KEY to the path of a valid " +
      "service-account JSON key (see mcp-server/README.md, step 3)."
    );
  }
  if (err?.code === 14 || /UNAVAILABLE|ENOTFOUND|ETIMEDOUT/.test(message)) {
    return "Could not reach Firestore. Check the internet connection and try again.";
  }
  if (err?.code === 8 || /RESOURCE_EXHAUSTED/.test(message)) {
    return "Firestore quota exceeded for today. Try again later or with a smaller date range.";
  }
  return `Unexpected error: ${message}`;
}

interface ReadToolDefinition<S extends z.ZodTypeAny> {
  name: string;
  title: string;
  description: string;
  inputSchema: S;
}

/**
 * Register a tool that only reads. The handler returns the text to show; any error it throws is
 * converted to an `isError` result instead of failing the protocol call.
 */
export function registerReadTool<S extends z.ZodTypeAny>(
  server: McpServer,
  def: ReadToolDefinition<S>,
  handler: (args: z.infer<S>) => Promise<string>,
): void {
  server.registerTool(
    def.name,
    {
      title: def.title,
      description: def.description,
      inputSchema: def.inputSchema as z.ZodTypeAny,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (args: unknown): Promise<CallToolResult> => {
      try {
        const text = await handler(args as z.infer<S>);
        return { content: [{ type: "text", text }] };
      } catch (error) {
        // Bad input is expected and self-explanatory; only unexpected failures deserve a stack trace.
        if (error instanceof ToolInputError) console.error(`[${def.name}] ${error.message}`);
        else console.error(`[${def.name}]`, error);
        return { isError: true, content: [{ type: "text", text: `Error: ${describeError(error)}` }] };
      }
    },
  );
}
