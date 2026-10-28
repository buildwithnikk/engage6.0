// PERSON A OWNS THIS FILE.
// postOrQueue() is the ONLY way the app writes to the server. Offline, the write
// goes into Dexie and flushes on reconnect — that is the airplane-mode demo.

import { db } from "./db";

export type PostResult<T> = { ok: true; data: T } | { ok: false; queued: boolean };

export async function postOrQueue<T>(route: string, body: unknown): Promise<PostResult<T>> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    await db?.queue.add({ route, body, createdAt: Date.now(), tries: 0 });
    return { ok: false, queued: true };
  }

  try {
    const res = await fetch(route, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(String(res.status));
    return { ok: true, data: (await res.json()) as T };
  } catch {
    await db?.queue.add({ route, body, createdAt: Date.now(), tries: 0 });
    return { ok: false, queued: true };
  }
}

export async function pendingCount(): Promise<number> {
  if (!db) return 0;
  return db.queue.count();
}

/** Drains the queue oldest-first. Called on 'online' and on app start. */
export async function flushQueue(): Promise<{ sent: number; failed: number }> {
  if (!db) return { sent: 0, failed: 0 };
  const items = await db.queue.orderBy("createdAt").toArray();
  let sent = 0;
  let failed = 0;

  for (const item of items) {
    try {
      const res = await fetch(item.route, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item.body),
      });
      if (!res.ok) throw new Error(String(res.status));
      await db.queue.delete(item.id!);
      sent++;
    } catch {
      await db.queue.update(item.id!, { tries: item.tries + 1 });
      failed++;
    }
  }

  return { sent, failed };
}

export function registerServiceWorker() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("/sw.js").catch(() => {
    /* dev mode without https — ignore */
  });
}
