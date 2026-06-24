"use client";

import { useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Link from "next/link";
import { ChevronLeft, Upload, Loader2, CheckCircle2, AlertCircle, Play, Download } from "lucide-react";
import * as XLSX from "xlsx";
import type { ImportRow } from "@/lib/import-student";
import { normalizePhone, normalizeDob, normalizeGender, detectBrokenPhone } from "@/lib/import-normalize";

const BATCH = 25;

// Cocokkan header file (apa adanya) → field ImportRow. Toleran spasi & huruf.
function norm(s: string) {
  return String(s || "").toLowerCase().replace(/\s+/g, " ").trim();
}

// Daftar alias header yang diterima untuk tiap field.
const HEADER_ALIASES: Record<keyof ImportRow, string[]> = {
  email: ["email", "alamat email", "e-mail"],
  nama: ["nama lengkap", "nama", "name", "full name"],
  noWa: ["nomor wa", "no wa", "nomor whatsapp", "phone", "no hp", "whatsapp"],
  jenisKelamin: ["jenis kelamin", "gender", "kelamin"],
  tanggalLahir: ["tanggal lahir", "tgl lahir", "date of birth", "dob"],
  kota: ["kota", "domisili", "asal daerah", "kota/kabupaten"],
  disabilitas: ["disabilitas", "status disabilitas"],
  jenisDisabilitas: ["jenis disabilitas", "kategori disabilitas"],
  minat: ["minat", "minat pelatihan"],
};

// Baris hasil map + penanda internal untuk validasi (tidak dikirim ke server).
type MappedRow = ImportRow & { _noWaBroken?: string; _noWaRaw?: string };

function mapRow(raw: Record<string, any>): MappedRow {
  const out: any = {};
  const keys = Object.keys(raw);
  let noWaRaw = "";
  for (const field of Object.keys(HEADER_ALIASES) as (keyof ImportRow)[]) {
    const aliases = HEADER_ALIASES[field].map(norm);
    const matchKey = keys.find((k) => aliases.includes(norm(k)));
    let val = matchKey ? raw[matchKey] : "";
    // Simpan WA MENTAH (sebelum normalisasi) untuk deteksi rusak.
    if (field === "noWa") noWaRaw = val == null ? "" : String(val).trim();
    // Tanggal Excel kadang berupa Date object → ubah ke YYYY-MM-DD.
    if (field === "tanggalLahir" && val instanceof Date && !isNaN(val.getTime())) {
      const y = val.getFullYear();
      const m = String(val.getMonth() + 1).padStart(2, "0");
      const d = String(val.getDate()).padStart(2, "0");
      val = `${y}-${m}-${d}`;
    }
    out[field] = val == null ? "" : String(val).trim();
  }
  // Deteksi nomor rusak (notasi ilmiah) dari nilai MENTAH, sebelum dibersihkan.
  out._noWaRaw = noWaRaw;
  out._noWaBroken = detectBrokenPhone(noWaRaw);
  // Rapikan agar pratinjau = data yang benar-benar disimpan (server juga
  // merapikan ulang, jadi tetap aman walau file dikirim mentah).
  out.noWa = normalizePhone(out.noWa || "");
  out.tanggalLahir = normalizeDob(out.tanggalLahir || "");
  out.jenisKelamin = normalizeGender(out.jenisKelamin || "");
  return out as MappedRow;
}

// Label ramah untuk tiap field (ditampilkan di peringatan header).
const FIELD_LABEL: Record<keyof ImportRow, string> = {
  email: "Email",
  nama: "Nama Lengkap",
  noWa: "Nomor WA",
  jenisKelamin: "Jenis Kelamin",
  tanggalLahir: "Tanggal Lahir",
  kota: "Kota",
  disabilitas: "Disabilitas",
  jenisDisabilitas: "Jenis Disabilitas",
  minat: "Minat",
};

// Cek header file: field mana yang TERDETEKSI vs TIDAK, untuk diberitahukan ke admin.
function detectHeaders(fileHeaders: string[]) {
  const detected: string[] = [];
  const missing: string[] = [];
  const matchedFileCols = new Set<string>();
  for (const field of Object.keys(HEADER_ALIASES) as (keyof ImportRow)[]) {
    const aliases = HEADER_ALIASES[field].map(norm);
    const hit = fileHeaders.find((h) => aliases.includes(norm(h)));
    if (hit) { detected.push(FIELD_LABEL[field]); matchedFileCols.add(hit); }
    else missing.push(FIELD_LABEL[field]);
  }
  // Kolom di file yang tidak dipakai sistem sama sekali.
  const unused = fileHeaders.filter((h) => h && !matchedFileCols.has(h));
  return { detected, missing, unused };
}

export default function ImportStudentsPage() {
  const { user, profile } = useAuth();
  const [rows, setRows] = useState<MappedRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [parseError, setParseError] = useState("");
  const [headerInfo, setHeaderInfo] = useState<{ detected: string[]; missing: string[]; unused: string[] } | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, completed: 0, skipped: 0, errors: 0 });
  const [done, setDone] = useState(false);
  const [runError, setRunError] = useState("");
  const [errorSamples, setErrorSamples] = useState<string[]>([]);
  // Detail lengkap email yang dilewati/gagal (untuk diunduh).
  const [skippedDetail, setSkippedDetail] = useState<Array<{ email: string; reason: string }>>([]);
  const [errorDetail, setErrorDetail] = useState<Array<{ email: string; reason: string }>>([]);

  const getToken = useCallback(async () => {
    if (!user) return "";
    try { return await (user as any).getIdToken(); } catch { return ""; }
  }, [user]);

  // Unduh daftar (dilewati/gagal) sebagai Excel — KOLOM SAMA PERSIS dengan file
  // import + kolom Keterangan. Baris lengkap diambil dengan mencocokkan email
  // ke data asli yang sudah di-parse (rows).
  function downloadRowsXlsx(
    items: Array<{ email: string; reason: string }>,
    sheetName: string,
    fileLabel: string
  ) {
    if (!items.length) return;
    const reasonLabel: Record<string, string> = {
      already_certified: "Sudah punya sertifikat",
      email_kosong: "Email kosong",
      lead_not_found: "Lead tidak ditemukan",
    };
    // Peta email → baris asli (lengkap) dari file yang diupload.
    const byEmail = new Map<string, ImportRow>();
    rows.forEach((r) => byEmail.set((r.email || "").toLowerCase(), r));

    // Header sama persis urutan kolom import + Keterangan di akhir.
    const headers = [
      "Email", "Nama Lengkap", "Nomor WA", "Jenis Kelamin", "Tanggal Lahir",
      "Kota", "Disabilitas", "Jenis Disabilitas", "Minat", "Keterangan",
    ];
    const aoa: (string | number)[][] = [headers];
    for (const it of items) {
      const r = byEmail.get((it.email || "").toLowerCase());
      aoa.push([
        it.email || r?.email || "",
        r?.nama || "",
        r?.noWa || "",
        r?.jenisKelamin || "",
        r?.tanggalLahir || "",
        r?.kota || "",
        r?.disabilitas || "",
        r?.jenisDisabilitas || "",
        r?.minat || "",
        reasonLabel[it.reason] || it.reason || "-",
      ]);
    }
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [
      { wch: 32 }, { wch: 22 }, { wch: 16 }, { wch: 14 }, { wch: 14 },
      { wch: 16 }, { wch: 14 }, { wch: 20 }, { wch: 20 }, { wch: 24 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    const stamp = (startDate || "data").replace(/[^0-9-]/g, "");
    XLSX.writeFile(wb, `${fileLabel}-${stamp || "import"}.xlsx`);
  }

  const handleFile = async (file: File) => {
    setParseError("");
    setHeaderInfo(null);
    setRows([]);
    setDone(false);
    setFileName(file.name);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "" });

      // Ambil header asli dari file (baris pertama) untuk analisis kolom.
      const headerRows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });
      const fileHeaders = (headerRows[0] || []).map((h: any) => String(h || "").trim()).filter(Boolean);
      setHeaderInfo(detectHeaders(fileHeaders));

      const mapped = raw.map(mapRow).filter((r) => /^\S+@\S+\.\S+$/.test(r.email || ""));
      if (mapped.length === 0) {
        setParseError("Tidak ada baris dengan email valid. Pastikan ada kolom 'Email' dengan header yang benar.");
        return;
      }
      setRows(mapped);
    } catch (e: any) {
      setParseError(e?.message || "Gagal membaca file.");
    }
  };

  // Baris dengan nomor WA rusak (notasi ilmiah dst). Import DIBLOKIR bila ada.
  const brokenRows = rows
    .map((r, i) => ({ idx: i, email: r.email, raw: r._noWaRaw || "", reason: r._noWaBroken || "" }))
    .filter((r) => r.reason);
  const hasBroken = brokenRows.length > 0;

  const canRun = rows.length > 0 && startDate && endDate && !running && !hasBroken;

  const runImport = async () => {
    if (!canRun) return;
    setRunning(true);
    setDone(false);
    setRunError("");
    setErrorSamples([]);
    setSkippedDetail([]);
    setErrorDetail([]);
    let completed = 0, skipped = 0, errors = 0;
    const samples: string[] = [];
    const skippedAll: Array<{ email: string; reason: string }> = [];
    const errorAll: Array<{ email: string; reason: string }> = [];
    setProgress({ current: 0, total: rows.length, completed: 0, skipped: 0, errors: 0 });

    try {
      const token = await getToken();
      for (let i = 0; i < rows.length; i += BATCH) {
        const chunk = rows.slice(i, i + BATCH);
        const res = await fetch("/api/admin/students/import", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ rows: chunk, startDate, endDate }),
        });
        const text = await res.text();
        let data: any = null;
        try { data = text ? JSON.parse(text) : null; } catch {
          throw new Error(`Server membalas non-JSON (HTTP ${res.status}).`);
        }
        if (!res.ok) throw new Error(data?.error || `Gagal (HTTP ${res.status}).`);
        completed += data.completed || 0;
        skipped += data.skipped || 0;
        errors += data.errors || 0;
        (data.skippedDetail || []).forEach((s: any) => skippedAll.push({ email: s.email || "", reason: s.reason || "" }));
        (data.errorDetail || []).forEach((e: any) => {
          errorAll.push({ email: e.email || "", reason: e.reason || "" });
          if (samples.length < 20) samples.push(`${e.email || "?"} (${e.reason || "error"})`);
        });
        setProgress({ current: Math.min(i + BATCH, rows.length), total: rows.length, completed, skipped, errors });
      }
      setErrorSamples(samples);
      setSkippedDetail(skippedAll);
      setErrorDetail(errorAll);
      setDone(true);
    } catch (e: any) {
      setRunError(e?.message || "Terjadi kesalahan.");
    } finally {
      setRunning(false);
    }
  };

  return (
    <ProtectedRoute requireAdmin>
      <div style={{ padding: "24px 30px", maxWidth: 900, margin: "0 auto" }}>
        <Link href="/admin/students" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#64748b", textDecoration: "none", fontSize: 14, marginBottom: 16 }}>
          <ChevronLeft size={16} /> Kembali ke Data Siswa
        </Link>

        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#0f172a", margin: "0 0 4px" }}>Import Peserta</h1>
        <p style={{ fontSize: 14, color: "#64748b", margin: "0 0 24px" }}>
          Upload Excel/CSV. Peserta dibuat langsung berstatus selesai (tersertifikasi) dengan
          tanggal daftar acak. PDF sertifikat dibuat otomatis di latar belakang.
        </p>

        {!profile?.isSuperAdmin && (
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start", background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 10, padding: "12px 14px", marginBottom: 20 }}>
            <AlertCircle size={18} color="#c2410c" style={{ flexShrink: 0, marginTop: 1 }} />
            <span style={{ fontSize: 13, color: "#9a3412" }}>
              Fitur ini hanya untuk <strong>Super Admin</strong>. Tombol jalankan tetap akan ditolak server jika kamu bukan Super Admin.
            </span>
          </div>
        )}

        {/* Upload */}
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 20, marginBottom: 16 }}>
          <label style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: 24, border: "2px dashed #cbd5e1", borderRadius: 10, cursor: "pointer", textAlign: "center" }}>
            <Upload size={28} color="#94a3b8" />
            <span style={{ fontSize: 14, fontWeight: 600, color: "#334155" }}>
              {fileName || "Klik untuk pilih file Excel / CSV"}
            </span>
            <span style={{ fontSize: 12, color: "#94a3b8" }}>
              Kolom yang dikenali: Email (wajib), Nama Lengkap, Nomor WA, Jenis Kelamin, Tanggal Lahir, Kota, Disabilitas, Jenis Disabilitas, Minat.
              <br />Nomor WA & tanggal lahir dirapikan otomatis. Tanggal ambigu dianggap <strong>DD/MM/YYYY</strong>. Cek pratinjau sebelum jalan.
            </span>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              style={{ display: "none" }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
          </label>
          {parseError && (
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12, color: "#b91c1c", fontSize: 13 }}>
              <AlertCircle size={15} /> {parseError}
            </div>
          )}

          {/* Analisis header: kolom terdeteksi vs tidak ditemukan */}
          {headerInfo && (
            <div style={{ marginTop: 12, padding: "12px 14px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13 }}>
              <div style={{ marginBottom: 6 }}>
                <strong style={{ color: "#15803d" }}>Kolom terdeteksi:</strong>{" "}
                <span style={{ color: "#334155" }}>{headerInfo.detected.length ? headerInfo.detected.join(", ") : "—"}</span>
              </div>
              {headerInfo.missing.length > 0 && (
                <div style={{ marginBottom: headerInfo.unused.length ? 6 : 0, color: "#b45309" }}>
                  <strong>Tidak ditemukan:</strong> {headerInfo.missing.join(", ")}
                  {headerInfo.missing.includes("Email") && (
                    <span style={{ color: "#b91c1c" }}> — kolom Email WAJIB ada.</span>
                  )}
                  <div style={{ fontSize: 12, color: "#92400e", marginTop: 2 }}>
                    Kolom ini akan kosong untuk semua peserta. Perbaiki nama header di file bila tidak sengaja.
                  </div>
                </div>
              )}
              {headerInfo.unused.length > 0 && (
                <div style={{ fontSize: 12, color: "#94a3b8" }}>
                  Kolom file yang diabaikan: {headerInfo.unused.join(", ")}
                </div>
              )}
            </div>
          )}

          {rows.length > 0 && !hasBroken && (
            <div style={{ marginTop: 12, fontSize: 14, color: "#16a34a", fontWeight: 600 }}>
              ✓ {rows.length} baris siap diimport.
            </div>
          )}

          {/* Nomor WA rusak → blokir import, minta perbaiki */}
          {hasBroken && (
            <div style={{ marginTop: 12, padding: "12px 14px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", color: "#b91c1c", fontWeight: 700, fontSize: 14, marginBottom: 6 }}>
                <AlertCircle size={16} /> Import diblokir: {brokenRows.length} nomor WA rusak
              </div>
              <div style={{ fontSize: 13, color: "#7f1d1d", marginBottom: 8 }}>
                Beberapa nomor tersimpan dalam <strong>notasi ilmiah</strong> (mis. <code>8,95396E+11</code>) —
                Excel sudah menghilangkan sebagian digit, jadi datanya tidak valid. Perbaiki file lalu upload ulang.
                <div style={{ marginTop: 6, padding: "8px 10px", background: "#fff", border: "1px solid #fecaca", borderRadius: 6, color: "#7f1d1d", fontSize: 12 }}>
                  <strong>Cara perbaiki di Excel:</strong> pilih kolom Nomor WA → klik kanan → <em>Format Cells</em> →
                  pilih <strong>Text</strong> → ketik ulang/tempel nomornya. Atau tambah tanda kutip <code>'</code> di depan nomor
                  (mis. <code>'628123456789</code>) agar dibaca sebagai teks.
                </div>
              </div>
              <details>
                <summary style={{ cursor: "pointer", fontSize: 12, color: "#b91c1c", fontWeight: 600 }}>
                  Lihat baris bermasalah ({brokenRows.length})
                </summary>
                <ul style={{ paddingLeft: 18, fontSize: 12, color: "#7f1d1d", marginTop: 6 }}>
                  {brokenRows.slice(0, 50).map((b) => (
                    <li key={b.idx}>Baris {b.idx + 2}: {b.email || "(email kosong)"} — <code>{b.raw}</code></li>
                  ))}
                </ul>
              </details>
            </div>
          )}
        </div>

        {/* Preview */}
        {rows.length > 0 && (
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 0, marginBottom: 16, overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600, color: "#475569", borderBottom: "1px solid #e2e8f0" }}>
              Pratinjau (5 baris pertama)
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    {["Email", "Nama", "No WA", "Kelamin", "Tgl Lahir", "Kota"].map((h) => (
                      <th key={h} style={{ textAlign: "left", padding: "8px 12px", color: "#64748b", borderBottom: "1px solid #e2e8f0" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 5).map((r, i) => (
                    <tr key={i}>
                      <td style={{ padding: "8px 12px", borderBottom: "1px solid #f1f5f9" }}>{r.email}</td>
                      <td style={{ padding: "8px 12px", borderBottom: "1px solid #f1f5f9" }}>{r.nama}</td>
                      <td style={{ padding: "8px 12px", borderBottom: "1px solid #f1f5f9" }}>{r.noWa}</td>
                      <td style={{ padding: "8px 12px", borderBottom: "1px solid #f1f5f9" }}>{r.jenisKelamin}</td>
                      <td style={{ padding: "8px 12px", borderBottom: "1px solid #f1f5f9" }}>{r.tanggalLahir}</td>
                      <td style={{ padding: "8px 12px", borderBottom: "1px solid #f1f5f9" }}>{r.kota}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Rentang tanggal */}
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 20, marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#334155", marginBottom: 4 }}>Rentang Tanggal Daftar (acak)</div>
          <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 12 }}>
            Tiap peserta diberi tanggal daftar acak (termasuk jam, menit, detik) di antara dua tanggal ini.
          </div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <label style={{ fontSize: 13, color: "#475569" }}>
              Dari<br />
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                style={{ marginTop: 4, padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: 8 }} />
            </label>
            <label style={{ fontSize: 13, color: "#475569" }}>
              Sampai<br />
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                style={{ marginTop: 4, padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: 8 }} />
            </label>
          </div>
        </div>

        {/* Jalankan */}
        {!done ? (
          <button
            onClick={runImport}
            disabled={!canRun}
            title={hasBroken ? "Perbaiki nomor WA yang rusak dulu" : undefined}
            style={{ display: "inline-flex", alignItems: "center", gap: 8, background: canRun ? "#1e293b" : "#cbd5e1", color: "#fff", border: "none", padding: "12px 22px", borderRadius: 10, fontWeight: 600, cursor: canRun ? "pointer" : "not-allowed" }}
          >
            {running ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
            {running
              ? `Mengimport... ${progress.current}/${progress.total}`
              : hasBroken
                ? "Perbaiki nomor WA dulu"
                : "Jalankan Import"}
          </button>
        ) : (
          <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 12, padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#16a34a", fontWeight: 700, fontSize: 16, marginBottom: 8 }}>
              <CheckCircle2 size={20} /> Import Selesai
            </div>
            <p style={{ fontSize: 14, color: "#334155", margin: "0 0 8px" }}>
              Berhasil: <strong>{progress.completed}</strong> &middot; Dilewati: {progress.skipped} &middot; Gagal: {progress.errors}
            </p>
            <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>
              PDF sertifikat sedang/akan dibuat di latar belakang oleh sistem. Kamu boleh tinggalkan halaman ini.
            </p>

            {/* Tombol unduh daftar yang dilewati / gagal (Excel) */}
            {(skippedDetail.length > 0 || errorDetail.length > 0) && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
                {skippedDetail.length > 0 && (
                  <button
                    onClick={() => downloadRowsXlsx(skippedDetail, "Dilewati", "peserta-dilewati")}
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "#92400e", background: "#fef3c7", border: "1px solid #fcd34d", padding: "8px 14px", borderRadius: 8, cursor: "pointer" }}
                  >
                    <Download size={15} /> Unduh dilewati ({skippedDetail.length})
                  </button>
                )}
                {errorDetail.length > 0 && (
                  <button
                    onClick={() => downloadRowsXlsx(errorDetail, "Gagal", "peserta-gagal")}
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "#fff", background: "#b91c1c", border: "1px solid #b91c1c", padding: "8px 14px", borderRadius: 8, cursor: "pointer" }}
                  >
                    <Download size={15} /> Unduh gagal ({errorDetail.length})
                  </button>
                )}
              </div>
            )}

            {errorSamples.length > 0 && (
              <ul style={{ marginTop: 10, paddingLeft: 18, fontSize: 12, color: "#b91c1c" }}>
                {errorSamples.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            )}
          </div>
        )}

        {running && (
          <div style={{ marginTop: 16 }}>
            <div style={{ width: "100%", background: "#e2e8f0", borderRadius: 99, height: 10, overflow: "hidden" }}>
              <div style={{ background: "#2563eb", height: "100%", width: `${progress.total ? (progress.current / progress.total) * 100 : 0}%`, transition: "width 0.3s" }} />
            </div>
            <div style={{ fontSize: 12, color: "#475569", textAlign: "center", marginTop: 6 }}>
              ✓ {progress.completed} &nbsp; – {progress.skipped} &nbsp; ✗ {progress.errors}
            </div>
          </div>
        )}

        {runError && (
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 16, color: "#b91c1c", fontSize: 13 }}>
            <AlertCircle size={15} /> {runError}
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
