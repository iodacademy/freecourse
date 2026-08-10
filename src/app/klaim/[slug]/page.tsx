"use client";

import { useEffect, useState, use } from "react";
import { PROGRAM_LABELS, type CertProgram } from "@/lib/cert-programs";

interface ProgramInfo {
  title: string;
  date?: string;
  day?: string;
  time?: string;
  speakerName?: string;
}

interface EventInfo {
  title: string;
  programs: CertProgram[];
  detail: Record<string, ProgramInfo>;
}

interface ClaimResult {
  program: CertProgram;
  downloadUrl: string;
  name: string;
}

function formatID(iso?: string) {
  if (!iso) return "";
  try { return new Date(iso + "T00:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }); }
  catch { return iso; }
}

function subtitle(d?: ProgramInfo) {
  if (!d) return "";
  return [formatID(d.date), d.time, d.speakerName && `Pemateri: ${d.speakerName}`].filter(Boolean).join(" · ");
}

export default function KlaimSertifikatPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [info, setInfo] = useState<EventInfo | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [program, setProgram] = useState<CertProgram | null>(null);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [claimed, setClaimed] = useState<ClaimResult[]>([]);
  const [justClaimed, setJustClaimed] = useState<ClaimResult | null>(null);

  useEffect(() => {
    fetch(`/api/public/cert-events/${encodeURIComponent(slug)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: EventInfo) => {
        setInfo(data);
        // Satu program: lewati layar pemilihan / Single program: skip the picker
        if (data.programs?.length === 1) setProgram(data.programs[0]);
      })
      .catch(() => setNotFound(true));
  }, [slug]);

  async function claim() {
    if (!program) return;
    if (!name.trim()) { setError("Isi nama dulu ya."); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch(`/api/public/cert-events/${encodeURIComponent(slug)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), program }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Gagal klaim sertifikat."); return; }
      const result: ClaimResult = { program, downloadUrl: data.downloadUrl, name: data.name };
      setClaimed((cur) => [...cur.filter((c) => c.program !== program), result]);
      setJustClaimed(result);
    } catch { setError("Terjadi kesalahan jaringan."); }
    finally { setLoading(false); }
  }

  const wrap: React.CSSProperties = { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f5f5", padding: 20, fontFamily: "Arial, sans-serif" };
  const card: React.CSSProperties = { background: "#fff", borderRadius: 14, maxWidth: 480, width: "100%", padding: 32, boxShadow: "0 2px 20px rgba(0,0,0,0.08)" };
  const kicker: React.CSSProperties = { fontSize: 13, fontWeight: 700, letterSpacing: 1, color: "#CC0000", textTransform: "uppercase" };

  if (notFound) return <div style={wrap}><div style={card}><h1 style={{ fontSize: 20, margin: 0 }}>Link tidak ditemukan</h1><p style={{ color: "#64748b" }}>Link klaim sertifikat ini tidak valid atau sudah dinonaktifkan.</p></div></div>;
  if (!info) return <div style={wrap}><div style={card}><p style={{ color: "#64748b" }}>Memuat...</p></div></div>;

  const multi = info.programs.length > 1;
  const remaining = info.programs.filter((p) => !claimed.some((c) => c.program === p));

  // Keadaan 3: baru saja berhasil klaim / State 3: a claim just succeeded
  if (justClaimed) {
    const next = remaining[0];
    return (
      <div style={wrap}>
        <div style={card}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 40 }}>🎉</div>
            <h2 style={{ fontSize: 18, margin: "8px 0" }}>Sertifikat {PROGRAM_LABELS[justClaimed.program]} siap, {justClaimed.name}!</h2>
            <a href={justClaimed.downloadUrl} target="_blank" rel="noopener noreferrer"
              style={{ display: "inline-block", background: "#CC0000", color: "#fff", textDecoration: "none", padding: "12px 24px", borderRadius: 8, fontWeight: 700, marginTop: 8 }}>
              Unduh Sertifikat
            </a>
            {next && (
              <button
                onClick={() => { setProgram(next); setJustClaimed(null); setError(""); }}
                style={{ display: "block", width: "100%", marginTop: 14, background: "#fff", color: "#CC0000", border: "1.5px solid #CC0000", padding: "12px", borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                Klaim sertifikat {PROGRAM_LABELS[next]} juga
              </button>
            )}
            <p style={{ color: "#94a3b8", fontSize: 12, marginTop: 14 }}>Simpan/screenshot link unduhan ini.</p>
          </div>

          {claimed.length > 1 && (
            <div style={{ borderTop: "1px solid #eee", marginTop: 18, paddingTop: 14 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px" }}>Semua sertifikatmu</p>
              {claimed.map((c) => (
                <a key={c.program} href={c.downloadUrl} target="_blank" rel="noopener noreferrer"
                  style={{ display: "block", fontSize: 14, color: "#2563eb", padding: "4px 0" }}>
                  Unduh sertifikat {PROGRAM_LABELS[c.program]}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Keadaan 1: pilih program / State 1: pick a program
  if (!program) {
    return (
      <div style={wrap}>
        <div style={card}>
          <div style={kicker}>Sertifikat Kehadiran</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", margin: "6px 0 4px" }}>{info.title}</h1>
          <p style={{ color: "#64748b", fontSize: 14, margin: "0 0 18px" }}>Pilih sertifikat yang mau kamu klaim.</p>
          {info.programs.map((p) => (
            <button key={p} onClick={() => setProgram(p)}
              style={{ display: "block", width: "100%", textAlign: "left", background: "#fff", border: "1.5px solid #ddd", borderRadius: 10, padding: "14px 16px", marginBottom: 10, cursor: "pointer" }}>
              <div style={{ fontWeight: 700, color: "#0f172a", fontSize: 15 }}>{PROGRAM_LABELS[p]}</div>
              <div style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>{info.detail[p]?.title || info.title}</div>
              {subtitle(info.detail[p]) && <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>{subtitle(info.detail[p])}</div>}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Keadaan 2: isi nama / State 2: fill in the name
  const d = info.detail[program];
  return (
    <div style={wrap}>
      <div style={card}>
        <div style={kicker}>Sertifikat {PROGRAM_LABELS[program]}</div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", margin: "6px 0 4px" }}>{d?.title || info.title}</h1>
        {subtitle(d) && <p style={{ color: "#64748b", fontSize: 14, margin: "0 0 6px" }}>{subtitle(d)}</p>}
        {multi && (
          <button onClick={() => { setProgram(null); setError(""); }}
            style={{ background: "none", border: "none", padding: 0, color: "#2563eb", fontSize: 13, cursor: "pointer", marginBottom: 14 }}>
            ← ganti program
          </button>
        )}

        <label style={{ fontSize: 14, fontWeight: 600, color: "#334155", display: "block", marginTop: 8 }}>Nama Lengkap (sesuai sertifikat)</label>
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
      </div>
    </div>
  );
}
