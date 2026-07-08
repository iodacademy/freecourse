"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import {
  ChevronLeft, Trash2, Loader2, AlertTriangle, Download, ShieldAlert, RefreshCw,
} from "lucide-react";

interface DetailOption { value: string; count: number; }
interface TargetRow {
  uid: string; email: string; namaLengkap: string;
  channelSource: string; detailChannel: string;
}

const CHANNEL_LABELS: Record<string, string> = {
  umum: "Umum",
  beasiswa: "Beasiswa",
  kemitraan: "Kemitraan",
  workshop: "Workshop",
};

export default function PurgeStudentsPage() {
  const { user, profile } = useAuth();

  const [channelSummary, setChannelSummary] = useState<Record<string, number>>({});
  const [channel, setChannel] = useState<string>("");
  const [detailOptions, setDetailOptions] = useState<DetailOption[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");

  // Modal konfirmasi
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const getToken = useCallback(async () => {
    if (!user) return "";
    try { return await (user as any).getIdToken(); } catch { return ""; }
  }, [user]);

  const selectedDetails = detailOptions.filter((d) => selected[d.value]).map((d) => d.value);
  const targetCount = detailOptions
    .filter((d) => selected[d.value])
    .reduce((sum, d) => sum + d.count, 0);
  const expectedPhrase = `HAPUS ${targetCount}`;

  // Muat ringkasan channel (sekali) & opsi detail channel saat channel berubah.
  const loadPreview = useCallback(async (ch: string) => {
    setLoading(true);
    setError("");
    try {
      const token = await getToken();
      const qs = ch ? `?channel=${encodeURIComponent(ch)}` : "";
      const res = await fetch(`/api/admin/students/purge/preview${qs}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memuat data");
      setChannelSummary(data.channelSummary || {});
      setDetailOptions(ch ? (data.detailChannelOptions || []) : []);
      setSelected({});
    } catch (e: any) {
      setError(e.message || "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => { if (user) loadPreview(""); }, [user, loadPreview]);

  function pickChannel(ch: string) {
    setChannel(ch);
    setResult("");
    loadPreview(ch);
  }

  const toggleAll = () => {
    const allOn = detailOptions.length > 0 && selectedDetails.length === detailOptions.length;
    if (allOn) { setSelected({}); return; }
    const next: Record<string, boolean> = {};
    detailOptions.forEach((d) => { next[d.value] = true; });
    setSelected(next);
  };

  async function downloadCsv() {
    if (selectedDetails.length === 0) return;
    setDownloading(true);
    try {
      const token = await getToken();
      const qs = `?channel=${encodeURIComponent(channel)}&details=${encodeURIComponent(selectedDetails.join("|"))}&list=1`;
      const res = await fetch(`/api/admin/students/purge/preview${qs}`, {
        headers: { Authorization: `Bearer ${token}` }, cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mengambil daftar");
      const rows: TargetRow[] = data.targets || [];
      const esc = (s: string) => `"${String(s ?? "").replace(/"/g, '""')}"`;
      const csv = [
        "Email,Nama Lengkap,Channel,Detail Channel",
        ...rows.map((r) => [r.email, r.namaLengkap, r.channelSource, r.detailChannel].map(esc).join(",")),
      ].join("\n");
      const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `backup-peserta-${channel}-${rows.length}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e.message || "Gagal unduh CSV");
    } finally {
      setDownloading(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setError("");
    try {
      const token = await getToken();
      const res = await fetch("/api/admin/students/purge", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ channel, details: selectedDetails, confirm: confirmText.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menghapus");
      setConfirmOpen(false);
      setConfirmText("");
      setResult(
        `Berhasil menghapus ${data.deletedUsers} peserta ` +
        `(${data.deletedEnrollments} enrollment, ${data.deletedCerts} sertifikat, ${data.authDeleted} akun login)` +
        (data.failed?.length ? `. ${data.failed.length} gagal.` : ".")
      );
      await loadPreview(channel);
    } catch (e: any) {
      setError(e.message || "Terjadi kesalahan");
    } finally {
      setDeleting(false);
    }
  }

  // Halaman ini hanya untuk Super Admin.
  if (profile && !profile.isSuperAdmin) {
    return (
      <ProtectedRoute requireAdmin>
        <div style={{ maxWidth: 700, margin: "0 auto", padding: "60px 20px", textAlign: "center" }}>
          <ShieldAlert size={48} color="#dc2626" style={{ margin: "0 auto 16px" }} />
          <h1 style={{ fontSize: 20, color: "#0f172a" }}>Khusus Super Admin</h1>
          <p style={{ color: "#64748b", fontSize: 14 }}>Kamu tidak punya akses ke halaman ini.</p>
          <Link href="/admin/students" style={{ color: "#2563eb", fontSize: 14 }}>← Kembali</Link>
        </div>
      </ProtectedRoute>
    );
  }

  const allOn = detailOptions.length > 0 && selectedDetails.length === detailOptions.length;

  return (
    <ProtectedRoute requireAdmin>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 20px" }}>
        <Link href="/admin/students" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#64748b", textDecoration: "none", fontSize: 14, marginBottom: 24, fontWeight: 500 }}>
          <ChevronLeft size={16} /> Kembali ke Kelola Siswa
        </Link>

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: "#fee2e2", color: "#dc2626", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Trash2 size={24} />
          </div>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: "#0f172a", margin: 0 }}>Hapus Data Peserta</h1>
            <p style={{ color: "#64748b", margin: "4px 0 0", fontSize: 14 }}>
              Hapus permanen peserta berdasarkan Channel & Detail Channel. Tindakan ini <strong>tidak bisa dibatalkan</strong>.
            </p>
          </div>
        </div>

        {/* Peringatan */}
        <div style={{ marginTop: 20, background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e", padding: "12px 16px", borderRadius: 10, fontSize: 13, display: "flex", gap: 10 }}>
          <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            Yang dihapus: <strong>akun login, data peserta, enrollment, dan sertifikat</strong>.
            Koleksi <code>leads</code> <strong>tidak</strong> dihapus (disimpan sebagai jejak).
            Disarankan <strong>unduh CSV</strong> dulu sebelum menghapus.
          </div>
        </div>

        {error && (
          <div style={{ marginTop: 16, background: "#fef2f2", color: "#b91c1c", padding: "12px 16px", borderRadius: 8, fontSize: 14, border: "1px solid #fecaca" }}>
            {error}
          </div>
        )}
        {result && (
          <div style={{ marginTop: 16, background: "#ecfdf5", color: "#065f46", padding: "12px 16px", borderRadius: 8, fontSize: 14, border: "1px solid #a7f3d0" }}>
            {result}
          </div>
        )}

        {/* Step 1: pilih channel */}
        <div style={{ marginTop: 28 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#334155", marginBottom: 10 }}>1. Pilih Channel Source</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {Object.entries(channelSummary).sort((a, b) => a[0].localeCompare(b[0])).map(([ch, count]) => (
              <button
                key={ch}
                onClick={() => pickChannel(ch)}
                disabled={loading}
                style={{
                  padding: "8px 16px", borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: "pointer",
                  border: `1.5px solid ${channel === ch ? "#dc2626" : "#e2e8f0"}`,
                  background: channel === ch ? "#fef2f2" : "#fff",
                  color: channel === ch ? "#dc2626" : "#334155",
                }}
              >
                {CHANNEL_LABELS[ch] || ch} <span style={{ color: "#94a3b8", fontWeight: 400 }}>({count})</span>
              </button>
            ))}
            <button onClick={() => loadPreview(channel)} disabled={loading} title="Muat ulang"
              style={{ padding: "8px 12px", borderRadius: 20, border: "1.5px solid #e2e8f0", background: "#fff", cursor: "pointer", color: "#64748b" }}>
              <RefreshCw size={14} className={loading ? "spin" : ""} />
            </button>
          </div>
        </div>

        {/* Step 2: pilih detail channel */}
        {channel && (
          <div style={{ marginTop: 28 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#334155" }}>
                2. Centang Detail Channel yang mau dihapus
              </div>
              {detailOptions.length > 0 && (
                <button onClick={toggleAll} style={{ fontSize: 12, fontWeight: 600, color: "#2563eb", background: "none", border: "none", cursor: "pointer" }}>
                  {allOn ? "Batal pilih semua" : "Pilih semua"}
                </button>
              )}
            </div>

            {loading ? (
              <div style={{ color: "#64748b", fontSize: 14, padding: "20px 0" }}>
                <Loader2 size={18} className="spin" style={{ verticalAlign: "middle", marginRight: 8 }} /> Memuat...
              </div>
            ) : detailOptions.length === 0 ? (
              <div style={{ color: "#94a3b8", fontSize: 14, padding: "20px 0" }}>Tidak ada peserta di channel ini.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {detailOptions.map((d) => (
                  <label
                    key={d.value}
                    style={{
                      display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 10,
                      border: `1.5px solid ${selected[d.value] ? "#fca5a5" : "#e2e8f0"}`,
                      background: selected[d.value] ? "#fef2f2" : "#fff", cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={!!selected[d.value]}
                      onChange={() => setSelected((p) => ({ ...p, [d.value]: !p[d.value] }))}
                      style={{ width: 17, height: 17, cursor: "pointer" }}
                    />
                    <span style={{ flex: 1, fontSize: 14, color: "#0f172a" }}>{d.value}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#dc2626" }}>{d.count} peserta</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 3: aksi */}
        {channel && selectedDetails.length > 0 && (
          <div style={{ marginTop: 28, padding: 16, borderRadius: 12, border: "1.5px solid #fecaca", background: "#fff5f5" }}>
            <div style={{ fontSize: 14, color: "#7f1d1d", marginBottom: 12 }}>
              Akan menghapus <strong>{targetCount} peserta</strong> dari {selectedDetails.length} detail channel terpilih.
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                onClick={downloadCsv}
                disabled={downloading}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 16px", borderRadius: 8, border: "1.5px solid #cbd5e1", background: "#fff", color: "#334155", fontWeight: 600, fontSize: 14, cursor: "pointer" }}
              >
                {downloading ? <Loader2 size={16} className="spin" /> : <Download size={16} />}
                Unduh CSV (backup)
              </button>
              <button
                onClick={() => { setConfirmText(""); setConfirmOpen(true); }}
                disabled={targetCount === 0}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 18px", borderRadius: 8, border: "none", background: "#dc2626", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}
              >
                <Trash2 size={16} /> Hapus {targetCount} Peserta
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal konfirmasi — wajib ketik frasa */}
      {confirmOpen && (
        <div
          onClick={() => !deleting && setConfirmOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, maxWidth: 480, width: "100%", padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: "#fee2e2", color: "#dc2626", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <AlertTriangle size={20} />
              </div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#0f172a" }}>Konfirmasi Penghapusan</h3>
            </div>
            <p style={{ fontSize: 14, color: "#475569", lineHeight: 1.6, margin: "0 0 8px" }}>
              Kamu akan menghapus <strong>{targetCount} peserta</strong> secara permanen
              (akun login, data, enrollment, sertifikat). <strong>Tidak bisa dibatalkan.</strong>
            </p>
            <p style={{ fontSize: 13, color: "#7f1d1d", margin: "0 0 8px" }}>
              Ketik persis: <code style={{ background: "#fef2f2", padding: "2px 6px", borderRadius: 4, fontWeight: 700 }}>{expectedPhrase}</code>
            </p>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={expectedPhrase}
              disabled={deleting}
              autoFocus
              style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1.5px solid #cbd5e1", fontSize: 15, marginBottom: 16, boxSizing: "border-box" }}
            />
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                onClick={() => setConfirmOpen(false)}
                disabled={deleting}
                style={{ padding: "10px 18px", borderRadius: 8, border: "1.5px solid #cbd5e1", background: "#fff", color: "#475569", fontWeight: 600, fontSize: 14, cursor: "pointer" }}
              >
                Batal
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting || confirmText.trim() !== expectedPhrase}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 18px", borderRadius: 8, border: "none",
                  background: confirmText.trim() === expectedPhrase && !deleting ? "#dc2626" : "#f1f5f9",
                  color: confirmText.trim() === expectedPhrase && !deleting ? "#fff" : "#94a3b8",
                  fontWeight: 700, fontSize: 14,
                  cursor: confirmText.trim() === expectedPhrase && !deleting ? "pointer" : "not-allowed",
                }}
              >
                {deleting ? <Loader2 size={16} className="spin" /> : <Trash2 size={16} />}
                Hapus Permanen
              </button>
            </div>
          </div>
        </div>
      )}
    </ProtectedRoute>
  );
}
