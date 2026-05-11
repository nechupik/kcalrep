import type { MacroResult } from "./nutrition";
import { getCurrentUser } from "./auth";
import { saveNorm as saveNormToFirestore, loadNorm as loadNormFromFirestore, saveDiaryEntry, loadDiary as loadDiaryFromFirestore, deleteDiaryEntry } from "./firestore";

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

export async function saveDiary(entries: DiaryEntry[]) {
  const user = getCurrentUser();
  console.log('saveDiary: Current user:', user?.uid);
  if (user) {
    try {
      // For Firestore, we need to handle entries individually
      // This is a simplified approach - in practice, you might want to sync changes
      // For now, we'll save all entries to Firestore
      const todayEntries = entries.filter(entry => entry.date === todayKey());
      console.log('saveDiary: Today entries to save:', todayEntries.length);
      
      // First, let's get existing entries for today to avoid duplicates
      const existingEntries = await loadDiaryFromFirestore(user.uid, todayKey());
      console.log('saveDiary: Existing entries in Firestore:', existingEntries.length);
      
      // Add new entries that don't exist
      for (const entry of todayEntries) {
        if (!entry.id || !existingEntries.find(e => e.id === entry.id)) {
          console.log('saveDiary: Saving entry to Firestore:', entry.name);
          await saveDiaryEntry(user.uid, {
            foodId: entry.foodId,
            name: entry.name,
            grams: entry.grams,
            calories: entry.calories,
            protein: entry.protein,
            fat: entry.fat,
            carbs: entry.carbs,
            date: entry.date,
          });
        }
      }
    } catch (error) {
      console.error("Failed to save diary to Firestore:", error);
      // Fallback to localStorage
      localStorage.setItem(DIARY_KEY, JSON.stringify(entries));
    }
  } else {
    localStorage.setItem(DIARY_KEY, JSON.stringify(entries));
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

export function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
