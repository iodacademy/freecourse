"use client";

import { useEffect } from "react";

const RELOAD_COUNT_KEY = "__chunk_reload_count";
const RELOAD_TIMESTAMP_KEY = "__chunk_reload_ts";
const MAX_RELOADS = 2;
const RELOAD_WINDOW_MS = 30_000;

function isChunkLoadError(err: Error): boolean {
  if (!err) return false;
  if (err.name === "ChunkLoadError") return true;
  const msg = err.message || "";
  return (
    msg.includes("Failed to load chunk") ||
    msg.includes("Loading chunk") ||
    msg.includes("Loading CSS chunk") ||
    msg.includes("ChunkLoadError")
  );
}

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

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (isChunkLoadError(error) && shouldAutoReload()) {
      window.location.reload();
    }
  }, [error]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
        gap: 16,
        padding: 24,
        textAlign: "center",
      }}
    >
      <h2 style={{ margin: 0, fontSize: 20, color: "#333" }}>
        Terjadi gangguan saat memuat halaman
      </h2>
      <p style={{ margin: 0, color: "#666", maxWidth: 420 }}>
        Halaman gagal dimuat. Silakan klik tombol di bawah untuk mencoba lagi.
      </p>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={() => {
            try {
              sessionStorage.removeItem(RELOAD_COUNT_KEY);
              sessionStorage.removeItem(RELOAD_TIMESTAMP_KEY);
            } catch {}
            window.location.reload();
          }}
          style={{
            padding: "10px 20px",
            borderRadius: 6,
            background: "#cc0000",
            color: "white",
            border: "none",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Muat Ulang Halaman
        </button>
        <button
          onClick={() => reset()}
          style={{
            padding: "10px 20px",
            borderRadius: 6,
            background: "transparent",
            color: "#333",
            border: "1px solid #ccc",
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          Coba Lagi
        </button>
      </div>
    </div>
  );
}
