// PERSON A OWNS THIS FILE.
// Dexie does two jobs: (1) the offline write queue, (2) the model-response cache
// that keeps the demo off the 15 req/min free tier.

import Dexie, { type Table } from "dexie";

export type QueuedWrite = {
  id?: number;
  route: string;
  body: unknown;
  createdAt: number;
  tries: number;
};

export type CacheEntry = {
  key: string;
  value: unknown;
  at: number;
};

export type StoredProfile = {
  id: string; // always "me" — single-user device
  data: unknown;
};

class SahayakDB extends Dexie {
  queue!: Table<QueuedWrite, number>;
  cache!: Table<CacheEntry, string>;
  profile!: Table<StoredProfile, string>;

  constructor() {
    super("sahayak");
    this.version(1).stores({
      queue: "++id, route, createdAt",
      cache: "key, at",
      profile: "id",
    });
  }
}

export const db = typeof window === "undefined" ? (null as unknown as SahayakDB) : new SahayakDB();

export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!db) return null;
  const hit = await db.cache.get(key);
  return hit ? (hit.value as T) : null;
}

export async function cacheSet(key: string, value: unknown) {
  if (!db) return;
  await db.cache.put({ key, value, at: Date.now() });
}

export async function saveProfile(data: unknown) {
  if (!db) return;
  await db.profile.put({ id: "me", data });
}

export async function loadProfile<T>(): Promise<T | null> {
  if (!db) return null;
  const row = await db.profile.get("me");
  return row ? (row.data as T) : null;
}
