import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, describe, expect, it } from "vitest";
import type { DataSource } from "./data-source.js";
import { eachDate } from "./dates.js";
import { fakeDb, manualDb, moscow, NOW, TZ } from "./fixtures.js";
import { createServer } from "./server.js";

let client: Client | undefined;

async function connect(db: DataSource = fakeDb()): Promise<Client> {
  const server = createServer({ db, timeZone: TZ, now: () => NOW });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  client = new Client({ name: "test-client", version: "0.0.0" });
  await client.connect(clientTransport);
  return client;
}

async function call(c: Client, name: string, args: Record<string, unknown> = {}) {
  const result = await c.callTool({ name, arguments: args });
  const content = result.content as Array<{ type: string; text: string }>;
  return { isError: result.isError === true, text: content[0].text };
}

const sourceOf = (file: string) => readFileSync(resolve(process.cwd(), "src", file), "utf8");
/** Source with comments removed, so prose mentioning a forbidden word can't trip a scan. */
const codeOf = (file: string) => sourceOf(file).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

afterEach(async () => {
  await client?.close();
  client = undefined;
});

describe("tool registry", () => {
  it("exposes exactly the intended tools, all marked read-only", async () => {
    const c = await connect();
    const { tools } = await c.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      "kcalrep_get_daily_summary",
      "kcalrep_get_diary",
      "kcalrep_get_profile",
      "kcalrep_get_report",
      "kcalrep_get_weight_history",
    ]);
    for (const tool of tools) {
      expect(tool.annotations?.readOnlyHint, tool.name).toBe(true);
      expect(tool.annotations?.destructiveHint, tool.name).toBe(false);
      expect(tool.description?.length, tool.name).toBeGreaterThan(50);
    }
  });
});

describe("kcalrep_get_report", () => {
  it("defaults to the last 7 days ending today, like the site's «за последние 7 дней»", async () => {
    const c = await connect();
    const { isError, text } = await call(c, "kcalrep_get_report");
    expect(isError).toBe(false);
    expect(text).toContain("# Отчёт по питанию и активности");
    expect(text).toContain("**Период:** 13.09.2026 — 19.09.2026");
    expect(text).toContain("**Сформирован:** 19.09.2026");
  });

  it("produces the site's tables for an explicit range", async () => {
    const c = await connect();
    const { text } = await call(c, "kcalrep_get_report", { start_date: "2026-09-16", end_date: "2026-09-19" });
    expect(text).toContain("| 17.09.2026 | 09:00 | 19:30 | 10 ч 30 мин | 2 |");
    expect(text).toContain("| 09:00 | Овсянка | 100 г | 500 | 10.0 | 5.0 | 20.0 |");
    expect(text).toContain("| 17.09.2026 | 1700 | 20.0 | 10.0 | 40.0 | 1900 | 2300 | +200 | +600 |");
    expect(text).toContain("**Итого за период:** -0.4 кг (с 82 до 81.6 кг)");
  });

  it("can leave out the meal list and says how to get it", async () => {
    const c = await connect();
    const { text } = await call(c, "kcalrep_get_report", { start_date: "2026-09-16", end_date: "2026-09-19", include_meals: false });
    expect(text).not.toContain("### 17.09.2026");
    expect(text).toContain("kcalrep_get_diary");
    expect(text).toContain("## 3. Дневные итоги и дефицит");
  });

  it("flags manually typed targets, whose TDEE is only a placeholder", async () => {
    const c = await connect(manualDb());
    const { text } = await call(c, "kcalrep_get_report", { start_date: "2026-09-17", end_date: "2026-09-18" });
    expect(text).toContain("_Примечание: если норма введена вручную");
  });

  it("rejects a range longer than a month, pointing at the alternative", async () => {
    const c = await connect();
    const { isError, text } = await call(c, "kcalrep_get_report", { start_date: "2026-07-01", end_date: "2026-09-19" });
    expect(isError).toBe(true);
    expect(text).toMatch(/maximum is 31/);
    const description = (await c.listTools()).tools.find((t) => t.name === "kcalrep_get_report")?.description;
    expect(description).toContain("kcalrep_get_daily_summary");
  });

  it("drops the meal list automatically, and says so, when the full report would not fit", async () => {
    const many = eachDate("2026-08-20", "2026-09-19").flatMap((date) =>
      Array.from({ length: 60 }, (_, n) => ({
        id: `${date}-${n}`,
        date,
        addedAt: moscow(date, "08:00"),
        name: `Очень длинное название продукта номер ${n} для проверки лимита`,
        grams: 100,
        calories: 100,
        protein: 1,
        fat: 1,
        carbs: 1,
      })),
    );
    const c = await connect(fakeDb({ getDiary: async () => many }));
    const { isError, text } = await call(c, "kcalrep_get_report", { start_date: "2026-08-20", end_date: "2026-09-19" });
    expect(isError).toBe(false);
    expect(text.length).toBeLessThanOrEqual(40_000);
    expect(text).toContain("не помещается в лимит вывода");
    expect(text).not.toContain("### 20.08.2026");
    // Everything else is still there.
    expect(text).toContain("## 6. Активность и TDEE");
  });
});

