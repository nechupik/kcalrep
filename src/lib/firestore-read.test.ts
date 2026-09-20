import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sdk = vi.hoisted(() => ({
  getDocs: vi.fn(),
  getDocsFromCache: vi.fn(),
  getDoc: vi.fn(),
  getDocFromCache: vi.fn(),
}));

vi.mock("firebase/firestore", () => sdk);

import {
  DEADLINE_MS,
  FirestoreTimeoutError,
  STALL_MS,
  getDocResilient,
  getDocsResilient,
} from "./firestore-read";

const query = {} as never;
const never = () => new Promise<never>(() => undefined);
const snapshot = (label: string, empty = false) => ({ label, empty });

describe("getDocsResilient", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.values(sdk).forEach((mock) => mock.mockReset());
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the server result when it answers in time", async () => {
    sdk.getDocs.mockResolvedValue(snapshot("server"));

    await expect(getDocsResilient(query)).resolves.toEqual(snapshot("server"));
    expect(sdk.getDocsFromCache).not.toHaveBeenCalled();
  });

  it("serves the cached copy when the server stalls", async () => {
    sdk.getDocs.mockReturnValue(never());
    sdk.getDocsFromCache.mockResolvedValue(snapshot("cache"));

    const result = getDocsResilient(query);
    await vi.advanceTimersByTimeAsync(STALL_MS);

    await expect(result).resolves.toEqual(snapshot("cache"));
  });

  it("keeps waiting for the server when nothing is cached", async () => {
    sdk.getDocs.mockReturnValue(new Promise((resolve) => setTimeout(() => resolve(snapshot("server")), STALL_MS + 2000)));
    sdk.getDocsFromCache.mockResolvedValue(snapshot("cache", true));

    const result = getDocsResilient(query);
    await vi.advanceTimersByTimeAsync(STALL_MS + 2000);

    await expect(result).resolves.toEqual(snapshot("server"));
  });

  it("gives up with a timeout error after the deadline", async () => {
    sdk.getDocs.mockReturnValue(never());
    sdk.getDocsFromCache.mockResolvedValue(snapshot("cache", true));

    const result = expect(getDocsResilient(query)).rejects.toBeInstanceOf(FirestoreTimeoutError);
    await vi.advanceTimersByTimeAsync(DEADLINE_MS);

    await result;
  });

  it("falls back to the cache when the client reports it is offline", async () => {
    sdk.getDocs.mockRejectedValue({ code: "unavailable" });
    sdk.getDocsFromCache.mockResolvedValue(snapshot("cache"));

    await expect(getDocsResilient(query)).resolves.toEqual(snapshot("cache"));
  });

  it("rethrows real errors without consulting the cache", async () => {
    const denied = { code: "permission-denied" };
    sdk.getDocs.mockRejectedValue(denied);

    await expect(getDocsResilient(query)).rejects.toBe(denied);
    expect(sdk.getDocsFromCache).not.toHaveBeenCalled();
  });
});

describe("getDocResilient", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.values(sdk).forEach((mock) => mock.mockReset());
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("serves the cached document when the server stalls", async () => {
    const cached = { exists: () => true, label: "cache" };
    sdk.getDoc.mockReturnValue(never());
    sdk.getDocFromCache.mockResolvedValue(cached);

    const result = getDocResilient({} as never);
    await vi.advanceTimersByTimeAsync(STALL_MS);

    await expect(result).resolves.toBe(cached);
  });

  it("treats a missing cached document as a cache miss", async () => {
    sdk.getDoc.mockReturnValue(never());
    sdk.getDocFromCache.mockRejectedValue(new Error("not in cache"));

    const result = expect(getDocResilient({} as never)).rejects.toBeInstanceOf(FirestoreTimeoutError);
    await vi.advanceTimersByTimeAsync(DEADLINE_MS);

    await result;
  });
});
