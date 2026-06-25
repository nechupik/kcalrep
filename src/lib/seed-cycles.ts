import { saveCycleEntry, loadCycles, saveMetabolicConfig } from "./metabolic-firestore";
import { calculateCycleDurations, recalculateMetabolicConfig } from "./cycle-engine";
import type { CycleEntry } from "./metabolic-types";

const TARGET_USER_ID = "3DXd9soOLnSZj4Axhg7zWPef2lj2";

const CYCLE_DATA: Omit<CycleEntry, "id">[] = [
  { startDate: "2025-07-08", endDate: "2025-07-12", duration: 0, bleedingDays: 5, confirmed: true },
  { startDate: "2025-08-04", endDate: "2025-08-08", duration: 0, bleedingDays: 5, confirmed: true },
  { startDate: "2025-08-31", endDate: "2025-09-04", duration: 0, bleedingDays: 5, confirmed: true },
  { startDate: "2025-09-29", endDate: "2025-10-03", duration: 0, bleedingDays: 5, confirmed: true },
  { startDate: "2025-10-26", endDate: "2025-10-31", duration: 0, bleedingDays: 6, confirmed: true },
  { startDate: "2025-11-24", endDate: "2025-11-28", duration: 0, bleedingDays: 5, confirmed: true },
  { startDate: "2025-12-21", endDate: "2025-12-25", duration: 0, bleedingDays: 5, confirmed: true },
  { startDate: "2026-01-19", endDate: "2026-01-23", duration: 0, bleedingDays: 5, confirmed: true },
  { startDate: "2026-02-16", endDate: "2026-02-21", duration: 0, bleedingDays: 6, confirmed: true },
  { startDate: "2026-03-15", endDate: "2026-03-19", duration: 0, bleedingDays: 5, confirmed: true },
  { startDate: "2026-04-11", endDate: "2026-04-15", duration: 0, bleedingDays: 5, confirmed: true },
  { startDate: "2026-05-08", endDate: "2026-05-12", duration: 0, bleedingDays: 5, confirmed: true },
];

export async function seedCyclesForUser(userId: string): Promise<{ added: number; skipped: number }> {
  if (userId !== TARGET_USER_ID) {
    throw new Error("Seed only allowed for target user");
  }

  // Check existing cycles to avoid duplicates
  const existing = await loadCycles(userId);
  const existingStarts = new Set(existing.map((c) => c.startDate));

  let added = 0;
  let skipped = 0;

  for (const cycle of CYCLE_DATA) {
    if (existingStarts.has(cycle.startDate)) {
      skipped++;
      continue;
    }
    await saveCycleEntry(userId, cycle);
    added++;
  }

  // Recalculate metabolic config
  const allCycles = await loadCycles(userId);
  const withDurations = calculateCycleDurations(allCycles);
  const config = recalculateMetabolicConfig(withDurations);
  await saveMetabolicConfig(userId, config);

  return { added, skipped };
}
