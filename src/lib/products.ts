import { doc, setDoc, collection, addDoc, getDocs, query, where, orderBy, deleteDoc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";

export interface Product {
  id: string;
  name: string;
  barcode?: string;
  brand?: string;
  calories: number;     // per 100g
  protein: number;      // per 100g
  fat: number;          // per 100g
  carbs: number;        // per 100g
  source: 'manual' | 'open_food_facts' | 'edited';
  verified: boolean;
  originalData?: object;
  createdAt: number;
}

export async function saveProduct(userId: string, product: Omit<Product, 'createdAt'> & { id?: string }) {
  if (!userId) throw new Error('Invalid user ID');
  
  // Remove id from data object - Firestore uses it as document key only
  const { id, ...productWithoutId } = product;
  const productData = { ...productWithoutId, createdAt: Date.now() };
  
  if (id) {
    // Update existing product using its id as document key
    const productRef = doc(db, "users", userId, "products", id);
    await setDoc(productRef, productData);
    return id;
  } else {
    // Create new product with auto-generated ID
    const docRef = await addDoc(collection(db, "users", userId, "products"), productData);
    return docRef.id;
  }
}

export async function loadProducts(userId: string): Promise<Product[]> {
  try {
    const productsQuery = query(
      collection(db, "users", userId, "products")
    );
    const querySnapshot = await getDocs(productsQuery);
    const products: Product[] = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      products.push({
        id: doc.id,  // Always use doc.id, never data.id
        name: data.name || "",
        barcode: data.barcode || "",
        calories: data.calories || 0,
        protein: data.protein || 0,
        fat: data.fat || 0,
        carbs: data.carbs || 0,
        source: data.source || 'manual',
        verified: data.verified || false,
        originalData: data.originalData,
        createdAt: data.createdAt || Date.now(),
      });
    });
    
    // Sort in JavaScript instead of using Firestore orderBy
    products.sort((a, b) => b.createdAt - a.createdAt);
    
    return products;
  } catch (error) {
    console.error("Error loading products:", error);
    return [];
  }
}

export async function searchProducts(userId: string, searchQuery: string): Promise<Product[]> {
  try {
    const productsQuery = query(
      collection(db, "users", userId, "products"),
      where("name", ">=", searchQuery)
    );
    const querySnapshot = await getDocs(productsQuery);
    const products: Product[] = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      products.push({
        id: doc.id,  // Always use doc.id, never data.id
        name: data.name || "",
        barcode: data.barcode || "",
        calories: data.calories || 0,
        protein: data.protein || 0,
        fat: data.fat || 0,
        carbs: data.carbs || 0,
        source: data.source || 'manual',
        verified: data.verified || false,
        originalData: data.originalData,
        createdAt: data.createdAt || Date.now(),
      });
    });
    
    return products;
  } catch (error) {
    console.error("Error searching products:", error);
    return [];
  }
}

export async function deleteProduct(userId: string, productId: string): Promise<void> {
  try {
    const productRef = doc(db, "users", userId, "products", productId);
    await deleteDoc(productRef);
  } catch (error) {
    console.error("Error deleting product:", error);
    throw error;
  }
}
