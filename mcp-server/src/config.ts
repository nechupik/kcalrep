import { readFileSync } from "node:fs";

// Mirrors ADMIN_UID in ../../src/lib/config.ts (the site owner's Firebase Auth UID).
// The partner's data lives under a different UID; point KCALREP_USER_UID at it to read theirs instead.
const DEFAULT_USER_UID = "irXSByiUKYg9S5g3UXF5xSXHijC3";

/** Keep tool output well under typical MCP client limits (~25k tokens, Cyrillic is token-heavy). */
export const CHARACTER_LIMIT = 40_000;

export const MAX_RANGE_DAYS = 92;
/** The full report is long (every meal of every day); a month is what the site's "current month" export covers. */
export const MAX_REPORT_DAYS = 31;
export const MAX_LONG_RANGE_DAYS = 366;

export interface Config {
  /** Firebase Auth UID whose `users/{uid}/...` data is exposed. */
  userUid: string;
  /** IANA zone used for "today" and for rendering meal times. */
  timeZone: string;
  /** Path to a service-account JSON key; when unset, Google Application Default Credentials are used. */
  keyFilename?: string;
}

export class ConfigError extends Error {}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const timeZone = env.KCALREP_TZ?.trim() || Intl.DateTimeFormat().resolvedOptions().timeZone;
  try {
    new Intl.DateTimeFormat("en", { timeZone });
  } catch {
    throw new ConfigError(`KCALREP_TZ="${timeZone}" is not a valid IANA time zone (e.g. "Europe/Moscow").`);
  }

  return {
    userUid: env.KCALREP_USER_UID?.trim() || DEFAULT_USER_UID,
    timeZone,
    keyFilename: env.KCALREP_SERVICE_ACCOUNT_KEY?.trim() || env.GOOGLE_APPLICATION_CREDENTIALS?.trim() || undefined,
  };
}

/**
 * Sanity-check the service-account key at startup so misconfiguration fails loudly here
 * instead of as an opaque gRPC error on the first tool call. Returns warnings for stderr.
 */
export function inspectKeyFile(path: string): string[] {
  let parsed: { type?: string; client_email?: string };
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new ConfigError(
      `Cannot read service-account key at "${path}": ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (parsed.type !== "service_account") {
    throw new ConfigError(`"${path}" is not a service-account key (expected "type": "service_account").`);
  }

  const warnings: string[] = [];
  if (parsed.client_email?.startsWith("firebase-adminsdk-")) {
    warnings.push(
      "The key belongs to the default Firebase Admin SDK account, which can WRITE to Firestore. " +
        "This server never writes, but for a hard guarantee create a dedicated service account with only the " +
        '"Cloud Datastore Viewer" role (see mcp-server/README.md).',
    );
  }
  return warnings;
}
