"use client";

import { useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Link from "next/link";
import { ChevronLeft, Upload, Loader2, CheckCircle2, AlertCircle, Play } from "lucide-react";
import * as XLSX from "xlsx";
import type { ImportRow } from "@/lib/import-student";
import { normalizePhone, normalizeDob, normalizeGender } from "@/lib/import-normalize";

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

function mapRow(raw: Record<string, any>): ImportRow {
  const out: any = {};
  const keys = Object.keys(raw);
  for (const field of Object.keys(HEADER_ALIASES) as (keyof ImportRow)[]) {
    const aliases = HEADER_ALIASES[field].map(norm);
    const matchKey = keys.find((k) => aliases.includes(norm(k)));
    let val = matchKey ? raw[matchKey] : "";
    // Tanggal Excel kadang berupa Date object → ubah ke YYYY-MM-DD.
    if (field === "tanggalLahir" && val instanceof Date && !isNaN(val.getTime())) {
      const y = val.getFullYear();
      const m = String(val.getMonth() + 1).padStart(2, "0");
      const d = String(val.getDate()).padStart(2, "0");
      val = `${y}-${m}-${d}`;
    }
    out[field] = val == null ? "" : String(val).trim();
  }
  // Rapikan agar pratinjau = data yang benar-benar disimpan (server juga
  // merapikan ulang, jadi tetap aman walau file dikirim mentah).
  out.noWa = normalizePhone(out.noWa || "");
  out.tanggalLahir = normalizeDob(out.tanggalLahir || "");
  out.jenisKelamin = normalizeGender(out.jenisKelamin || "");
  return out as ImportRow;
}

export default function ImportStudentsPage() {
  const { user, profile } = useAuth();
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [parseError, setParseError] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, completed: 0, skipped: 0, errors: 0 });
  const [done, setDone] = useState(false);
  const [runError, setRunError] = useState("");
  const [errorSamples, setErrorSamples] = useState<string[]>([]);

  const getToken = useCallback(async () => {
    if (!user) return "";
    try { return await (user as any).getIdToken(); } catch { return ""; }
  }, [user]);

  const handleFile = async (file: File) => {
    setParseError("");
    setRows([]);
    setDone(false);
    setFileName(file.name);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "" });
      const mapped = raw.map(mapRow).filter((r) => /^\S+@\S+\.\S+$/.test(r.email || ""));
      if (mapped.length === 0) {
        setParseError("Tidak ada baris dengan email valid. Pastikan ada kolom 'Email'.");
        return;
      }
      setRows(mapped);
    } catch (e: any) {
      setParseError(e?.message || "Gagal membaca file.");
    }
  };

  const canRun = rows.length > 0 && startDate && endDate && !running;

  const runImport = async () => {
    if (!canRun) return;
    setRunning(true);
    setDone(false);
    setRunError("");
    setErrorSamples([]);
    let completed = 0, skipped = 0, errors = 0;
    const samples: string[] = [];
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
        (data.errorDetail || []).forEach((e: any) => {
          if (samples.length < 20) samples.push(`${e.email || "?"} (${e.reason || "error"})`);
        });
        setProgress({ current: Math.min(i + BATCH, rows.length), total: rows.length, completed, skipped, errors });
      }
      setErrorSamples(samples);
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
          {rows.length > 0 && (
            <div style={{ marginTop: 12, fontSize: 14, color: "#16a34a", fontWeight: 600 }}>
              ✓ {rows.length} baris siap diimport.
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
            style={{ display: "inline-flex", alignItems: "center", gap: 8, background: canRun ? "#1e293b" : "#cbd5e1", color: "#fff", border: "none", padding: "12px 22px", borderRadius: 10, fontWeight: 600, cursor: canRun ? "pointer" : "not-allowed" }}
          >
            {running ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
            {running ? `Mengimport... ${progress.current}/${progress.total}` : "Jalankan Import"}
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
