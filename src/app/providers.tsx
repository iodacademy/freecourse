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

// Cek apakah elemen yang gagal load adalah aset Next.js (chunk JS/CSS).
// Kita hanya peduli aset dari /_next/static/* supaya tidak salah reload
// gara-gara gambar/iframe pihak ketiga yang gagal load.
function isNextAssetFailure(target: EventTarget | null): boolean {
  if (!target || !(target instanceof Element)) return false;
  const tag = target.tagName;
  let url = "";
  if (tag === "LINK") {
    url = (target as HTMLLinkElement).href || "";
    const rel = (target as HTMLLinkElement).rel || "";
    if (!rel.includes("stylesheet") && !rel.includes("preload")) return false;
  } else if (tag === "SCRIPT") {
    url = (target as HTMLScriptElement).src || "";
  } else {
    return false;
  }
  return url.includes("/_next/static/");
}

export default function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Handler 1 — JS error & ChunkLoadError yang bubble ke window.
    const handleError = (event: ErrorEvent) => {
      // (a) Resource load failure (link/script tag) — pakai capture phase.
      //     event.message biasanya kosong untuk resource error, tapi event.target
      //     menunjuk ke elemen yang gagal.
      if (isNextAssetFailure(event.target)) {
        if (shouldAutoReload()) window.location.reload();
        return;
      }
      // (b) JS runtime error dengan pesan chunk load fail.
      const msg = event.message || event.error?.message || "";
      if (isChunkErrorMessage(msg) && shouldAutoReload()) {
        window.location.reload();
      }
    };

    // Handler 2 — Promise rejection (dynamic import yang gagal).
    const handleRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const msg = reason?.message || (typeof reason === "string" ? reason : "");
      if (isChunkErrorMessage(msg) && shouldAutoReload()) {
        window.location.reload();
      }
    };

    // Capture phase = true → menangkap resource load failure dari child element
    // (CSS link, script src) yang TIDAK bubble ke window pada phase bubble.
    window.addEventListener("error", handleError, true);
    window.addEventListener("unhandledrejection", handleRejection);
    return () => {
      window.removeEventListener("error", handleError, true);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, []);

  return <AuthProvider>{children}</AuthProvider>;
}
