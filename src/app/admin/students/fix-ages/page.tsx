"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import { ChevronLeft, Save, Loader2, CalendarClock, CheckCircle2, Wand2, X, AlertTriangle } from "lucide-react";
import Link from "next/link";

interface AgeStudent {
  uid: string;
  email: string;
  namaLengkap: string;
  tanggalLahir: string; // dd/mm/yyyy dari server
  umur: string;
}

// Ubah "dd/mm/yyyy" → "yyyy-mm-dd" untuk <input type="date">. "" bila tidak valid.
function toIsoDate(ddmmyyyy: string): string {
  const m = (ddmmyyyy || "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return "";
  return `${m[3]}-${m[2]}-${m[1]}`;
}

// Hitung umur dari ISO date "yyyy-mm-dd".
function ageFromIso(iso: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  if (today.getMonth() < d.getMonth() || (today.getMonth() === d.getMonth() && today.getDate() < d.getDate())) age--;
  return age;
}

export default function FixAgesPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<AgeStudent[]>([]);
  const [savingIds, setSavingIds] = useState<Record<string, boolean>>({});
  const [newDates, setNewDates] = useState<Record<string, string>>({}); // uid → ISO
  const [error, setError] = useState("");

  // Perbaikan otomatis massal
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [autoFixing, setAutoFixing] = useState(false);
  const [autoResult, setAutoResult] = useState("");

  const getToken = useCallback(async () => {
    if (!user) return "";
    try { return await (user as any).getIdToken(); } catch { return ""; }
  }, [user]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const token = await getToken();
      if (!token) return;

      const res = await fetch(`/api/admin/students/fix-data?mode=ages&_t=${Date.now()}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Gagal mengambil data siswa");

      const data = await res.json();
      const list: AgeStudent[] = data.students || [];

      const initial: Record<string, string> = {};
      list.forEach((s) => { initial[s.uid] = toIsoDate(s.tanggalLahir); });

      setNewDates(initial);
      setStudents(list);
      setSelected({});
    } catch (e: any) {
      setError(e.message || "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleDateChange = (uid: string, val: string) => {
    setNewDates((prev) => ({ ...prev, [uid]: val }));
  };

  const handleSave = async (uid: string) => {
    const iso = newDates[uid];
    if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
      alert("Isi tanggal lahir yang valid.");
      return;
    }
    setSavingIds((prev) => ({ ...prev, [uid]: true }));
    try {
      const token = await getToken();
      const res = await fetch(`/api/admin/students/${uid}/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tanggalLahir: iso }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan");

      // Bila usia baru sudah ≤29, hilangkan dari daftar. Kalau masih >29, biarkan.
      const newAge = ageFromIso(iso);
      if (newAge !== null && newAge <= 29) {
        setStudents((prev) => prev.filter((s) => s.uid !== uid));
      } else {
        setStudents((prev) =>
          prev.map((s) => (s.uid === uid ? { ...s, umur: String(newAge ?? s.umur), tanggalLahir: iso.split("-").reverse().join("/") } : s))
        );
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSavingIds((prev) => ({ ...prev, [uid]: false }));
    }
  };

  // ── Seleksi untuk perbaikan otomatis ──
  const selectedUids = students.filter((s) => selected[s.uid]).map((s) => s.uid);
  const allSelected = students.length > 0 && selectedUids.length === students.length;

  const toggleOne = (uid: string) => setSelected((prev) => ({ ...prev, [uid]: !prev[uid] }));
  const toggleAll = () => {
    if (allSelected) { setSelected({}); return; }
    const next: Record<string, boolean> = {};
    students.forEach((s) => { next[s.uid] = true; });
    setSelected(next);
  };

  const handleAutoFix = async () => {
    if (selectedUids.length === 0) return;
    setAutoFixing(true);
    setAutoResult("");
    try {
      const token = await getToken();
      const res = await fetch("/api/admin/students/fix-ages-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ uids: selectedUids }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memperbaiki");
      setConfirmOpen(false);
      setAutoResult(`Berhasil memperbaiki ${data.updated} peserta${data.failed?.length ? `, ${data.failed.length} gagal` : ""}. Memuat ulang...`);
      // Muat ulang daftar — yang sudah ≤29 akan hilang.
      await fetchUsers();
      setAutoResult(`Selesai. ${data.updated} peserta diperbaiki.`);
    } catch (e: any) {
      setConfirmOpen(false);
      setError(e.message || "Terjadi kesalahan");
    } finally {
      setAutoFixing(false);
    }
  };

  return (
    <ProtectedRoute requireAdmin>
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "40px 20px" }}>
        <Link href="/admin/students" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#64748b", textDecoration: "none", fontSize: 14, marginBottom: 24, fontWeight: 500 }}>
          <ChevronLeft size={16} /> Kembali ke Kelola Siswa
        </Link>

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: "#fef3c7", color: "#d97706", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <CalendarClock size={24} />
          </div>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: "#0f172a", margin: 0 }}>
              Perbaiki Usia &gt; 29 Tahun
              {!loading && (
                <span style={{ fontSize: 16, fontWeight: 700, color: "#d97706", marginLeft: 10 }}>
                  ({students.length})
                </span>
              )}
            </h1>
            <p style={{ color: "#64748b", margin: 0, fontSize: 14, marginTop: 4 }}>
              Daftar peserta berusia lebih dari 29 tahun, diurutkan dari yang paling tua. Perbaiki tanggal lahirnya bila salah input.
            </p>
          </div>
        </div>

        {error && (
          <div style={{ marginTop: 24, background: "#fef2f2", color: "#b91c1c", padding: "12px 16px", borderRadius: 8, fontSize: 14, border: "1px solid #fecaca" }}>
            {error}
          </div>
        )}

        <div style={{ marginTop: 32 }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: "#64748b" }}>
              <Loader2 size={24} className="spin" style={{ margin: "0 auto 12px" }} />
              Memuat data...
            </div>
          ) : students.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 20px", background: "#f8fafc", borderRadius: 12, border: "1px dashed #cbd5e1" }}>
              <CheckCircle2 size={48} color="#10b981" style={{ margin: "0 auto 16px" }} />
              <h3 style={{ margin: 0, fontSize: 18, color: "#0f172a" }}>Tidak Ada</h3>
              <p style={{ margin: "8px 0 0", color: "#64748b", fontSize: 14 }}>
                Tidak ada peserta berusia lebih dari 29 tahun.
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Toolbar seleksi + perbaikan otomatis */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", background: "#f8fafc", border: "1px solid #e2e8f0", padding: "12px 16px", borderRadius: 10 }}>
                <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "#334155", cursor: "pointer" }}>
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} style={{ width: 16, height: 16, cursor: "pointer" }} />
                  Pilih semua ({selectedUids.length}/{students.length} dipilih)
                </label>
                <button
                  onClick={() => setConfirmOpen(true)}
                  disabled={selectedUids.length === 0 || autoFixing}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 18px", borderRadius: 8,
                    background: selectedUids.length === 0 || autoFixing ? "#f1f5f9" : "#d97706",
                    color: selectedUids.length === 0 || autoFixing ? "#94a3b8" : "#fff",
                    border: "none", fontWeight: 600, fontSize: 14,
                    cursor: selectedUids.length === 0 || autoFixing ? "not-allowed" : "pointer",
                  }}
                >
                  {autoFixing ? <Loader2 size={16} className="spin" /> : <Wand2 size={16} />}
                  Perbaiki Otomatis ({selectedUids.length})
                </button>
              </div>

              {autoResult && (
                <div style={{ background: "#ecfdf5", color: "#065f46", padding: "10px 14px", borderRadius: 8, fontSize: 13, border: "1px solid #a7f3d0" }}>
                  {autoResult}
                </div>
              )}

              <div style={{ fontSize: 13, fontWeight: 600, color: "#64748b", marginBottom: 4 }}>
                Ditemukan {students.length} peserta (diurutkan dari paling tua)
              </div>

              {students.map((s) => {
                const isSaving = savingIds[s.uid];
                const iso = newDates[s.uid] || "";
                const previewAge = ageFromIso(iso);
                const unchanged = iso === toIsoDate(s.tanggalLahir);
                return (
                  <div key={s.uid} style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", background: selected[s.uid] ? "#fffbeb" : "#fff", border: selected[s.uid] ? "1px solid #fcd34d" : "1px solid #e2e8f0", padding: "16px", borderRadius: 12, boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
                    <input
                      type="checkbox"
                      checked={!!selected[s.uid]}
                      onChange={() => toggleOne(s.uid)}
                      style={{ width: 18, height: 18, cursor: "pointer", flexShrink: 0 }}
                    />
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ fontSize: 15, fontWeight: 600, color: "#0f172a", wordBreak: "break-all" }}>{s.namaLengkap || "(Tanpa nama)"}</div>
                      <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>{s.email}</div>
                      <div style={{ fontSize: 12, color: "#d97706", fontWeight: 600, marginTop: 4 }}>
                        Usia sekarang: {s.umur} tahun {s.tanggalLahir ? `(${s.tanggalLahir})` : ""}
                      </div>
                    </div>
                    <div style={{ minWidth: 200 }}>
                      <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600, marginBottom: 4 }}>Tanggal Lahir Benar:</div>
                      <input
                        type="date"
                        value={iso}
                        onChange={(e) => handleDateChange(s.uid, e.target.value)}
                        style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 14, outline: "none" }}
                      />
                      {previewAge !== null && (
                        <div style={{ fontSize: 12, color: previewAge > 29 ? "#b91c1c" : "#059669", marginTop: 4, fontWeight: 600 }}>
                          → Usia jadi: {previewAge} tahun
                        </div>
                      )}
                    </div>
                    <div>
                      <button
                        onClick={() => handleSave(s.uid)}
                        disabled={isSaving || !iso || unchanged}
                        style={{
                          display: "flex", alignItems: "center", gap: 6, padding: "10px 20px", borderRadius: 8,
                          background: (isSaving || !iso || unchanged) ? "#f1f5f9" : "#2563eb",
                          color: (isSaving || !iso || unchanged) ? "#94a3b8" : "#fff",
                          border: "none", fontWeight: 600, fontSize: 14,
                          cursor: (isSaving || !iso || unchanged) ? "not-allowed" : "pointer",
                        }}
                      >
                        {isSaving ? <Loader2 size={16} className="spin" /> : <Save size={16} />}
                        Simpan
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Popup konfirmasi Perbaiki Otomatis ── */}
      {confirmOpen && (
        <div
          onClick={() => !autoFixing && setConfirmOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, maxWidth: 440, width: "100%", padding: 24, boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: "#fef3c7", color: "#d97706", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <AlertTriangle size={20} />
              </div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#0f172a" }}>Perbaiki Otomatis?</h3>
              <button onClick={() => !autoFixing && setConfirmOpen(false)} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}>
                <X size={18} />
              </button>
            </div>
            <p style={{ fontSize: 14, color: "#475569", lineHeight: 1.6, margin: "0 0 20px" }}>
              Tahun lahir <strong>{selectedUids.length} peserta</strong> yang dipilih akan diganti
              menjadi <strong>tahun acak 1998–2004</strong> (tanggal & bulan dipertahankan bila ada).
              Tindakan ini menimpa data lama dan tidak bisa dibatalkan.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                onClick={() => setConfirmOpen(false)}
                disabled={autoFixing}
                style={{ padding: "10px 18px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff", color: "#475569", fontWeight: 600, fontSize: 14, cursor: "pointer" }}
              >
                Batal
              </button>
              <button
                onClick={handleAutoFix}
                disabled={autoFixing}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 18px", borderRadius: 8, border: "none", background: "#d97706", color: "#fff", fontWeight: 600, fontSize: 14, cursor: autoFixing ? "wait" : "pointer" }}
              >
                {autoFixing ? <Loader2 size={16} className="spin" /> : <Wand2 size={16} />}
                Ya, Perbaiki
              </button>
            </div>
          </div>
        </div>
      )}
    </ProtectedRoute>
  );
}
