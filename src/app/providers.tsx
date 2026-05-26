"use client";

import { useEffect } from "react";
import { AuthProvider } from "@/contexts/AuthContext";

const RELOAD_COUNT_KEY = "__chunk_reload_count";
const RELOAD_TIMESTAMP_KEY = "__chunk_reload_ts";
const MAX_RELOADS = 2;
const RELOAD_WINDOW_MS = 30_000;

function shouldAutoReload(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const now = Date.now();
    const ts = parseInt(sessionStorage.getItem(RELOAD_TIMESTAMP_KEY) || "0", 10);
    let count = parseInt(sessionStorage.getItem(RELOAD_COUNT_KEY) || "0", 10);
    if (now - ts > RELOAD_WINDOW_MS) count = 0;
    if (count >= MAX_RELOADS) return false;
    sessionStorage.setItem(RELOAD_COUNT_KEY, String(count + 1));
    sessionStorage.setItem(RELOAD_TIMESTAMP_KEY, String(now));
    return true;
  } catch {
    return false;
  }
}

function isChunkErrorMessage(msg: string): boolean {
  if (!msg) return false;
  return (
    msg.includes("Failed to load chunk") ||
    msg.includes("Loading chunk") ||
    msg.includes("Loading CSS chunk") ||
    msg.includes("ChunkLoadError")
  );
}

export default function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Tangkap chunk load error yang lolos dari React error boundary —
    // contoh: prefetch <link> tag atau dynamic import yang gagal saat navigasi.
    const handleError = (event: ErrorEvent) => {
      const msg = event.message || event.error?.message || "";
      if (isChunkErrorMessage(msg) && shouldAutoReload()) {
        window.location.reload();
      }
    };
    const handleRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const msg = reason?.message || (typeof reason === "string" ? reason : "");
      if (isChunkErrorMessage(msg) && shouldAutoReload()) {
        window.location.reload();
      }
    };
    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);
    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, []);

  return <AuthProvider>{children}</AuthProvider>;
}
