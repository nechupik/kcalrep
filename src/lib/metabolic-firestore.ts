import {
  doc,
  setDoc,
  getDoc,
  getDocs,
  addDoc,
  deleteDoc,
  updateDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import type {
  CycleEntry,
  DailySurvey,
  BodyCompositionEntry,
  MetabolicConfig,
} from "./metabolic-types";

// ==========================================
// Cycles  — users/{uid}/cycles/{cycleId}
// ==========================================

export async function saveCycleEntry(
  userId: string,
  entry: Omit<CycleEntry, "id">
): Promise<string> {
  const col = collection(db, "users", userId, "cycles");
  const docRef = await addDoc(col, {
    ...entry,
    createdAt: Timestamp.now(),
  });
  return docRef.id;
}

export async function updateCycleEntry(
  userId: string,
  cycleId: string,
  updates: Partial<Omit<CycleEntry, "id">>
): Promise<void> {
  const ref = doc(db, "users", userId, "cycles", cycleId);
  await updateDoc(ref, { ...updates, updatedAt: Timestamp.now() });
}

export async function deleteCycleEntry(
  userId: string,
  cycleId: string
): Promise<void> {
  await deleteDoc(doc(db, "users", userId, "cycles", cycleId));
}

export async function loadCycles(userId: string): Promise<CycleEntry[]> {
  const col = collection(db, "users", userId, "cycles");
  const q = query(col, orderBy("startDate", "desc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<CycleEntry, "id">),
  }));
}

export async function loadCyclesInRange(
  userId: string,
  startDate: string,
  endDate: string
): Promise<CycleEntry[]> {
  const col = collection(db, "users", userId, "cycles");
  const q = query(
    col,
    where("startDate", ">=", startDate),
    where("startDate", "<=", endDate),
    orderBy("startDate", "asc")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<CycleEntry, "id">),
  }));
}

// ==========================================
// Daily Survey — users/{uid}/daily_survey/{date}
// ==========================================

export async function saveDailySurvey(
  userId: string,
  survey: DailySurvey
): Promise<void> {
  const ref = doc(db, "users", userId, "daily_survey", survey.date);
  await setDoc(ref, {
    ...survey,
    updatedAt: Timestamp.now(),
  });
}

export async function loadDailySurvey(
  userId: string,
  date: string
): Promise<DailySurvey | null> {
  const ref = doc(db, "users", userId, "daily_survey", date);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const data = snap.data();
    return {
      date: data.date,
      hunger: data.hunger,
      energy: data.energy,
      cravings: data.cravings,
      waterRetention: data.waterRetention,
      mood: data.mood,
    };
  }
  return null;
}

export async function loadDailySurveysInRange(
  userId: string,
  startDate: string,
  endDate: string
): Promise<DailySurvey[]> {
  const col = collection(db, "users", userId, "daily_survey");
  const q = query(
    col,
    where("date", ">=", startDate),
    where("date", "<=", endDate),
    orderBy("date", "asc")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => {
    const data = d.data();
    return {
      date: data.date,
      hunger: data.hunger,
      energy: data.energy,
      cravings: data.cravings,
      waterRetention: data.waterRetention,
      mood: data.mood,
    };
  });
}

// ==========================================
// Body Composition — users/{uid}/body_composition/{entryId}
// ==========================================

export async function saveBodyComposition(
  userId: string,
  entry: Omit<BodyCompositionEntry, "id">
): Promise<string> {
  const col = collection(db, "users", userId, "body_composition");
  const docRef = await addDoc(col, {
    ...entry,
    createdAt: Timestamp.now(),
  });
  return docRef.id;
}

export async function updateBodyComposition(
  userId: string,
  entryId: string,
  updates: Partial<Omit<BodyCompositionEntry, "id">>
): Promise<void> {
  const ref = doc(db, "users", userId, "body_composition", entryId);
  await updateDoc(ref, { ...updates, updatedAt: Timestamp.now() });
}

export async function deleteBodyComposition(
  userId: string,
  entryId: string
): Promise<void> {
  await deleteDoc(doc(db, "users", userId, "body_composition", entryId));
}

export async function loadBodyComposition(
  userId: string,
  limitCount?: number
): Promise<BodyCompositionEntry[]> {
  const col = collection(db, "users", userId, "body_composition");
  const q = limitCount
    ? query(col, orderBy("date", "desc"), limit(limitCount))
    : query(col, orderBy("date", "desc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<BodyCompositionEntry, "id">),
  }));
}

export async function loadBodyCompositionInRange(
  userId: string,
  startDate: string,
  endDate: string
): Promise<BodyCompositionEntry[]> {
  const col = collection(db, "users", userId, "body_composition");
  const q = query(
    col,
    where("date", ">=", startDate),
    where("date", "<=", endDate),
    orderBy("date", "asc")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<BodyCompositionEntry, "id">),
  }));
}

// ==========================================
// Metabolic Config — users/{uid}/metabolic_config/main
// ==========================================

export async function saveMetabolicConfig(
  userId: string,
  config: MetabolicConfig
): Promise<void> {
  const ref = doc(db, "users", userId, "metabolic_config", "main");
  await setDoc(ref, {
    ...config,
    updatedAt: Date.now(),
  });
}

export async function loadMetabolicConfig(
  userId: string
): Promise<MetabolicConfig | null> {
  const ref = doc(db, "users", userId, "metabolic_config", "main");
  const snap = await getDoc(ref);
  if (snap.exists()) {
    return snap.data() as MetabolicConfig;
  }
  return null;
}
