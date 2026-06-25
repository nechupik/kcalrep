import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, Timestamp, increment } from "firebase/firestore";
import { db } from "./firebase";

export interface RecipeIngredient {
  productId: string;
  productName: string;
  grams: number;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}

export interface Recipe {
  id: string;
  name: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  text?: string;
  servingType: 'grams' | 'portion'; // 'grams' = enter weight, 'portion' = fixed serving
  portionCalories?: number; // only used when servingType = 'portion'
  portionProtein?: number;
  portionFat?: number;
  portionCarbs?: number;
  totalGrams?: number; // total weight of all ingredients (for portion type)
  ingredients?: RecipeIngredient[]; // structured ingredients data for editing
  createdBy?: string;
  createdAt?: any;
  usageCount?: number;
}

export async function loadRecipes(): Promise<Recipe[]> {
  const col = collection(db, "shared_recipes");
  const q = query(col, orderBy("name", "asc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), usageCount: doc.data().usageCount || 0 } as Recipe));
}

function stripUndefined(obj: Record<string, any>): Record<string, any> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}

export async function saveRecipe(recipe: Omit<Recipe, 'id'>, userId: string): Promise<string> {
  const col = collection(db, "shared_recipes");
  const docRef = await addDoc(col, {
    ...stripUndefined(recipe as Record<string, any>),
    createdBy: userId,
    createdAt: Timestamp.now(),
    usageCount: 0,
  });
  return docRef.id;
}

export async function incrementRecipeUsage(recipeId: string): Promise<void> {
  const docRef = doc(db, "shared_recipes", recipeId);
  await updateDoc(docRef, { usageCount: increment(1) });
}

export async function updateRecipe(recipeId: string, recipe: Omit<Recipe, 'id'>): Promise<void> {
  const docRef = doc(db, "shared_recipes", recipeId);
  await updateDoc(docRef, { ...stripUndefined(recipe as Record<string, any>) });
}

export async function deleteRecipe(recipeId: string): Promise<void> {
  await deleteDoc(doc(db, "shared_recipes", recipeId));
}
