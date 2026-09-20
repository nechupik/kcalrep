#!/usr/bin/env node
/**
 * Adds the kcalrep server to Claude Desktop's config (claude_desktop_config.json) - safely.
 *
 * WHY A SCRIPT: Claude Desktop keeps its config in memory and rewrites the WHOLE file whenever it saves UI
 * state (for example when you switch between Code sessions). Any `mcpServers` entry added to the file while
 * the app is running is silently dropped by that next write. The entry only sticks if it is added while
 * Desktop is CLOSED and Desktop then starts and reads it.
 *
 * So this script waits until Desktop has closed (its `lockfile` disappears), then writes the entry with an
 * atomic rename, keeps every other key untouched (other MCP servers, preferences, indentation, line endings),
 * takes a timestamped backup, verifies the result, and finally launches the server once to prove the entry works.
 *
 * Usage:
 *   node scripts/install-claude-desktop.mjs --key C:/path/to/reader-key.json
 *
 * Options:
 *   --key <file>       service-account JSON key (required)
 *   --config <file>    config to edit (default: found automatically - for a Microsoft Store install
 *                      %LOCALAPPDATA%/Packages/Claude_<id>/LocalCache/Roaming/Claude/, otherwise %APPDATA%/Claude/)
 *   --dry-run          show what would change; write nothing
 *   --no-wait          exit with an error instead of waiting when Desktop is running
 *   --timeout <sec>    how long to wait for Desktop to close (default 900)
 *   --force            write even though Desktop looks like it is running (the entry will probably be lost)
 *   --no-check         skip the final launch check
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SERVER_NAME = "kcalrep";
const here = path.dirname(fileURLToPath(import.meta.url));

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function fail(message, code = 1) {
  console.error(`\nERROR: ${message}`);
  process.exit(code);
}

/**
 * Where Claude Desktop keeps its config.
 *
 * A Microsoft Store (MSIX) install redirects the app's %APPDATA% into the package's private storage. Inside
 * the app the file appears under %APPDATA%\Claude, but from an ordinary terminal it is NOT there - it lives in
 * %LOCALAPPDATA%\Packages\Claude_<id>\LocalCache\Roaming\Claude. The app reads that copy, so prefer it; a
 * classic (non-Store) install keeps the file under %APPDATA%\Claude.
 */
function locateConfig() {
  const searched = [];
  const found = [];

  const local = process.env.LOCALAPPDATA;
  if (local) {
    const packages = path.join(local, "Packages");
    let names = [];
    try {
      names = fs.readdirSync(packages).filter((n) => /^Claude_/i.test(n));
    } catch {
      // no Packages folder: not a Store install
    }
    for (const name of names) {
      const p = path.join(packages, name, "LocalCache", "Roaming", "Claude", "claude_desktop_config.json");
      searched.push(p);
      if (fs.existsSync(p)) found.push({ path: p, kind: "Microsoft Store install" });
    }
  }

  const appData = process.env.APPDATA;
  if (appData) {
    const p = path.join(appData, "Claude", "claude_desktop_config.json");
    searched.push(p);
    if (fs.existsSync(p)) found.push({ path: p, kind: "classic install" });
  }

  if (found.length === 0) {
    fail(
      `Could not find Claude Desktop's config. Looked in:\n  ${searched.join("\n  ") || "(nowhere: neither %LOCALAPPDATA% nor %APPDATA% is set)"}\n` +
        "Open Claude Desktop once so it creates the file, or pass --config <file>.",
    );
  }
  if (found.length > 1) {
    const [chosen, ...others] = found;
    const differs = others.filter((o) => {
      const a = fs.statSync(chosen.path);
      const b = fs.statSync(o.path);
      return a.size !== b.size || a.mtimeMs !== b.mtimeMs;
    });
    if (differs.length) {
      console.warn(`NOTE: also found ${differs.map((d) => d.path).join(", ")}. The ${chosen.kind} does not read it, so it is left alone.`);
    }
  }
  return found[0];
}