describe("kcalrep_get_daily_summary", () => {
  it("renders a markdown table with deficits, partial today and period averages", async () => {
    const c = await connect();
    const { isError, text } = await call(c, "kcalrep_get_daily_summary", { start_date: "2026-09-16" });
    expect(isError).toBe(false);
    expect(text).toContain("# Daily summary 2026-09-16 → 2026-09-19");
    expect(text).toContain("2026-09-16 | not logged");
    expect(text).toContain("2026-09-17 | 1700");
    expect(text).toContain("09:00–19:30");
    expect(text).toContain("2026-09-19 (today, partial)");
    expect(text).toContain("Average: 1750 kcal");
    expect(text).toContain("82 → 81.6 kg (-0.4 kg)");
  });

  it("returns exact structured data as json", async () => {
    const c = await connect();
    const { text } = await call(c, "kcalrep_get_daily_summary", { start_date: "2026-09-17", end_date: "2026-09-18", response_format: "json" });
    const data = JSON.parse(text);
    expect(data.period).toMatchObject({ days: 2, avgCalories: 1750, avgDeficitVsTarget: 200 });
    expect(data.days).toHaveLength(2);
    expect(data.days[0]).toMatchObject({ date: "2026-09-17", deficitVsTarget: 200, deficitVsTdee: 600 });
  });

  it("does not invent a TDEE for manually typed targets", async () => {
    const c = await connect(manualDb());
    const json = JSON.parse((await call(c, "kcalrep_get_daily_summary", { start_date: "2026-09-17", end_date: "2026-09-18", response_format: "json" })).text);
    expect(json.days[0].targets).toMatchObject({ calories: 1850, bmr: null, tdee: null });
    expect(json.days[0].deficitVsTarget).toBe(150);
    expect(json.days[0].deficitVsTdee).toBeNull();
    expect(json.period.avgDeficitVsTdee).toBeNull();
    const md = (await call(c, "kcalrep_get_daily_summary", { start_date: "2026-09-17", end_date: "2026-09-18" })).text;
    expect(md).toContain("typed in manually");
    expect(md).not.toContain("vs TDEE");
  });

  it("defaults to the last 7 days ending today", async () => {
    const c = await connect();
    const data = JSON.parse((await call(c, "kcalrep_get_daily_summary", { response_format: "json" })).text);
    expect(data.start).toBe("2026-09-13");
    expect(data.end).toBe("2026-09-19");
  });

  it("clamps an end date in the future to today", async () => {
    const c = await connect();
    const data = JSON.parse((await call(c, "kcalrep_get_daily_summary", { end_date: "2026-12-31", start_date: "2026-09-18", response_format: "json" })).text);
    expect(data.end).toBe("2026-09-19");
  });

  it("explains a range that lies entirely in the future", async () => {
    const c = await connect();
    const { isError, text } = await call(c, "kcalrep_get_daily_summary", { start_date: "2026-10-01", end_date: "2026-10-05" });
    expect(isError).toBe(true);
    expect(text).toMatch(/in the future/);
  });
});

