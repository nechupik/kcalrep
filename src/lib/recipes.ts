// Recipes Firestore functions
import { db } from "./firebase";
import { collection, doc, addDoc, getDocs, updateDoc, deleteDoc, query, orderBy } from "firebase/firestore";

export interface Recipe {
  id?: string;
  name: string;
  calories: number;    // per 100g
  protein: number;     // per 100g
  fat: number;         // per 100g
  carbs: number;       // per 100g
  description: string; // recipe instructions
  createdAt: number;
  updatedAt: number;
}

// Save a recipe to Firestore
export async function saveRecipe(userId: string, recipe: Omit<Recipe, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const now = Date.now();
  const recipeWithTimestamp = {
    ...recipe,
    createdAt: now,
    updatedAt: now,
  };

  const docRef = await addDoc(collection(db, `users/${userId}/recipes`), recipeWithTimestamp);
  return docRef.id;
}

// Load all recipes for a user
export async function loadRecipes(userId: string): Promise<Recipe[]> {
  const q = query(
    collection(db, `users/${userId}/recipes`),
    orderBy('updatedAt', 'desc')
  );
  
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as Recipe[];
}

// Delete a recipe
export async function deleteRecipe(userId: string, recipeId: string): Promise<void> {
  await deleteDoc(doc(db, `users/${userId}/recipes/${recipeId}`));
}

// Update a recipe
export async function updateRecipe(userId: string, recipeId: string, recipe: Omit<Recipe, 'id' | 'createdAt'>): Promise<void> {
  const recipeWithTimestamp = {
    ...recipe,
    updatedAt: Date.now(),
  };
  
  await updateDoc(doc(db, `users/${userId}/recipes/${recipeId}`), recipeWithTimestamp);
}

// Search recipes by name
export async function searchRecipes(userId: string, query: string): Promise<Recipe[]> {
  const recipes = await loadRecipes(userId);
  const lowerQuery = query.toLowerCase();
  
  return recipes.filter(recipe => 
    recipe.name.toLowerCase().includes(lowerQuery)
  );
}
