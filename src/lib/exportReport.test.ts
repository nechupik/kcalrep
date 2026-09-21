import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateMarkdownReport } from "./exportReport";
import {
  loadActivityLogRange,
  loadActivityRange,
  loadDiaryRange,
  loadFullNormData,
  loadNormHistory,
  loadUserSettings,
  loadWeightRange,
} from "./firestore";
import { loadBodyCompositionInRange } from "./metabolic-firestore";

// Mock at the firestore.ts boundary, as the rest of the project does.
vi.mock("./firestore", () => ({
  loadDiaryRange: vi.fn(),
  loadWeightRange: vi.fn(),
  loadActivityRange: vi.fn(),
  loadActivityLogRange: vi.fn(),
  loadNormHistory: vi.fn(),
  loadFullNormData: vi.fn(),
  loadUserSettings: vi.fn(),
}));
vi.mock("./metabolic-firestore", () => ({ loadBodyCompositionInRange: vi.fn() }));

const stamp = {} as never;

beforeEach(() => {
  vi.mocked(loadDiaryRange).mockResolvedValue([]);
  vi.mocked(loadWeightRange).mockResolvedValue([]);
  vi.mocked(loadActivityRange).mockResolvedValue([
    { date: "2026-09-17", type: "calories", value: 400, caloriesBurned: 400, updatedAt: stamp },
  ]);
  vi.mocked(loadActivityLogRange).mockResolvedValue([
    { date: "2026-09-17", calories: 450, steps: 8200, updatedAt: stamp },
    { date: "2026-09-18", steps: 6100, updatedAt: stamp },
  ]);
  vi.mocked(loadNormHistory).mockResolvedValue([]);
  vi.mocked(loadFullNormData).mockResolvedValue(null);
  vi.mocked(loadUserSettings).mockResolvedValue(null);
  vi.mocked(loadBodyCompositionInRange).mockResolvedValue([]);
});

const report = async () => (await generateMarkdownReport("u1", "2026-09-16", "2026-09-19")).content;
const section = (text: string, from: string, to?: string) =>
  text.slice(text.indexOf(from), to ? text.indexOf(to) : undefined);

describe("generateMarkdownReport — section 7, hand-entered activity and steps", () => {
  it("lists every day of the period with kcal and steps, a dash for what was never entered", async () => {
    const lines = (await report()).split("\n");
    expect(lines).toContain("## 7. Активность и шаги (ручной ввод)");
    expect(lines).toContain("| Дата | Активность, ккал | Шаги |");
    expect(lines).toContain("| 16.09.2026 | — | — |");
    expect(lines).toContain("| 17.09.2026 | 450 | 8200 |");
    expect(lines).toContain("| 18.09.2026 | — | 6100 |");
    expect(lines).toContain("| 19.09.2026 | — | — |");
  });

  it("adds period averages over the days that have data", async () => {
    const lines = (await report()).split("\n");
    expect(lines).toContain("**Средняя активность за период (ручной ввод):** 450 ккал/день (1 дн. с данными)");
    expect(lines).toContain("**Средние шаги за период:** 7150 шагов/день (2 дн. с данными)");
  });

  it("keeps it apart from section 6 (Apple Watch), and says it is not used for the norm", async () => {
    const text = await report();
    const section6 = section(text, "## 6.", "## 7.");
    expect(section6).toContain("| 17.09.2026 | 400 | Apple Watch |");
    expect(section6).not.toContain("450");
    expect(section6).not.toContain("8200");
    expect(text).toContain("В расчёт нормы и TDEE не входит");
  });

  it("asks only for the requested period", async () => {
    await report();
    expect(loadActivityLogRange).toHaveBeenCalledWith("u1", "2026-09-16", "2026-09-19");
  });

  it("still prints the table, without averages, when nothing was entered", async () => {
    vi.mocked(loadActivityLogRange).mockResolvedValue([]);
    const text = await report();
    expect(text).toContain("| 17.09.2026 | — | — |");
    expect(text).not.toContain("(ручной ввод):**");
    expect(text).not.toContain("Средние шаги");
  });

  it("does not fail the whole export when the log cannot be read (e.g. rules not deployed yet)", async () => {
    vi.mocked(loadActivityLogRange).mockRejectedValue(Object.assign(new Error("denied"), { code: "permission-denied" }));
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const text = await report();

    expect(text).toContain("## 6. Активность и TDEE");
    expect(text).toContain("## 7. Активность и шаги (ручной ввод)");
    expect(text).toContain("_Не удалось загрузить данные ручного ввода, раздел пропущен._");
    expect(text).not.toContain("| Дата | Активность, ккал | Шаги |");
    expect(errorLog).toHaveBeenCalled();
    errorLog.mockRestore();
  });

  it("still fails when a core section cannot be read", async () => {
    vi.mocked(loadDiaryRange).mockRejectedValue(new Error("boom"));
    await expect(report()).rejects.toThrow("boom");
  });
});
