import {
  doc,
  setDoc,
  getDoc,
  collection,
  addDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  getDocs,
  Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import type { MacroResult } from "./nutrition";
import type { DiaryEntry } from "./storage";

export interface UserProfile {
  name: string;
  email: string;
  createdAt: Timestamp;
}

export interface NormData {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  bmr: number;
  tdee: number;
  activityFactor: number;
  activityLabel: string;
  updatedAt: Timestamp;
}

// Profile functions
export async function saveUserProfile(userId: string, profile: Omit<UserProfile, 'createdAt'>) {
  const userDoc = doc(db, "users", userId, "profile", "main");
  const profileWithTimestamp = {
    ...profile,
    createdAt: Timestamp.now(),
  };
  await setDoc(userDoc, profileWithTimestamp);
}

export async function loadUserProfile(userId: string): Promise<UserProfile | null> {
  const userDoc = doc(db, "users", userId, "profile", "main");
  const docSnap = await getDoc(userDoc);
  
  if (docSnap.exists()) {
    return docSnap.data() as UserProfile;
  }
  return null;
}

// Norm functions
export async function saveNorm(userId: string, norm: MacroResult) {
  const normDoc = doc(db, "users", userId, "norm", "main");
  const normData: NormData = {
    calories: norm.calories,
    protein: norm.protein,
    fat: norm.fat,
    carbs: norm.carbs,
    bmr: norm.bmr,
    tdee: norm.tdee,
    activityFactor: norm.activityFactor,
    activityLabel: norm.activityLabel,
    updatedAt: Timestamp.now(),
  };
  await setDoc(normDoc, normData);
}

export async function loadNorm(userId: string): Promise<MacroResult | null> {
  const normDoc = doc(db, "users", userId, "norm", "main");
  const docSnap = await getDoc(normDoc);
  
  if (docSnap.exists()) {
    const data = docSnap.data() as NormData;
    return {
      calories: data.calories,
      protein: data.protein,
      fat: data.fat,
      carbs: data.carbs,
      bmr: data.bmr,
      tdee: data.tdee,
      activityFactor: data.activityFactor,
      activityLabel: data.activityLabel as any, // Convert string back to ActivityLevel
    };
  }
  return null;
}

// Diary functions
export async function saveDiaryEntry(userId: string, entry: Omit<DiaryEntry, 'id' | 'addedAt'>) {
  const diaryCollection = collection(db, "users", userId, "diary");
  const newEntry = {
    ...entry,
    addedAt: Timestamp.now(),
  };
  const docRef = await addDoc(diaryCollection, newEntry);
  return docRef.id;
}

export async function loadDiary(userId: string, date: string): Promise<DiaryEntry[]> {
  const diaryCollection = collection(db, "users", userId, "diary");
  const q = query(
    diaryCollection,
    where("date", "==", date),
    orderBy("addedAt", "desc")
  );
  
  const querySnapshot = await getDocs(q);
  const entries: DiaryEntry[] = [];
  
  querySnapshot.forEach((doc) => {
    const data = doc.data();
    entries.push({
      id: doc.id,
      foodId: data.foodId,
      name: data.name,
      grams: data.grams,
      calories: data.calories,
      protein: data.protein,
      fat: data.fat,
      carbs: data.carbs,
      date: data.date,
      addedAt: data.addedAt?.toMillis ? data.addedAt.toMillis() : (data.addedAt || Date.now()),
    });
  });
  
  return entries;
}

export async function deleteDiaryEntry(userId: string, entryId: string) {
  const entryDoc = doc(db, "users", userId, "diary", entryId);
  await deleteDoc(entryDoc);
}

// Helper function to update diary entry (if needed)
export async function updateDiaryEntry(userId: string, entryId: string, entry: Partial<DiaryEntry>) {
  const entryDoc = doc(db, "users", userId, "diary", entryId);
  const updateData: any = { ...entry };
  
  // Convert addedAt back to Timestamp if it's a number
  if (entry.addedAt && typeof entry.addedAt === 'number') {
    updateData.addedAt = Timestamp.fromMillis(entry.addedAt);
  }
  
  await setDoc(entryDoc, updateData, { merge: true });
}
