import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, Timestamp } from "firebase/firestore";
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
  ingredients?: RecipeIngredient[]; // structured ingredients data for editing
  createdBy?: string;
  createdAt?: any;
}

export async function loadRecipes(): Promise<Recipe[]> {
  const col = collection(db, "shared_recipes");
  const q = query(col, orderBy("name", "asc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Recipe));
}

export async function saveRecipe(recipe: Omit<Recipe, 'id'>, userId: string): Promise<string> {
  const col = collection(db, "shared_recipes");
  const docRef = await addDoc(col, {
    ...recipe,
    createdBy: userId,
    createdAt: Timestamp.now(),
  });
  return docRef.id;
}

export async function updateRecipe(recipeId: string, recipe: Omit<Recipe, 'id'>): Promise<void> {
  const docRef = doc(db, "shared_recipes", recipeId);
  await updateDoc(docRef, { ...recipe });
}

export async function deleteRecipe(recipeId: string): Promise<void> {
  await deleteDoc(doc(db, "shared_recipes", recipeId));
}
