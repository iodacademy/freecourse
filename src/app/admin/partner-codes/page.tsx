"use client";

import { useState, useEffect, useCallback } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import styles from "./page.module.css";
import { AlertTriangle, Copy, Check } from "lucide-react";

interface PartnerCode {
  id: string;
  code: string;
  partnerName: string;
  eventId: string;
  courseId: string;
  status: "active" | "disabled";
  quota: number;
  usedCount: number;
  usedBy: string[];
  createdAt: any;
}

export default function AdminPartnerCodesPage() {
  const { user } = useAuth();
  const [codes, setCodes] = useState<PartnerCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingCode, setEditingCode] = useState<PartnerCode | null>(null);
  const [formData, setFormData] = useState({
    code: "",
    partnerName: "",
    quota: 100,
  });
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const getToken = useCallback(async () => {
    if (!user) return "";
    try { return await (user as any).getIdToken(); } catch { return ""; }
  }, [user]);

  // Fetch partner codes
  const fetchCodes = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      const res = await fetch("/api/partner-codes", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Gagal memuat data");
      const data = await res.json();
      setCodes(data);
    } catch (e: any) {
      setError(e.message || "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    fetchCodes();
  }, [fetchCodes]);

  // Create / Update
  const handleSave = async () => {
    if (!formData.code.trim() || !formData.partnerName.trim()) {
      setError("Kode dan Nama Mitra wajib diisi");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const token = await getToken();
      if (editingCode) {
        // Update
        await fetch(`/api/partner-codes/${editingCode.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ partnerName: formData.partnerName, quota: formData.quota }),
        });
      } else {
        // Create
        const res = await fetch("/api/partner-codes", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(formData),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Gagal membuat kode");
      }
      setShowModal(false);
      setEditingCode(null);
      setFormData({ code: "", partnerName: "", quota: 100 });
      await fetchCodes();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  // Toggle status
  const toggleStatus = async (pc: PartnerCode) => {
    try {
      const token = await getToken();
      await fetch(`/api/partner-codes/${pc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: pc.status === "active" ? "disabled" : "active" }),
      });
      await fetchCodes();
    } catch (e: any) {
      setError(e.message);
    }
  };

  // Delete
  const handleDelete = async (pc: PartnerCode) => {
    if (!confirm(`Hapus kode "${pc.code}"? Aksi ini tidak bisa dibatalkan.`)) return;
    try {
      const token = await getToken();
      await fetch(`/api/partner-codes/${pc.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      await fetchCodes();
    } catch (e: any) {
      setError(e.message);
    }
  };

  // Copy link
  const copyLink = (pc: PartnerCode) => {
    const link = `${window.location.origin}/partner/${pc.code}`;
    navigator.clipboard.writeText(link);
    setCopied(pc.code);
    setTimeout(() => setCopied(null), 2000);
  };

  // Open modal for create
  const openCreate = () => {
    setEditingCode(null);
    setFormData({ code: "", partnerName: "", quota: 100 });
    setError("");
    setShowModal(true);
  };

  // Open modal for edit
  const openEdit = (pc: PartnerCode) => {
    setEditingCode(pc);
    setFormData({ code: pc.code, partnerName: pc.partnerName, quota: pc.quota });
    setError("");
    setShowModal(true);
  };

  return (
    <ProtectedRoute requireAdmin>
      <div className={styles.page}>
        <header className={styles.header}>
          <div>
            <h1 className={styles.title}>Kelola Kode Mitra</h1>
            <p className={styles.subtitle}>Buat kode unik untuk pendaftaran via Channel Kemitraan (B2B).</p>
          </div>
          <button className="btn btn-primary" onClick={openCreate}>+ Buat Kode Baru</button>
        </header>

        {error && (
          <div className={styles.errorBanner}>
            <AlertTriangle size={18} /> {error}
            <button onClick={() => setError("")} className={styles.errorClose}>×</button>
          </div>
        )}

        {loading ? (
          <div className={styles.loadingWrap}>
            <div className={styles.spinner} />
            <p>Memuat data kode mitra...</p>
          </div>
        ) : codes.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-gray-400)' }}><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>
            </div>
            <h3>Belum Ada Kode Mitra</h3>
            <p>Klik tombol &quot;+ Buat Kode Baru&quot; untuk membuat kode mitra pertama.</p>
          </div>
        ) : (
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Kode Mitra</th>
                  <th>Nama Institusi / Mitra</th>
                  <th>Link Pendaftaran</th>
                  <th>Kuota Terpakai</th>
                  <th>Status</th>
                  <th className={styles.actionsCell}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {codes.map((pc) => {
                  const isFull = pc.quota > 0 && pc.usedCount >= pc.quota;
                  const isActive = pc.status === "active";
                  const partnerLink = `/partner/${pc.code}`;
                  return (
                    <tr key={pc.id} className={!isActive ? styles.inactiveRow : ""}>
                      <td>
                        <code className={styles.codeBadge}>{pc.code}</code>
                      </td>
                      <td className={styles.fw500}>{pc.partnerName}</td>
                      <td>
                        <div className={styles.linkCell}>
                          <span className={styles.linkText}>{partnerLink}</span>
                          <button
                            className={`${styles.copyBtn} ${copied === pc.code ? styles.copyBtnDone : ""}`}
                            onClick={() => copyLink(pc)}
                            title="Salin Link Pendaftaran"
                          >
                            {copied === pc.code ? (
                              <><Check size={14} /> Tersalin</>
                            ) : (
                              <><Copy size={14} /> Salin</>
                            )}
                          </button>
                        </div>
                      </td>
                      <td>
                        <div className={styles.quotaInfo}>
                          <span className={`${styles.quotaText} ${isFull ? styles.quotaFullText : ""}`}>
                            {pc.usedCount} / {pc.quota || "∞"}
                          </span>
                          {pc.quota > 0 && (
                            <div className={styles.quotaBar}>
                              <div
                                className={`${styles.quotaFill} ${isFull ? styles.quotaFullFill : ""}`}
                                style={{ width: `${Math.min((pc.usedCount / pc.quota) * 100, 100)}%` }}
                              />
                            </div>
                          )}
                        </div>
                      </td>
                      <td>
                        {isActive ? (
                          <span className={`${styles.statusBadge} ${styles.active}`}>Aktif</span>
                        ) : (
                          <span className={`${styles.statusBadge} ${styles.inactive}`}>Nonaktif</span>
                        )}
                      </td>
                      <td className={styles.actionsCell}>
                        <button className={styles.actionBtn} onClick={() => openEdit(pc)} title="Edit">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                          Edit
                        </button>
                        <button className={styles.actionBtn} onClick={() => toggleStatus(pc)} title={isActive ? "Nonaktifkan" : "Aktifkan"}>
                          {isActive ? (
                            <><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg> Nonaktifkan</>
                          ) : (
                            <><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg> Aktifkan</>
                          )}
                        </button>
                        <button className={`${styles.actionBtn} ${styles.dangerBtn}`} onClick={() => handleDelete(pc)} title="Hapus">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                          Hapus
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── Create / Edit Modal ─── */}
      {showModal && (
        <div className={styles.modalBackdrop} onClick={() => setShowModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>{editingCode ? "Edit Kode Mitra" : "Buat Kode Mitra Baru"}</h2>
              <button className={styles.modalClose} onClick={() => setShowModal(false)}>×</button>
            </div>

            <div className={styles.modalBody}>
              {/* Kode */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Kode Mitra</label>
                <input
                  className={styles.formInput}
                  type="text"
                  placeholder="Contoh: KAMPUS-UNIV-X"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase().replace(/\s/g, "-") })}
                  disabled={!!editingCode}
                />
                {!editingCode && (
                  <span className={styles.formHint}>
                    Kode ini akan menjadi URL: <code>/partner/{formData.code || "KODE"}</code>
                  </span>
                )}
              </div>

              {/* Nama Mitra */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Nama Institusi / Mitra</label>
                <input
                  className={styles.formInput}
                  type="text"
                  placeholder="Contoh: Universitas Indonesia"
                  value={formData.partnerName}
                  onChange={(e) => setFormData({ ...formData, partnerName: e.target.value })}
                />
              </div>

              {/* Kuota */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Kuota Peserta</label>
                <input
                  className={styles.formInput}
                  type="number"
                  min={0}
                  placeholder="0 = tanpa batas"
                  value={formData.quota}
                  onChange={(e) => setFormData({ ...formData, quota: parseInt(e.target.value) || 0 })}
                />
                <span className={styles.formHint}>Isi 0 untuk kuota tanpa batas</span>
              </div>

              {/* Preview Link */}
              {!editingCode && formData.code && (
                <div className={styles.linkPreview}>
                  <div className={styles.linkPreviewLabel}>Link Pendaftaran:</div>
                  <code className={styles.linkPreviewUrl}>
                    {typeof window !== "undefined" ? window.location.origin : ""}/partner/{formData.code}
                  </code>
                </div>
              )}
            </div>

            <div className={styles.modalFooter}>
              <button className={styles.modalBtnCancel} onClick={() => setShowModal(false)}>Batal</button>
              <button className={styles.modalBtnSave} onClick={handleSave} disabled={saving}>
                {saving ? "Menyimpan..." : editingCode ? "Simpan Perubahan" : "Buat Kode Mitra"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ProtectedRoute>
  );
}