describe("kcalrep_get_diary", () => {
  it("defaults to today and shows the entry time", async () => {
    const c = await connect();
    const { text } = await call(c, "kcalrep_get_diary");
    expect(text).toContain("# Food diary 2026-09-19");
    expect(text).toContain("Кофе с молоком");
    expect(text).toContain("08:00");
  });

  it("escapes pipes in food names so tables stay intact", async () => {
    const c = await connect();
    const { text } = await call(c, "kcalrep_get_diary", { start_date: "2026-09-17", end_date: "2026-09-17" });
    expect(text).toContain("Курица \\| гриль");
  });

  it("marks backdated entries", async () => {
    const c = await connect();
    const { text } = await call(c, "kcalrep_get_diary", { start_date: "2026-09-18", end_date: "2026-09-18" });
    expect(text).toContain("08:00*");
    expect(text).toContain("backdated");
    const json = JSON.parse((await call(c, "kcalrep_get_diary", { start_date: "2026-09-18", end_date: "2026-09-18", response_format: "json" })).text);
    expect(json.entries[0].loggedOnOtherDay).toBe(true);
  });

  it("pages through entries with limit/offset", async () => {
    const c = await connect();
    const args = { start_date: "2026-09-17", end_date: "2026-09-19", limit: 2, response_format: "json" };
    const first = JSON.parse((await call(c, "kcalrep_get_diary", args)).text);
    expect(first).toMatchObject({ total: 4, count: 2, offset: 0, hasMore: true, nextOffset: 2 });
    const second = JSON.parse((await call(c, "kcalrep_get_diary", { ...args, offset: 2 })).text);
    expect(second).toMatchObject({ count: 2, offset: 2, hasMore: false });
    expect(second.nextOffset).toBeUndefined();
    // Totals always cover the whole range, not just the page.
    expect(first.totals.calories).toBe(3800);
  });

  it("says so plainly when there is nothing", async () => {
    const c = await connect();
    const { isError, text } = await call(c, "kcalrep_get_diary", { start_date: "2026-01-01", end_date: "2026-01-02" });
    expect(isError).toBe(false);
    expect(text).toBe("No diary entries between 2026-01-01 and 2026-01-02.");
  });

  it("rejects an oversized range with a hint to split it", async () => {
    const c = await connect();
    const { isError, text } = await call(c, "kcalrep_get_diary", { start_date: "2026-01-01", end_date: "2026-09-19" });
    expect(isError).toBe(true);
    expect(text).toMatch(/maximum is 92/);
  });

  it("rejects malformed dates at the schema level", async () => {
    const c = await connect();
    const { isError } = await call(c, "kcalrep_get_diary", { start_date: "19.09.2026" });
    expect(isError).toBe(true);
  });
});

describe("kcalrep_get_profile", () => {
  it("shows targets and the derived goal adjustment", async () => {
    const c = await connect();
    const { text } = await call(c, "kcalrep_get_profile");
    expect(text).toContain("deficit 15%");
    expect(text).toContain("Calories: 2000 kcal");
    expect(text).toContain("Calorie-deficit slider: 15%");
    const json = JSON.parse((await call(c, "kcalrep_get_profile", { response_format: "json" })).text);
    expect(json.norm.tdee).toBe(2400);
    expect(json.name).toBe("Тест");
  });

  it("hides the placeholder BMR/TDEE/goal of manually typed targets instead of reporting them as real", async () => {
    const c = await connect(manualDb());
    const json = JSON.parse((await call(c, "kcalrep_get_profile", { response_format: "json" })).text);
    expect(json.norm).toMatchObject({ calories: 1850, mode: "manual", energyEstimated: false, bmr: null, tdee: null, goalMultiplier: null });
    expect(json.goalAdjustment).toBeNull();
    const md = (await call(c, "kcalrep_get_profile")).text;
    expect(md).toContain("MANUAL");
    expect(md).toContain("not available");
    expect(md).not.toContain("maintenance");
  });

  it("never exposes an e-mail address", async () => {
    const c = await connect();
    const { text } = await call(c, "kcalrep_get_profile", { response_format: "json" });
    expect(text).not.toMatch(/email|@/i);
  });
});

describe("kcalrep_get_weight_history", () => {
  it("lists weigh-ins, body composition and the overall change", async () => {
    const c = await connect();
    const { text } = await call(c, "kcalrep_get_weight_history");
    expect(text).toContain("82 → 81.6 kg (-0.4 kg)");
    expect(text).toContain("21.5");
  });
});

