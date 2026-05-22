"use client";

import { useState, useEffect, useCallback } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import styles from "./page.module.css";

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
  const copyLink = (code: string) => {
    const link = `${window.location.origin}/partner/${code}`;
    navigator.clipboard.writeText(link);
    setCopied(code);
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
            ⚠️ {error}
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
            <div className={styles.emptyIcon}>🏷️</div>
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
                            onClick={() => copyLink(pc.code)}
                            title="Salin Link"
                          >
                            {copied === pc.code ? "✓ Tersalin" : "📋 Salin"}
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
                        <button className={styles.iconBtn} onClick={() => openEdit(pc)} title="Edit">✏️</button>
                        <button className={styles.iconBtn} onClick={() => toggleStatus(pc)} title={isActive ? "Nonaktifkan" : "Aktifkan"}>
                          {isActive ? "🚫" : "✅"}
                        </button>
                        <button className={styles.iconBtn} onClick={() => handleDelete(pc)} title="Hapus">🗑️</button>
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
