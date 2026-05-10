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
  writeBatch,
  Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import type { MacroResult } from "./nutrition";
import type { DiaryEntry } from "./storage";

// IMPORTANT: Add these Firestore rules in Firebase Console:
// match /shared_products/{productId} {
//   allow read: if request.auth != null;
//   allow write: if request.auth != null && request.auth.uid == "irXSByiUKYg9S5g3UXF5xSXHijC3";
// }
// match /shared_recipes/{recipeId} {
//   allow read: if request.auth != null;
//   allow write: if request.auth != null && request.auth.uid == "irXSByiUKYg9S5g3UXF5xSXHijC3";
// }

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
  // Parameters for recalculation
  gender: 'male' | 'female';
  height: number;
  age: number;
  goal: string;
  goalMultiplier: number;
  updatedAt: Timestamp;
}

export interface WeightEntry {
  weight: number;
  date: string; // YYYY-MM-DD
  createdAt: Timestamp;
}

export interface ActivityEntry {
  date: string; // YYYY-MM-DD
  type: 'calories' | 'steps' | 'home';
  value: number; // calories for admin, steps for wife, 0 for home
  caloriesBurned: number; // calculated calories burned
  updatedAt: Timestamp;
}

export interface UserSettings {
  activityTrackingEnabled: boolean;
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
export async function saveNorm(userId: string, norm: MacroResult, params?: { gender: 'male' | 'female'; height: number; age: number; goal: string }) {
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
    gender: params?.gender || 'male',
    height: params?.height || 170,
    age: params?.age || 25,
    goal: params?.goal || 'maintain',
    goalMultiplier: norm.goalMultiplier,
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
      goalMultiplier: data.goalMultiplier,
    };
  }
  return null;
}

