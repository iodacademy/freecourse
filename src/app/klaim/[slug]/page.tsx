"use client";

import { useEffect, useState, use } from "react";

interface EventInfo {
  title: string;
  workshopDate?: string;
  workshopDay?: string;
  workshopTime?: string;
  speakerName?: string;
}

function formatID(iso?: string) {
  if (!iso) return "";
  try { return new Date(iso + "T00:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }); }
  catch { return iso; }
}

export default function KlaimSertifikatPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [info, setInfo] = useState<EventInfo | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ downloadUrl: string; name: string } | null>(null);

  useEffect(() => {
    fetch(`/api/public/cert-events/${encodeURIComponent(slug)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setInfo)
      .catch(() => setNotFound(true));
  }, [slug]);

  async function claim() {
    if (!name.trim()) { setError("Isi nama dulu ya."); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch(`/api/public/cert-events/${encodeURIComponent(slug)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Gagal klaim sertifikat."); return; }
      setResult({ downloadUrl: data.downloadUrl, name: data.name });
    } catch { setError("Terjadi kesalahan jaringan."); }
    finally { setLoading(false); }
  }

  const wrap: React.CSSProperties = { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f5f5", padding: 20, fontFamily: "Arial, sans-serif" };
  const card: React.CSSProperties = { background: "#fff", borderRadius: 14, maxWidth: 480, width: "100%", padding: 32, boxShadow: "0 2px 20px rgba(0,0,0,0.08)" };

  if (notFound) return <div style={wrap}><div style={card}><h1 style={{ fontSize: 20, margin: 0 }}>Link tidak ditemukan</h1><p style={{ color: "#64748b" }}>Link klaim sertifikat ini tidak valid atau sudah dinonaktifkan.</p></div></div>;
  if (!info) return <div style={wrap}><div style={card}><p style={{ color: "#64748b" }}>Memuat...</p></div></div>;

  return (
    <div style={wrap}>
      <div style={card}>
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1, color: "#CC0000", textTransform: "uppercase" }}>Sertifikat Kehadiran</div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", margin: "6px 0 4px" }}>{info.title}</h1>
        {(info.workshopDate || info.speakerName) && (
          <p style={{ color: "#64748b", fontSize: 14, margin: "0 0 20px" }}>
            {[formatID(info.workshopDate), info.workshopTime, info.speakerName && `Pemateri: ${info.speakerName}`].filter(Boolean).join(" · ")}
          </p>
        )}

        {result ? (
          <div style={{ textAlign: "center", padding: "12px 0" }}>
            <div style={{ fontSize: 40 }}>🎉</div>
            <h2 style={{ fontSize: 18, margin: "8px 0" }}>Sertifikat siap, {result.name}!</h2>
            <a href={result.downloadUrl} target="_blank" rel="noopener noreferrer"
              style={{ display: "inline-block", background: "#CC0000", color: "#fff", textDecoration: "none", padding: "12px 24px", borderRadius: 8, fontWeight: 700, marginTop: 8 }}>
              Unduh Sertifikat
            </a>
            <p style={{ color: "#94a3b8", fontSize: 12, marginTop: 14 }}>Simpan/screenshot link unduhan ini.</p>
          </div>
        ) : (
          <>
            <label style={{ fontSize: 14, fontWeight: 600, color: "#334155" }}>Nama Lengkap (sesuai sertifikat)</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tulis nama lengkapmu"
              style={{ width: "100%", boxSizing: "border-box", marginTop: 6, padding: "12px 14px", borderRadius: 10, border: "1.5px solid #ddd", fontSize: 15 }}
              onKeyDown={(e) => e.key === "Enter" && claim()}
            />
            {error && <p style={{ color: "#b91c1c", fontSize: 13, marginTop: 8 }}>{error}</p>}
            <button
              onClick={claim}
              disabled={loading}
              style={{ width: "100%", marginTop: 16, background: loading ? "#cbd5e1" : "#CC0000", color: "#fff", border: "none", padding: "14px", borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: loading ? "wait" : "pointer" }}
            >
              {loading ? "Membuat sertifikat..." : "Klaim Sertifikat"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
