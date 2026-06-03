"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import { ChevronLeft, Save, Loader2, UserX, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { isSuspiciousName } from "@/lib/utils";

export default function FixNamesPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<any[]>([]);
  const [savingIds, setSavingIds] = useState<Record<string, boolean>>({});
  const [newNames, setNewNames] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

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
      
      const res = await fetch(`/api/admin/dashboard/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Gagal mengambil data siswa");
      
      const data = await res.json();
      const allStudents = data.students || [];
      
      // Filter hanya yang namanya mencurigakan
      const suspicious = allStudents.filter((s: any) => isSuspiciousName(s.namaLengkap));
      
      // Init state input
      const initialNames: Record<string, string> = {};
      suspicious.forEach((s: any) => {
        initialNames[s.uid] = s.namaLengkap || "";
      });
      
      setNewNames(initialNames);
      setStudents(suspicious);
    } catch (e: any) {
      setError(e.message || "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleNameChange = (uid: string, val: string) => {
    setNewNames(prev => ({ ...prev, [uid]: val }));
  };

  const handleSave = async (uid: string) => {
    const updatedName = newNames[uid];
    if (!updatedName || updatedName.trim().length < 3) {
      alert("Nama minimal 3 karakter.");
      return;
    }

    setSavingIds(prev => ({ ...prev, [uid]: true }));
    try {
      const token = await getToken();
      const res = await fetch(`/api/admin/students/${uid}/profile`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ newName: updatedName })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan");
      
      // Hapus dari list karena sudah tidak suspicious (asumsi diperbaiki)
      setStudents(prev => prev.filter(s => s.uid !== uid));
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSavingIds(prev => ({ ...prev, [uid]: false }));
    }
  };

  return (
    <ProtectedRoute requireAdmin>
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "40px 20px" }}>
        
        <Link href="/admin/students" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#64748b", textDecoration: "none", fontSize: 14, marginBottom: 24, fontWeight: 500 }}>
          <ChevronLeft size={16} /> Kembali ke Kelola Siswa
        </Link>
        
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: "#fee2e2", color: "#ef4444", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <UserX size={24} />
          </div>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: "#0f172a", margin: 0 }}>Perbaiki Nama Aneh</h1>
            <p style={{ color: "#64748b", margin: 0, fontSize: 14, marginTop: 4 }}>
              Daftar peserta yang namanya terdeteksi sebagai ketikan asal atau anonim.
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
              <h3 style={{ margin: 0, fontSize: 18, color: "#0f172a" }}>Semua Bersih!</h3>
              <p style={{ margin: "8px 0 0", color: "#64748b", fontSize: 14 }}>
                Tidak ada nama peserta yang terdeteksi aneh atau asal-asalan.
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#64748b", marginBottom: 8 }}>
                Ditemukan {students.length} peserta
              </div>
              
              {students.map(s => {
                const isSaving = savingIds[s.uid];
                return (
                  <div key={s.uid} style={{ display: "flex", alignItems: "center", gap: 16, background: "#fff", border: "1px solid #e2e8f0", padding: "16px", borderRadius: 12, boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ fontSize: 12, color: "#ef4444", fontWeight: 600, marginBottom: 4 }}>Nama Sekarang:</div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: "#0f172a", wordBreak: "break-all" }}>{s.namaLengkap || "(Kosong)"}</div>
                      <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>{s.email}</div>
                    </div>
                    <div style={{ flex: 1, minWidth: 250 }}>
                      <input 
                        type="text"
                        value={newNames[s.uid] || ""}
                        onChange={(e) => handleNameChange(s.uid, e.target.value)}
                        placeholder="Ketik nama yang benar..."
                        style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 14, outline: "none", transition: "border 0.2s" }}
                        onFocus={(e) => e.target.style.borderColor = "#3b82f6"}
                        onBlur={(e) => e.target.style.borderColor = "#cbd5e1"}
                      />
                    </div>
                    <div>
                      <button
                        onClick={() => handleSave(s.uid)}
                        disabled={isSaving || !newNames[s.uid] || newNames[s.uid].trim() === s.namaLengkap}
                        style={{ 
                          display: "flex", 
                          alignItems: "center", 
                          gap: 6, 
                          padding: "10px 20px", 
                          borderRadius: 8, 
                          background: (isSaving || !newNames[s.uid] || newNames[s.uid].trim() === s.namaLengkap) ? "#f1f5f9" : "#2563eb", 
                          color: (isSaving || !newNames[s.uid] || newNames[s.uid].trim() === s.namaLengkap) ? "#94a3b8" : "#fff", 
                          border: "none", 
                          fontWeight: 600, 
                          fontSize: 14,
                          cursor: (isSaving || !newNames[s.uid] || newNames[s.uid].trim() === s.namaLengkap) ? "not-allowed" : "pointer",
                          transition: "all 0.2s"
                        }}
                      >
                        {isSaving ? <Loader2 size={16} className="spin" /> : <Save size={16} />}
                        Save
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