describe("error handling", () => {
  const failing = (error: unknown) =>
    fakeDb({
      getDiary: async () => {
        throw error;
      },
    });

  it("turns a Firestore permission error into setup instructions", async () => {
    const c = await connect(failing(Object.assign(new Error("7 PERMISSION_DENIED: Missing or insufficient permissions."), { code: 7 })));
    const { isError, text } = await call(c, "kcalrep_get_diary");
    expect(isError).toBe(true);
    expect(text).toContain("Cloud Datastore Viewer");
  });

  it("turns missing credentials into setup instructions", async () => {
    const c = await connect(failing(new Error("Could not load the default credentials.")));
    const { isError, text } = await call(c, "kcalrep_get_diary");
    expect(isError).toBe(true);
    expect(text).toContain("KCALREP_SERVICE_ACCOUNT_KEY");
  });

  it("recognises the error Google's client raises when no credentials or project are configured", async () => {
    const c = await connect(failing(new Error("Unable to detect a Project Id in the current environment.")));
    const { isError, text } = await call(c, "kcalrep_get_diary");
    expect(isError).toBe(true);
    expect(text).toContain("KCALREP_SERVICE_ACCOUNT_KEY");
  });

  it("passes unknown errors through instead of hiding them", async () => {
    const c = await connect(failing(new Error("boom")));
    const { isError, text } = await call(c, "kcalrep_get_diary");
    expect(isError).toBe(true);
    expect(text).toContain("boom");
  });

  it("applies to the report tool too", async () => {
    const c = await connect(failing(Object.assign(new Error("PERMISSION_DENIED"), { code: 7 })));
    const { isError, text } = await call(c, "kcalrep_get_report");
    expect(isError).toBe(true);
    expect(text).toContain("Cloud Datastore Viewer");
  });
});

describe("output size", () => {
  it("shrinks oversized diary output to fit the limit and says so", async () => {
    const many = Array.from({ length: 500 }, (_, i) => ({
      id: String(i),
      date: "2026-09-19",
      addedAt: NOW.getTime(),
      name: `Очень длинное название продукта номер ${i} `.repeat(4),
      grams: 100,
      calories: 100,
      protein: 1,
      fat: 1,
      carbs: 1,
    }));
    const c = await connect(fakeDb({ getDiary: async () => many }));
    const { text } = await call(c, "kcalrep_get_diary", { limit: 500, response_format: "json" });
    expect(text.length).toBeLessThanOrEqual(40_000);
    const data = JSON.parse(text);
    expect(data.count).toBeLessThan(500);
    expect(data.hasMore).toBe(true);
    expect(data.nextOffset).toBe(data.count);
    expect(data.note).toMatch(/cut to fit/);
  });
});

describe("what the server can reach", () => {
  it("the Firestore source never calls a write API", () => {
    const code = codeOf("firestore-source.ts");
    for (const forbidden of [".set(", ".add(", ".update(", ".delete(", ".create(", ".batch(", ".bulkWriter(", ".runTransaction(", ".recursiveDelete("]) {
      expect(code, `firestore-source.ts must not use ${forbidden}`).not.toContain(forbidden);
    }
  });

  it("the DataSource interface is exactly the data the site's export uses, all read-only", () => {
    const methods = [...sourceOf("data-source.ts").matchAll(/^\s{2}(\w+)\(/gm)].map((m) => m[1]).sort();
    expect(methods).toEqual([
      "getActivity",
      "getBodyComposition",
      "getDiary",
      "getNorm",
      "getNormHistory",
      "getProfile",
      "getSettings",
      "getWeight",
    ]);
  });

  it("never reads data the user chose to keep out: cycle tracking, product/recipe catalogue, usage stats", () => {
    const code = codeOf("firestore-source.ts");
    for (const excluded of ["cycles", "daily_survey", "metabolic_config", "shared_products", "shared_recipes", "categories", "usage_stats"]) {
      expect(code, `firestore-source.ts must not touch "${excluded}"`).not.toContain(excluded);
    }
  });

  it("reads only under users/{uid}, never another top-level collection", () => {
    const collections = [...codeOf("firestore-source.ts").matchAll(/\.collection\(\s*"([^"]+)"/g)].map((m) => m[1]);
    expect([...new Set(collections)]).toEqual(["users"]);
  });
});
