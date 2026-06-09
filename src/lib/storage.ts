import type { MacroResult } from "./nutrition";
import { getCurrentUser } from "./auth";
import { saveNorm as saveNormToFirestore, loadNorm as loadNormFromFirestore, saveDiaryEntry, loadDiary as loadDiaryFromFirestore, deleteDiaryEntry, updateDiaryEntry as updateDiaryEntryInFirestore } from "./firestore";
import { loadCycles } from "./metabolic-firestore";
import { getCycleCalorieAdjustmentForDate } from "./cycle-engine";

const NORM_KEY = "kbju.norm";
const DIARY_KEY = "kbju.diary";

export interface DiaryEntry {
  id: string;
  foodId: string;
  name: string;
  grams: number;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  date: string; // YYYY-MM-DD
  addedAt: number;
}

export async function saveNorm(norm: MacroResult, params?: { gender: 'male' | 'female'; height: number; age: number; goal: string }) {
  const user = getCurrentUser();
  if (user) {
    try {
      await saveNormToFirestore(user.uid, norm, params);
    } catch (error) {
      console.error("Failed to save norm to Firestore:", error);
      // Fallback to localStorage
      localStorage.setItem(NORM_KEY, JSON.stringify(norm));
    }
  } else {
    localStorage.setItem(NORM_KEY, JSON.stringify(norm));
  }
}

export async function loadNorm(): Promise<MacroResult | null> {
  const user = getCurrentUser();
  if (user) {
    try {
      const norm = await loadNormFromFirestore(user.uid);
      if (norm) {
        return norm;
      }
    } catch (error) {
      console.error("Failed to load norm from Firestore:", error);
    }
    // Fallback to localStorage
  }
  
  try {
    const raw = localStorage.getItem(NORM_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function applyCycleAdjustmentToNorm(
  norm: MacroResult,
  adjustment: { calories: number; carbs: number; active: boolean }
): MacroResult {
  if (!adjustment.active) return norm;
  return {
    ...norm,
    calories: norm.calories + adjustment.calories,
    carbs: norm.carbs + adjustment.carbs,
  };
}

export async function loadEffectiveNorm(date?: string): Promise<MacroResult | null> {
  const norm = await loadNorm();
  const user = getCurrentUser();

  if (!user || !norm) return norm;

  try {
    const cycles = await loadCycles(user.uid);
    const adjustment = getCycleCalorieAdjustmentForDate(cycles, date);
    return applyCycleAdjustmentToNorm(norm, adjustment);
  } catch (error) {
    console.error("Failed to apply cycle adjustment to norm:", error);
    return norm;
  }
}

export async function loadDiary(date?: string): Promise<DiaryEntry[]> {
  const user = getCurrentUser();
  const targetDate = date || todayKey();
  
  if (user) {
    try {
      const entries = await loadDiaryFromFirestore(user.uid, targetDate);
      return entries;
    } catch (error) {
      console.error("Failed to load diary from Firestore:", error);
    }
    // Fallback to localStorage
  }
  
  try {
    const raw = localStorage.getItem(DIARY_KEY);
    const allEntries = raw ? JSON.parse(raw) : [];
    // Filter entries by date if date is provided
    return date ? allEntries.filter((entry: DiaryEntry) => entry.date === targetDate) : allEntries;
  } catch {
    return [];
  }
}

// Helper function to add a single diary entry
export async function addDiaryEntry(entry: Omit<DiaryEntry, 'id' | 'addedAt'>) {
  const user = getCurrentUser();
  if (user) {
    try {
      const entryId = await saveDiaryEntry(user.uid, entry);
      return entryId;
    } catch (error) {
      console.error("Failed to add diary entry to Firestore:", error);
      // Fallback to localStorage
      const entries = await loadDiary();
      const newEntry: DiaryEntry = {
        ...entry,
        id: Date.now().toString(),
        addedAt: Date.now(),
      };
      entries.push(newEntry);
      localStorage.setItem(DIARY_KEY, JSON.stringify(entries));
      return newEntry.id;
    }
  } else {
    // Fallback to localStorage
    const entries = await loadDiary();
    const newEntry: DiaryEntry = {
      ...entry,
      id: Date.now().toString(),
      addedAt: Date.now(),
    };
    entries.push(newEntry);
    localStorage.setItem(DIARY_KEY, JSON.stringify(entries));
    return newEntry.id;
  }
}

// Helper function to remove a diary entry
export async function removeDiaryEntry(entryId: string) {
  const user = getCurrentUser();
  if (user) {
    try {
      await deleteDiaryEntry(user.uid, entryId);
    } catch (error) {
      console.error("Failed to delete diary entry from Firestore:", error);
      // Fallback to localStorage
      const entries = await loadDiary();
      const filteredEntries = entries.filter(entry => entry.id !== entryId);
      localStorage.setItem(DIARY_KEY, JSON.stringify(filteredEntries));
    }
  } else {
    // Fallback to localStorage
    const entries = await loadDiary();
    const filteredEntries = entries.filter(entry => entry.id !== entryId);
    localStorage.setItem(DIARY_KEY, JSON.stringify(filteredEntries));
  }
}

// Helper function to update a diary entry
export async function updateDiaryEntry(entryId: string, updates: Partial<DiaryEntry>) {
  const user = getCurrentUser();
  if (user) {
    try {
      await updateDiaryEntryInFirestore(user.uid, entryId, updates);
    } catch (error) {
      console.error("Failed to update diary entry in Firestore:", error);
      // Fallback to localStorage
      const entries = await loadDiary();
      const entryIndex = entries.findIndex(entry => entry.id === entryId);
      if (entryIndex !== -1) {
        entries[entryIndex] = { ...entries[entryIndex], ...updates };
        localStorage.setItem(DIARY_KEY, JSON.stringify(entries));
      }
    }
  } else {
    // Fallback to localStorage
    const entries = await loadDiary();
    const entryIndex = entries.findIndex(entry => entry.id === entryId);
    if (entryIndex !== -1) {
      entries[entryIndex] = { ...entries[entryIndex], ...updates };
      localStorage.setItem(DIARY_KEY, JSON.stringify(entries));
    }
  }
}

export function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
