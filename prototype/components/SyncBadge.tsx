"use client";

// PERSON A OWNS THIS FILE. This badge IS the airplane-mode demo — keep it visible.

import { useEffect, useState } from "react";
import { Cloud, CloudOff, RefreshCw } from "lucide-react";
import { flushQueue, pendingCount, registerServiceWorker } from "@/lib/offline";

export default function SyncBadge() {
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const refresh = async () => setPending(await pendingCount());

  useEffect(() => {
    registerServiceWorker();
    setOnline(navigator.onLine);
    refresh();

    const onOnline = async () => {
      setOnline(true);
      setSyncing(true);
      await flushQueue();
      setSyncing(false);
      refresh();
    };
    const onOffline = () => setOnline(false);

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    const timer = setInterval(refresh, 3000);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      clearInterval(timer);
    };
  }, []);

  const tone = !online ? "bg-amber-100 text-amber-900" : pending ? "bg-blue-100 text-blue-900" : "bg-emerald-100 text-emerald-900";

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${tone}`}>
      {syncing ? (
        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
      ) : online ? (
        <Cloud className="h-3.5 w-3.5" />
      ) : (
        <CloudOff className="h-3.5 w-3.5" />
      )}
      {!online ? "ऑफ़लाइन" : pending ? `${pending} भेजना है` : "सिंक"}
    </span>
  );
}
