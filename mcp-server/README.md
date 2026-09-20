# kcalrep MCP server

A small **read-only** [MCP](https://modelcontextprotocol.io) server that lets Claude read the data you enter into kcalrep — the **same data the website exports** under *Профиль → Выгрузка данных* — so you don't have to download the report and paste it into the chat.

It runs **locally on your computer** (stdio), reads Firestore directly, and never writes anything.

```
Claude  ⇄  node mcp-server/dist/index.js  ──(read-only)──▶  Firestore (eattrack-aaed3)
```

## What Claude can see

Only what the site's export contains, for **one account** (yours by default):

| Data | Where in the export |
|---|---|
| Sex, age, height, goal, deficit slider, activity tracking, current BMR/TDEE | Текущие настройки профиля |
| First/last meal, eating window, number of meals per day | 1. Периоды приёма пищи |
| Every meal: time, product, grams, kcal, protein, fat, carbs | 2. Приёмы пищи по дням |
| Daily totals, target and TDEE of that day, deficit | 3. Дневные итоги и дефицит |
| BMR, activity level, goal multiplier, protein/fat/carb targets of each day | 4. Норма и настройки по дням |
| Weigh-ins, body fat %, lean mass, scale BMR | 5. Изменение веса и состава тела |
| Activity kcal (Apple Watch / steps) | 6. Активность и TDEE |

**Never read**: cycle tracking and daily surveys, the shared product/recipe catalogue, food-usage statistics, your partner's data, sign-in details (e-mail, passwords), your `.env`, or any file on the computer. The display name is the only profile field beyond the export, and the e-mail address is never returned.

Data reaches Claude only when a tool is called during a chat, and only the requested period. The server sends nothing on its own.

## Why it is read-only

Independent layers:

1. **Code** — the database interface (`src/data-source.ts`) has only `get*` methods, and tests fail if `src/firestore-source.ts` ever calls a write API.
2. **Scope** — the same tests fail if that file touches anything but `users/{uid}/…`, or reads cycle data, the catalogue or usage stats. What the server can reach is decided by that one small file.
3. **Tool metadata** — every tool is declared `readOnlyHint: true`.
4. **Google IAM** — the service account has only the **Cloud Datastore Viewer** role (step 2), so Google would refuse a write even if the code had a bug.

Note the Viewer role covers the *whole database*, not just this server's slice — so the key file is as sensitive as a password. Keep it out of the repo and don't share it.

## Setup

### 1. Install and build

```bash
cd mcp-server
npm install
npm run build
```

Needs Node 18+.

### 2. Create a read-only service account

1. Open [IAM → Service Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts?project=eattrack-aaed3) for the Firebase project (the project id is in `.firebaserc`), signed in with the Google account that owns it.
2. **Create service account** → name it e.g. `kcalrep-mcp-reader`.
3. Under *Grant this service account access to project*, choose the role **Cloud Datastore Viewer** (`roles/datastore.viewer`) — and nothing else. Done.

> Don't reuse the default `firebase-adminsdk-…` account or press "Generate new private key" in the Firebase console: that key can write. The server prints a warning at startup if you do.

### 3. Create a key for it

1. Open the new service account → **Keys** → **Add key** → **Create new key** → **JSON**. A `.json` file downloads.
2. Move it **outside this repository**, e.g. `C:\Users\<you>\.kcalrep\reader-key.json`, and delete the copy in *Downloads*. (`.gitignore` blocks common key file names as a backstop, but the safest key is one that isn't in the repo folder at all.)

If Google refuses to create the key ("service account key creation is disabled"), that's an organisation policy (`iam.disableServiceAccountKeyCreation`) on your Google Cloud account; it has to be relaxed there.

### 4. Connect it to Claude

**Claude Code / the Code tab of the desktop app** (adjust both paths):

```bash
claude mcp add kcalrep --scope user --env KCALREP_SERVICE_ACCOUNT_KEY=C:\Users\<you>\.kcalrep\reader-key.json -- node C:\path\to\kcalrep-main\mcp-server\dist\index.js
```

**Claude Desktop (Chat)** — the entry must be added while the app is **closed**. Desktop keeps its config in memory and rewrites the *whole* `claude_desktop_config.json` whenever it saves its own UI state (for example when you switch between Code sessions), so an `mcpServers` entry added while it runs — by hand or by any tool — is silently erased. Use the helper: it waits for Desktop to quit, adds the entry without touching anything else (other MCP servers, preferences), takes a backup, verifies the result and test-launches the server.

```bash
node C:/path/to/kcalrep-main/mcp-server/scripts/install-claude-desktop.mjs --key C:/Users/<you>/.kcalrep/reader-key.json
```

Run it in a normal terminal window (not inside the Claude app), then quit Claude Desktop completely (tray icon → Quit), wait for "Done", and start the app again. `--dry-run` previews the change. (Forward slashes are fine on Windows and survive every shell.)

**Where the config is.** If Claude Desktop came from the **Microsoft Store** (an MSIX package), its config is *not* in `%APPDATA%\Claude` as far as an ordinary terminal is concerned: the app sees `%APPDATA%` redirected into its package, so the real file is `%LOCALAPPDATA%\Packages\Claude_<id>\LocalCache\Roaming\Claude\claude_desktop_config.json` (on this machine `Claude_pzs8sxrjxfjjc`). A classic installer keeps it in `%APPDATA%\Claude`. The helper finds the right one by itself and prints which it used; it also works from an Administrator terminal.

By hand it also works, but only with the app closed: add this under `mcpServers` in that file and then start the app.

```json
"kcalrep": {
  "command": "C:\\Program Files\\nodejs\\node.exe",
  "args": ["C:\\path\\to\\kcalrep-main\\mcp-server\\dist\\index.js"],
  "env": { "KCALREP_SERVICE_ACCOUNT_KEY": "C:\\Users\\<you>\\.kcalrep\\reader-key.json" }
}
```

Claude Code's `claude mcp add` (above) is not affected by this: it writes `~/.claude.json` through the CLI. Use `--scope user` (or the desktop config) rather than a project `.mcp.json`, so machine-specific paths never land in git.

### 5. Try it

- "Analyse my last week: how was my deficit, protein and eating window?"
- "Compare this month with the previous one."
- "On which days did I go over my calorie target?"

## Configuration

| Variable | Default | Meaning |
|---|---|---|
| `KCALREP_SERVICE_ACCOUNT_KEY` | *(falls back to `GOOGLE_APPLICATION_CREDENTIALS`)* | Path to the service-account JSON key. |
| `KCALREP_USER_UID` | the site owner's UID (`ADMIN_UID` in `src/lib/config.ts`) | Whose `users/{uid}/…` data to expose. Only **one** user is exposed per server instance. |
| `KCALREP_TZ` | this computer's time zone | IANA zone (e.g. `Europe/Berlin`) used for "today" and for meal times. The site shows times in the browser's zone, so set this to the zone you eat in. |

## Tools

| Tool | What it returns |
|---|---|
| `kcalrep_get_report` | **Use this first.** The site's export report, verbatim in structure: the six sections above, for a period (default last 7 days, max 31). `include_meals: false` skips the long meal list; it is also dropped automatically, with a note, if the report would exceed the output limit. |
| `kcalrep_get_daily_summary` | Compact per-day table with period averages, for **longer** periods (max 92 days); JSON available. Flags days with no entries, and today as partial. |
| `kcalrep_get_diary` | Individual diary entries with paging (default: today). |
| `kcalrep_get_weight_history` | Weigh-ins and body composition with changes (default 90 days). |
| `kcalrep_get_profile` | Current targets, goal, manual/auto mode, settings. |

Dates are `YYYY-MM-DD`, inclusive. Output is trimmed to ~40 000 characters with a note on how to narrow it.

### How the report relates to the site's file

`kcalrep_get_report` is a port of the site's `generateMarkdownReport` (`src/lib/exportReport.ts`). Checked against a real export of the same week, the only difference is one extra line, and that line is deliberate:

- **Manual targets**: when the norm was typed in by hand, the app stores BMR and TDEE equal to the calorie target, so «Дефицит к TDEE» just repeats «Дефицит к цели». The report keeps the figures exactly as the site prints them and adds an italic note under section 3 so Claude doesn't read them as real TDEE.
- A `|` inside a product name is escaped so it can't break a table row; an entry with no timestamp shows `—` instead of the current time.

Like the site's file: the deficit is positive when you ate *less* than the target; a day with no entries still gets a row with 0 kcal; today's row is incomplete until the day ends; and a meal added later for an earlier date shows the time it was typed in. (`kcalrep_get_diary` and `kcalrep_get_daily_summary` mark such backdated entries and leave them out of meal timing.)

## Development

```bash
npm run build     # compile to dist/
npm test          # unit + in-memory MCP integration tests (no Firestore or credentials needed)
npx @modelcontextprotocol/inspector node dist/index.js   # interactive tool explorer
```

Layout: `src/models.ts` (Firestore doc → typed shapes), `src/firestore-source.ts` (the only file that touches Firestore), `src/report.ts` (port of the site's export), `src/aggregate.ts` (day/period math for the summary), `src/tools/*` (one file per domain), `src/server.ts` (registration). Diagnostics go to **stderr**; stdout carries the protocol.

If you change the site's export (`src/lib/exportReport.ts`), change `src/report.ts` with it, and update `models.ts` when the app adds fields the export uses.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Tool error: *Could not authenticate to Firestore* | `KCALREP_SERVICE_ACCOUNT_KEY` is unset or the key is invalid/revoked → redo step 3. |
| Tool error: *Firestore denied access* | The service account lacks **Cloud Datastore Viewer** → redo step 2 (role changes can take a minute). |
| Installer says `Config not found` | You are probably on the Microsoft Store version and running an older copy of the script that only looked in `%APPDATA%\Claude`. Pull the current script, or pass the real path with `--config` (see "Where the config is"). |
| The server was in Claude Desktop's config but disappeared (or never shows up in the chat) | Desktop overwrote its config from memory while it was running. Re-run `scripts/install-claude-desktop.mjs` and follow its prompts (it waits for the app to be closed). The same happens to *any* MCP server added to that file while the app runs. |
| Server doesn't appear in Claude | Run `node dist/index.js` in a terminal; startup problems (bad key path, bad `KCALREP_TZ`) print to stderr. Check the path is absolute and you ran `npm run build`. |
| Meal times are off by hours | Set `KCALREP_TZ`. |
| Works on the desktop but not on claude.ai / phone | This is a local (stdio) server, so only clients running on this computer can use it. Reaching it from the web or phone would need a hosted HTTP server with authentication — not built. |

## Privacy

Whatever a tool returns is sent to Claude as part of the conversation. The server itself only talks to Google (sign-in with the service-account key, then Firestore) and does no logging or telemetry of its own.