function parseArgs(argv) {
  const opts = { dryRun: false, wait: true, force: false, check: true, timeout: 900 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const value = () => {
      if (i + 1 >= argv.length) fail(`${a} needs a value.`);
      return argv[++i];
    };
    if (a === "--key") opts.key = value();
    else if (a === "--config") opts.config = value();
    else if (a === "--timeout") opts.timeout = Number(value());
    else if (a === "--dry-run") opts.dryRun = true;
    else if (a === "--no-wait") opts.wait = false;
    else if (a === "--force") opts.force = true;
    else if (a === "--no-check") opts.check = false;
    else if (a === "--help" || a === "-h") {
      console.log(fs.readFileSync(fileURLToPath(import.meta.url), "utf8").split("*/")[0].replace(/^#!.*\n/, ""));
      process.exit(0);
    } else fail(`Unknown option ${a}. Try --help.`);
  }
  if (!Number.isFinite(opts.timeout) || opts.timeout < 0) fail("--timeout must be a number of seconds.");
  return opts;
}

/** JSON.stringify with recursively sorted keys, so objects compare equal regardless of key order. */
function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stable(value[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function readConfig(configPath) {
  const raw = fs.readFileSync(configPath, "utf8");
  const bom = raw.startsWith("\uFEFF") ? "\uFEFF" : "";
  const text = raw.slice(bom.length);
  let cfg;
  try {
    cfg = JSON.parse(text);
  } catch (error) {
    fail(`${configPath} is not valid JSON (${error.message}). Nothing was changed.`);
  }
  return {
    cfg,
    bom,
    eol: text.includes("\r\n") ? "\r\n" : "\n",
    indent: (text.match(/^\{\r?\n([ \t]+)"/) ?? [, "  "])[1],
    trailingNewline: /\r?\n$/.test(text),
  };
}

function serialise({ cfg, bom, eol, indent, trailingNewline }) {
  let out = JSON.stringify(cfg, null, indent);
  if (eol === "\r\n") out = out.replace(/\n/g, "\r\n");
  if (trailingNewline) out += eol;
  return bom + out;
}

async function waitForDesktopToClose(lockfile, timeoutSec) {
  const started = Date.now();
  let announced = false;
  while (fs.existsSync(lockfile)) {
    if (!announced) {
      console.log("Claude Desktop is running. Quit it completely (tray icon -> Quit); I will continue as soon as it has closed...");
      announced = true;
    }
    if (Date.now() - started > timeoutSec * 1000) return false;
    await sleep(1000);
  }
  if (announced) {
    console.log("Claude Desktop has closed.");
    await sleep(2000); // let it finish any last write before we touch the file
  }
  return true;
}

async function launchCheck(entry) {
  const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
  const { StdioClientTransport } = await import("@modelcontextprotocol/sdk/client/stdio.js");
  const transport = new StdioClientTransport({
    command: entry.command,
    args: entry.args,
    env: { ...process.env, ...entry.env },
    stderr: "ignore",
  });
  const client = new Client({ name: "install-check", version: "1.0.0" });
  try {
    await client.connect(transport);
    const { tools } = await client.listTools();
    return tools.map((t) => t.name);
  } finally {
    await client.close().catch(() => {});
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  const located = opts.config ? { path: path.resolve(opts.config), kind: "given with --config" } : locateConfig();
  const configPath = located.path;
  if (!fs.existsSync(configPath)) fail(`Config not found: ${configPath}`);

  if (!opts.key) fail('--key is required, e.g. --key "C:/Users/you/.kcalrep/reader-key.json"');
  const keyPath = path.resolve(opts.key);
  if (!fs.existsSync(keyPath)) fail(`Key file not found: ${keyPath}`);
  try {
    const key = JSON.parse(fs.readFileSync(keyPath, "utf8"));
    if (key.type !== "service_account") fail(`${keyPath} is not a service-account key (expected "type": "service_account").`);
    if (String(key.client_email ?? "").startsWith("firebase-adminsdk-")) {
      console.warn(
        "WARNING: this is the default Firebase Admin SDK key, which can WRITE to Firestore. Prefer a dedicated Viewer-only service account (see README).",
      );
    }
  } catch (error) {
    if (error instanceof SyntaxError) fail(`${keyPath} is not valid JSON.`);
    throw error;
  }

  const serverScript = path.resolve(here, "..", "dist", "index.js");
  if (!fs.existsSync(serverScript)) fail(`${serverScript} does not exist. Run "npm run build" in mcp-server first.`);

  const entry = {
    command: process.execPath,
    args: [serverScript],
    env: { KCALREP_SERVICE_ACCOUNT_KEY: keyPath },
  };

  // Refuse (or wait) while Desktop runs: it would erase the entry on its next write.
  const lockfile = path.join(path.dirname(configPath), "lockfile");
  if (!opts.force && fs.existsSync(lockfile)) {
    if (!opts.wait) {
      fail(
        "Claude Desktop is running, and it rewrites this file from memory, which would drop the entry.\nQuit it completely (tray icon -> Quit) and run this again, or run without --no-wait to have me wait for it.",
        2,
      );
    }
    if (opts.dryRun) {
      console.log("(dry run) Claude Desktop is running, so a real run would wait for it to close first.");
    } else if (!(await waitForDesktopToClose(lockfile, opts.timeout))) {
      fail(`Claude Desktop was still running after ${opts.timeout} s. Nothing was changed.`, 2);
    }
  }

  // Read AFTER any waiting, so we never write back a stale copy.
  const before = readConfig(configPath);
  const existing = before.cfg.mcpServers?.[SERVER_NAME];
  const otherServers = Object.keys(before.cfg.mcpServers ?? {}).filter((n) => n !== SERVER_NAME);

  console.log(`Config:  ${configPath}  (${located.kind})`);
  console.log(`Servers: ${Object.keys(before.cfg.mcpServers ?? {}).join(", ") || "(none)"}`);

  if (existing && stable(existing) === stable(entry)) {
    console.log(`\n"${SERVER_NAME}" is already configured exactly like this. Nothing to change.`);
  } else {
    console.log(`\n${existing ? "Will UPDATE" : "Will ADD"} "${SERVER_NAME}":`);
    console.log(`  command: ${entry.command}\n  args:    ${entry.args[0]}\n  key:     ${keyPath}`);
    console.log(`Other servers left untouched: ${otherServers.join(", ") || "(none)"}`);
    if (opts.dryRun) {
      console.log("\n(dry run) Nothing was written.");
      return;
    }

    const now = new Date();
    const p2 = (n) => String(n).padStart(2, "0");
    const stamp = `${now.getFullYear()}${p2(now.getMonth() + 1)}${p2(now.getDate())}-${p2(now.getHours())}${p2(now.getMinutes())}${p2(now.getSeconds())}`;
    const backup = `${configPath}.bak-${stamp}-before-${SERVER_NAME}`;
    fs.copyFileSync(configPath, backup);

    const next = structuredClone(before);
    next.cfg.mcpServers = { ...(next.cfg.mcpServers ?? {}), [SERVER_NAME]: entry };

    const temp = `${configPath}.tmp-${process.pid}`;
    try {
      fs.writeFileSync(temp, serialise(next), "utf8");
      fs.renameSync(temp, configPath); // atomic replace: no half-written file is ever visible
    } catch (error) {
      fs.rmSync(temp, { force: true });
      fail(
        `Could not write ${configPath}: ${error.message}\nThe original is unchanged (backup: ${backup}).\n` +
          "Try again from a terminal opened as Administrator, or add the entry by hand while Claude Desktop is closed (see the README).",
      );
    }

    // Verify: our entry is there, and nothing else moved.
    const after = readConfig(configPath).cfg;
    const { [SERVER_NAME]: written, ...afterRest } = after.mcpServers ?? {};
    const { [SERVER_NAME]: _old, ...beforeRest } = before.cfg.mcpServers ?? {};
    const othersIntact =
      stable({ ...after, mcpServers: afterRest }) === stable({ ...before.cfg, mcpServers: beforeRest });
    if (!written || stable(written) !== stable(entry) || !othersIntact) {
      fs.copyFileSync(backup, configPath);
      fail(`Verification failed, so the original file was restored from ${backup}.`);
    }
    console.log(`\nWritten and verified. Backup: ${backup}`);

    // Something might still write late; look again after a moment.
    await sleep(3000);
    const later = readConfig(configPath).cfg.mcpServers?.[SERVER_NAME];
    if (!later || stable(later) !== stable(entry)) {
      fail("The entry disappeared again within seconds - something else is writing this file. Is Claude Desktop still running?");
    }
    console.log("Still in place 3 s later.");
  }

  if (opts.check) {
    process.stdout.write("\nLaunching the server exactly as Desktop will... ");
    try {
      const tools = await launchCheck(entry);
      console.log(`OK (${tools.length} tools: ${tools.join(", ")})`);
    } catch (error) {
      console.log("FAILED");
      fail(`The server did not start from this entry: ${error.message}\nCheck the key path and that "npm run build" has been run.`);
    }
  }

  console.log("\nDone. Now START Claude Desktop - it reads the file at startup, which is what makes the entry stick.");
  console.log("Avoid editing this file while the app is open: it will overwrite the change.");
}

main().catch((error) => fail(error?.stack ?? String(error)));