export async function loadFullNormData(userId: string): Promise<NormData | null> {
  const normDoc = doc(db, 'users', userId, 'norm', 'main');
  const docSnap = await getDoc(normDoc);
  if (docSnap.exists()) {
    return docSnap.data() as NormData;
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

// Weight tracking functions
export async function saveWeight(userId: string, weight: number, date: string) {
  const weightCollection = collection(db, "users", userId, "weight");
  const weightEntry: WeightEntry = {
    weight,
    date,
    createdAt: Timestamp.now(),
  };
  const docRef = await addDoc(weightCollection, weightEntry);
  return docRef.id;
}

export async function loadWeight(userId: string, limit?: number): Promise<Array<WeightEntry & { id: string }>> {
  const weightCollection = collection(db, "users", userId, "weight");
  const q = query(
    weightCollection,
    orderBy("date", "desc"),
    orderBy("createdAt", "desc")
  );
  
  const querySnapshot = await getDocs(q);
  const entries: Array<WeightEntry & { id: string }> = [];
  
  querySnapshot.forEach((doc) => {
    const data = doc.data() as WeightEntry;
    entries.push({
      id: doc.id,
      weight: data.weight,
      date: data.date,
      createdAt: data.createdAt,
    });
  });
  
  return limit ? entries.slice(0, limit) : entries;
}

export async function wasWeightEnteredThisWeek(userId: string): Promise<boolean> {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday...
  const monday = new Date(today);
  monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  const mondayStr = monday.toISOString().split('T')[0];
  const todayStr = today.toISOString().split('T')[0];

  const weightCol = collection(db, 'users', userId, 'weight');
  const q = query(
    weightCol,
    where('date', '>=', mondayStr),
    where('date', '<=', todayStr)
  );
  const snapshot = await getDocs(q);
  return snapshot.size > 0;
}

// Diary range loading function
export async function loadDiaryRange(userId: string, startDate: string, endDate: string): Promise<DiaryEntry[]> {
  const diaryCollection = collection(db, "users", userId, "diary");
  const q = query(
    diaryCollection,
    where("date", ">=", startDate),
    where("date", "<=", endDate),
    orderBy("date", "asc"),
    orderBy("addedAt", "asc")
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

// Usage tracking
export interface UsageStat {
  productId: string;
  productName: string;
  productType: 'product' | 'recipe';
  usageCount: number;
  lastUsedAt: Timestamp;
  avgAmount: number;
  lastAmount: number;
}

export async function updateUsageStat(
  userId: string,
  item: { id: string; name: string; type: 'product' | 'recipe'; amount: number }
) {
  const statDoc = doc(db, 'users', userId, 'usage_stats', item.id);
  const existing = await getDoc(statDoc);

  if (existing.exists()) {
    const data = existing.data() as UsageStat;
    const newCount = data.usageCount + 1;
    const newAvg = Math.round((data.avgAmount * data.usageCount + item.amount) / newCount);
    await setDoc(statDoc, {
      ...data,
      usageCount: newCount,
      lastUsedAt: Timestamp.now(),
      avgAmount: newAvg,
      lastAmount: item.amount,
    });
  } else {
    await setDoc(statDoc, {
      productId: item.id,
      productName: item.name,
      productType: item.type,
      usageCount: 1,
      lastUsedAt: Timestamp.now(),
      avgAmount: item.amount,
      lastAmount: item.amount,
    });
  }
}

export async function loadUsageStats(userId: string): Promise<UsageStat[]> {
  const statsCollection = collection(db, 'users', userId, 'usage_stats');
  const q = query(statsCollection, orderBy('usageCount', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data() as UsageStat);
}

export async function getLastAmount(userId: string, productId: string): Promise<number | null> {
  const statDoc = doc(db, 'users', userId, 'usage_stats', productId);
  const snap = await getDoc(statDoc);
  if (snap.exists()) {
    return (snap.data() as UsageStat).lastAmount;
  }
  return null;
}

// Shared products (readable by all users)
export async function loadSharedProducts(): Promise<any[]> {
  const sharedCol = collection(db, "shared_products");
  const q = query(sharedCol, orderBy("name", "asc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
}

export async function loadSharedRecipes(): Promise<any[]> {
  const sharedCol = collection(db, "shared_recipes");
  const q = query(sharedCol, orderBy("name", "asc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
}

export async function saveSharedProduct(product: any): Promise<string> {
  const sharedCol = collection(db, "shared_products");
  const docRef = await addDoc(sharedCol, {
    ...product,
    createdAt: Timestamp.now(),
  });
  return docRef.id;
}

export async function saveSharedRecipe(recipe: any): Promise<string> {
  const sharedCol = collection(db, "shared_recipes");
  const docRef = await addDoc(sharedCol, {
    ...recipe,
    createdAt: Timestamp.now(),
  });
  return docRef.id;
}

export async function deleteSharedProduct(productId: string): Promise<void> {
  await deleteDoc(doc(db, "shared_products", productId));
}

export async function deleteSharedRecipe(recipeId: string): Promise<void> {
  await deleteDoc(doc(db, "shared_recipes", recipeId));
}

// Activity tracking functions
export async function saveActivity(userId: string, entry: Omit<ActivityEntry, 'updatedAt'>): Promise<void> {
  const activityDoc = doc(db, 'users', userId, 'activity', entry.date);
  await setDoc(activityDoc, {
    ...entry,
    updatedAt: Timestamp.now(),
  });
}

export async function loadActivity(userId: string, date: string): Promise<ActivityEntry | null> {
  const activityDoc = doc(db, 'users', userId, 'activity', date);
  const snap = await getDoc(activityDoc);
  if (snap.exists()) return snap.data() as ActivityEntry;
  return null;
}

export async function loadActivityRange(userId: string, startDate: string, endDate: string): Promise<ActivityEntry[]> {
  const activityCol = collection(db, 'users', userId, 'activity');
  const q = query(activityCol, where('date', '>=', startDate), where('date', '<=', endDate));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data() as ActivityEntry);
}

export async function saveUserSettings(userId: string, settings: Omit<UserSettings, 'updatedAt'>): Promise<void> {
  const settingsDoc = doc(db, 'users', userId, 'settings', 'main');
  await setDoc(settingsDoc, {
    ...settings,
    updatedAt: Timestamp.now(),
  });
}

export async function loadUserSettings(userId: string): Promise<UserSettings | null> {
  const settingsDoc = doc(db, 'users', userId, 'settings', 'main');
  const snap = await getDoc(settingsDoc);
  if (snap.exists()) return snap.data() as UserSettings;
  return null;
}

// Admin functions for deleting all user data
export async function deleteAllDiaryEntries(): Promise<{ deleted: number; error?: string }> {
  try {
    const usersSnap = await getDocs(collection(db, 'users'));
    let totalDeleted = 0;

    for (const userDoc of usersSnap.docs) {
      const diarySnap = await getDocs(collection(db, 'users', userDoc.id, 'diary'));
      const batch = writeBatch(db);
      
      diarySnap.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      if (diarySnap.size > 0) {
        await batch.commit();
        totalDeleted += diarySnap.size;
      }
    }
    
    return { deleted: totalDeleted };
  } catch (error) {
    console.error('Error deleting all diary entries:', error);
    return { deleted: 0, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function deleteAllProducts(): Promise<{ deleted: number; error?: string }> {
  try {
    const productsSnap = await getDocs(collection(db, 'shared_products'));
    const batch = writeBatch(db);
    
    productsSnap.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    if (productsSnap.size > 0) {
      await batch.commit();
    }
    
    return { deleted: productsSnap.size };
  } catch (error) {
    console.error('Error deleting all products:', error);
    return { deleted: 0, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function deleteAllRecipes(): Promise<{ deleted: number; error?: string }> {
  try {
    const recipesSnap = await getDocs(collection(db, 'shared_recipes'));
    const batch = writeBatch(db);
    
    recipesSnap.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    if (recipesSnap.size > 0) {
      await batch.commit();
    }
    
    return { deleted: recipesSnap.size };
  } catch (error) {
    console.error('Error deleting all recipes:', error);
    return { deleted: 0, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function deleteAllWeight(): Promise<{ deleted: number; error?: string }> {
  try {
    const usersSnap = await getDocs(collection(db, 'users'));
    let totalDeleted = 0;

    for (const userDoc of usersSnap.docs) {
      const weightSnap = await getDocs(collection(db, 'users', userDoc.id, 'weight'));
      const batch = writeBatch(db);
      
      weightSnap.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      if (weightSnap.size > 0) {
        await batch.commit();
        totalDeleted += weightSnap.size;
      }
    }
    
    return { deleted: totalDeleted };
  } catch (error) {
    console.error('Error deleting all weight entries:', error);
    return { deleted: 0, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function deleteAllNormData(): Promise<{ deleted: number; error?: string }> {
  try {
    const usersSnap = await getDocs(collection(db, 'users'));
    let totalDeleted = 0;

    for (const userDoc of usersSnap.docs) {
      const normDoc = doc(db, 'users', userDoc.id, 'norm', 'main');
      const normSnap = await getDoc(normDoc);
      
      if (normSnap.exists()) {
        await deleteDoc(normDoc);
        totalDeleted++;
      }
    }
    
    return { deleted: totalDeleted };
  } catch (error) {
    console.error('Error deleting all norm data:', error);
    return { deleted: 0, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function deleteAllActivityData(): Promise<{ deleted: number; error?: string }> {
  try {
    const usersSnap = await getDocs(collection(db, 'users'));
    let totalDeleted = 0;

    for (const userDoc of usersSnap.docs) {
      const activitySnap = await getDocs(collection(db, 'users', userDoc.id, 'activity'));
      const batch = writeBatch(db);
      
      activitySnap.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      if (activitySnap.size > 0) {
        await batch.commit();
        totalDeleted += activitySnap.size;
      }
    }
    
    return { deleted: totalDeleted };
  } catch (error) {
    console.error('Error deleting all activity data:', error);
    return { deleted: 0, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
