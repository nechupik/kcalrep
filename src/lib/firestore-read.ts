import {
  getDoc,
  getDocFromCache,
  getDocs,
  getDocsFromCache,
  type DocumentData,
  type DocumentReference,
  type DocumentSnapshot,
  type Query,
  type QuerySnapshot,
} from "firebase/firestore";

/** Without an answer from the server for this long, serve the on-device copy if there is one. */
export const STALL_MS = 4000;
/** Without any answer for this long, fail so the UI can show an error instead of spinning forever. */
export const DEADLINE_MS = 15000;

export class FirestoreTimeoutError extends Error {
  constructor() {
    super("Firestore request timed out");
    this.name = "FirestoreTimeoutError";
  }
}

const STALLED = Symbol("stalled");

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function isOfflineError(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  return code === "unavailable" || code === "deadline-exceeded";
}

async function readWithCacheFallback<T>(
  fromServer: Promise<T>,
  fromCache: () => Promise<T | null>
): Promise<T> {
  // Keep the server request running after we stop waiting for it: when it lands it refreshes the cache.
  fromServer.catch(() => undefined);

  let first: T | typeof STALLED;
  try {
    first = await Promise.race([fromServer, wait(STALL_MS).then((): typeof STALLED => STALLED)]);
  } catch (error) {
    if (!isOfflineError(error)) throw error;
    const cached = await fromCache();
    if (cached) return cached;
    throw error;
  }
  if (first !== STALLED) return first;

  const cached = await fromCache();
  if (cached) return cached;

  return Promise.race([
    fromServer,
    wait(DEADLINE_MS - STALL_MS).then((): never => {
      throw new FirestoreTimeoutError();
    }),
  ]);
}

/** `getDocs` that can't hang forever: falls back to the local cache when the server stalls, and eventually gives up. */
export function getDocsResilient<A = DocumentData, D extends DocumentData = DocumentData>(
  q: Query<A, D>
): Promise<QuerySnapshot<A, D>> {
  return readWithCacheFallback(getDocs(q), async () => {
    try {
      const snapshot = await getDocsFromCache(q);
      return snapshot.empty ? null : snapshot;
    } catch {
      return null;
    }
  });
}

/** `getDoc` that can't hang forever, see {@link getDocsResilient}. */
export function getDocResilient<A = DocumentData, D extends DocumentData = DocumentData>(
  ref: DocumentReference<A, D>
): Promise<DocumentSnapshot<A, D>> {
  return readWithCacheFallback(getDoc(ref), async () => {
    try {
      const snapshot = await getDocFromCache(ref);
      return snapshot.exists() ? snapshot : null;
    } catch {
      return null;
    }
  });
}
