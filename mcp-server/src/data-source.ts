import type {
  ActivityEntry,
  ActivityLogEntry,
  BodyCompositionEntry,
  DiaryEntry,
  Norm,
  NormSnapshot,
  UserProfile,
  UserSettings,
  WeightEntry,
} from "./models.js";

/**
 * Everything the tools may ask of the database. Deliberately a small, read-only surface:
 * there is no method that writes, and none for data the tools don't expose (cycle tracking, the shared
 * product/recipe catalogue, other users). All reads are scoped to a single Firebase UID fixed at startup.
 */
export interface DataSource {
  getProfile(): Promise<UserProfile | null>;
  getNorm(): Promise<Norm | null>;
  getSettings(): Promise<UserSettings | null>;

  /** Entries with start <= date <= end, oldest first. */
  getDiary(start: string, end: string): Promise<DiaryEntry[]>;
  /** Weigh-ins in range, ordered by date then entry time. */
  getWeight(start: string, end: string): Promise<WeightEntry[]>;
  getBodyComposition(start: string, end: string): Promise<BodyCompositionEntry[]>;
  getActivity(start: string, end: string): Promise<ActivityEntry[]>;
  /** Hand-entered kcal/steps per day (site: «Активность и шаги»); unrelated to the norm. Oldest first. */
  getActivityLog(start: string, end: string): Promise<ActivityLogEntry[]>;
  /**
   * Norm snapshots in force during [start, end]: those dated inside the range plus the latest one dated
   * before `start` (which is what applied on day one). Oldest first. Used only to work out which targets
   * applied on each day of a summary; there is no tool that lists the history itself.
   */
  getNormHistory(start: string, end: string): Promise<NormSnapshot[]>;
}
