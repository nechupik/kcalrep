import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, Timestamp } from "firebase/firestore";
import { db } from "./firebase";

export interface Category {
  id: string;
  name: string;
  createdBy?: string;
  createdAt?: any;
}

export async function loadCategories(): Promise<Category[]> {
  const col = collection(db, "categories");
  const q = query(col, orderBy("name", "asc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category));
}

export async function saveCategory(category: Omit<Category, 'id'>, userId: string): Promise<string> {
  const col = collection(db, "categories");
  const docRef = await addDoc(col, {
    ...category,
    createdBy: userId,
    createdAt: Timestamp.now(),
  });
  return docRef.id;
}

export async function updateCategory(categoryId: string, category: Omit<Category, 'id'>): Promise<void> {
  const docRef = doc(db, "categories", categoryId);
  await updateDoc(docRef, { ...category });
}

export async function deleteCategory(categoryId: string): Promise<void> {
  await deleteDoc(doc(db, "categories", categoryId));
}
