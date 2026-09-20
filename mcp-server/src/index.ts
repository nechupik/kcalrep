#!/usr/bin/env node
/**
 * kcalrep MCP server — read-only access to the kcalrep Firestore data for Claude, over stdio.
 *
 * stdout carries the JSON-RPC stream, so ALL logging goes to stderr.
 *
 * Environment:
 *   KCALREP_SERVICE_ACCOUNT_KEY  path to a service-account JSON key (falls back to GOOGLE_APPLICATION_CREDENTIALS)
 *   KCALREP_USER_UID             Firebase Auth UID whose data to expose (default: the site owner)
 *   KCALREP_TZ                   IANA time zone for "today" and meal times (default: this machine's zone)
 */
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ConfigError, inspectKeyFile, loadConfig } from "./config.js";
import { FirestoreSource } from "./firestore-source.js";
import { createServer, SERVER_NAME, SERVER_VERSION } from "./server.js";

async function main(): Promise<void> {
  const config = loadConfig();

  if (config.keyFilename) {
    for (const warning of inspectKeyFile(config.keyFilename)) console.error(`[${SERVER_NAME}] WARNING: ${warning}`);
  } else {
    console.error(
      `[${SERVER_NAME}] WARNING: KCALREP_SERVICE_ACCOUNT_KEY is not set; falling back to Application Default Credentials. ` +
        "Tools will fail with an authentication error unless those are configured.",
    );
  }

  const server = createServer({
    db: new FirestoreSource(config.userUid, config.keyFilename),
    timeZone: config.timeZone,
    now: () => new Date(),
  });
  await server.connect(new StdioServerTransport());
  console.error(`[${SERVER_NAME}] v${SERVER_VERSION} ready (read-only, tz ${config.timeZone})`);
}

main().catch((error) => {
  console.error(error instanceof ConfigError ? `[${SERVER_NAME}] ${error.message}` : error);
  process.exit(1);
});
