import { Firestore, type DocumentData } from "@google-cloud/firestore";
import type { DataSource } from "./data-source.js";
import {
  toActivity,
  toActivityLog,
  toBodyComposition,
  toDiaryEntry,
  toNorm,
  toNormSnapshot,
  toUserProfile,
  toUserSettings,
  toWeightEntry,
} from "./models.js";

/**
 * Firestore-backed DataSource. Only `.get()` reads are used here — no set/add/update/delete —
 * and the recommended service account carries the read-only "Cloud Datastore Viewer" role,
 * so writes are impossible at the IAM level too.
 *
 * Note that role covers the whole database: what this server can reach is limited by the code
 * (this file), not by IAM. Every read below is scoped to `users/{uid}/…` for one fixed UID.
 *
 * Range queries filter and order on a single field, which Firestore indexes automatically,
 * so no composite indexes are needed (unlike the web app's own queries).
 */
export class FirestoreSource implements DataSource {
  private readonly db: Firestore;

  constructor(
    private readonly uid: string,
    keyFilename?: string,
  ) {
    this.db = new Firestore(keyFilename ? { keyFilename } : {});
  }

  private userCollection(name: string) {
    return this.db.collection("users").doc(this.uid).collection(name);
  }

  private async userDoc(collection: string, id: string): Promise<DocumentData | null> {
    const snap = await this.userCollection(collection).doc(id).get();
    return snap.exists ? (snap.data() ?? null) : null;
  }

  private async byDateRange(collection: string, field: string, start: string, end: string) {
    const snap = await this.userCollection(collection).where(field, ">=", start).where(field, "<=", end).get();
    return snap.docs.map((d) => ({ id: d.id, data: d.data() }));
  }

  async getProfile() {
    const d = await this.userDoc("profile", "main");
    return d ? toUserProfile(d) : null;
  }

  async getNorm() {
    const d = await this.userDoc("norm", "main");
    return d ? toNorm(d) : null;
  }

  async getSettings() {
    const d = await this.userDoc("settings", "main");
    return d ? toUserSettings(d) : null;
  }

  async getDiary(start: string, end: string) {
    const rows = await this.byDateRange("diary", "date", start, end);
    return rows
      .map((r) => toDiaryEntry(r.id, r.data))
      .sort((a, b) => a.date.localeCompare(b.date) || (a.addedAt ?? 0) - (b.addedAt ?? 0));
  }

  async getWeight(start: string, end: string) {
    const rows = await this.byDateRange("weight", "date", start, end);
    return rows
      .map((r) => toWeightEntry(r.data))
      .sort((a, b) => a.date.localeCompare(b.date) || (a.createdAt ?? 0) - (b.createdAt ?? 0));
  }

  async getBodyComposition(start: string, end: string) {
    const rows = await this.byDateRange("body_composition", "date", start, end);
    return rows.map((r) => toBodyComposition(r.data)).sort((a, b) => a.date.localeCompare(b.date));
  }

  async getActivity(start: string, end: string) {
    const rows = await this.byDateRange("activity", "date", start, end);
    return rows.map((r) => toActivity(r.data)).sort((a, b) => a.date.localeCompare(b.date));
  }

  async getActivityLog(start: string, end: string) {
    const rows = await this.byDateRange("activityLog", "date", start, end);
    return rows.map((r) => toActivityLog(r.data)).sort((a, b) => a.date.localeCompare(b.date));
  }

  async getNormHistory(start: string, end: string) {
    const [inRange, before] = await Promise.all([
      this.byDateRange("normHistory", "date", start, end),
      this.userCollection("normHistory").where("date", "<", start).orderBy("date", "desc").limit(1).get(),
    ]);
    return [...before.docs.map((d) => d.data()), ...inRange.map((r) => r.data)]
      .map(toNormSnapshot)
      .sort((a, b) => a.date.localeCompare(b.date));
  }
}
