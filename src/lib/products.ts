import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, Timestamp, increment } from "firebase/firestore";
import { db } from "./firebase";

export interface Product {
  id: string;
  name: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  category?: string;
  createdBy?: string;
  createdAt?: any;
  usageCount?: number;
}

export async function loadProducts(): Promise<Product[]> {
  const col = collection(db, "shared_products");
  const q = query(col, orderBy("name", "asc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), usageCount: doc.data().usageCount || 0 } as Product));
}

export async function saveProduct(product: Omit<Product, 'id'>, userId: string): Promise<string> {
  const col = collection(db, "shared_products");
  const docRef = await addDoc(col, {
    ...product,
    createdBy: userId,
    createdAt: Timestamp.now(),
    usageCount: 0,
  });
  return docRef.id;
}

export async function incrementProductUsage(productId: string): Promise<void> {
  const docRef = doc(db, "shared_products", productId);
  await updateDoc(docRef, { usageCount: increment(1) });
}

export async function updateProduct(productId: string, product: Omit<Product, 'id'>): Promise<void> {
  const docRef = doc(db, "shared_products", productId);
  await updateDoc(docRef, { ...product });
}

export async function deleteProduct(productId: string): Promise<void> {
  await deleteDoc(doc(db, "shared_products", productId));
}
