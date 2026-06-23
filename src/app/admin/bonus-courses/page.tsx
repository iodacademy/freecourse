"use client";

import { useEffect, useState } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import { Trash2, Plus, Loader2, Pencil, X, AlertTriangle } from "lucide-react";
import styles from "./page.module.css";

interface BonusTopic {
  id: string;
  name: string;
  classCode: string;
  category?: string;
  description?: string;
  groupLink?: string;
  lastSessionDate?: string;
  Kode_Basis?: string;
  status?: string;
}

type ModalMode = "add" | "edit";

export default function AdminBonusCoursesPage() {
  const { user } = useAuth();

  const [topics, setTopics] = useState<BonusTopic[]>([]);
  const [loading, setLoading] = useState(true);

  // Delete confirm modal
  const [deleteTarget, setDeleteTarget] = useState<BonusTopic | null>(null);

  // Add/Edit modal
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>("add");
  const [editId, setEditId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formCategory, setFormCategory] = useState("vl");
  const [formKodeBase, setFormKodeBase] = useState("");
  const [formCode, setFormCode] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formGroupLink, setFormGroupLink] = useState("");
  const [formLastSessionDate, setFormLastSessionDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // Toggle status state
  const [togglingId, setTogglingId] = useState<string | null>(null);

  async function fetchTopics() {
    if (!user) return;
    try {
      const idToken = await user.getIdToken();
      // ?all=1 → ikut tampilkan kelas nonaktif agar bisa diaktifkan kembali.
      const res = await fetch("/api/bonus-courses?all=1", {
        headers: { Authorization: `Bearer ${idToken}` },
        cache: "no-store",
      });
      if (res.ok) setTopics(await res.json());
    } catch (e) {
      console.error("[AdminBonus] fetch error", e);
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleStatus(topic: BonusTopic) {
    if (!user || togglingId) return;
    const next = (topic.status || "active") === "active" ? "inactive" : "active";
    setTogglingId(topic.id);
    // Optimistic update
    setTopics((prev) =>
      prev.map((t) => (t.id === topic.id ? { ...t, status: next } : t))
    );
    try {
      const idToken = await user.getIdToken();
      const res = await fetch(`/api/bonus-courses/${topic.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) throw new Error();
    } catch (e) {
      console.error("[AdminBonus] toggle error", e);
      // Rollback bila gagal
      setTopics((prev) =>
        prev.map((t) => (t.id === topic.id ? { ...t, status: topic.status || "active" } : t))
      );
    } finally {
      setTogglingId(null);
    }
  }

  useEffect(() => { fetchTopics(); }, [user]); // eslint-disable-line

  function openAdd() {
    setModalMode("add");
    setEditId(null);
    setFormName("");
    setFormCategory("vl");
    setFormKodeBase("");
    setFormCode("");
    setFormDescription("");
    setFormGroupLink("");
    setFormLastSessionDate("");
    setSaveError("");
    setShowModal(true);
  }

  function openEdit(topic: BonusTopic) {
    setModalMode("edit");
    setEditId(topic.id);
    setFormName(topic.name);
    setFormCategory(topic.category || "vl");
    setFormKodeBase(topic.Kode_Basis || "");
    setFormCode(topic.classCode);
    setFormDescription(topic.description || "");
    setFormGroupLink(topic.groupLink || "");
    setFormLastSessionDate(topic.lastSessionDate || "");
    setSaveError("");
    setShowModal(true);
  }

  function closeModal() {
    if (saving) return;
    setShowModal(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formName.trim() || !formCode.trim() || !user) return;
    setSaving(true);
    setSaveError("");

    try {
      const idToken = await user.getIdToken();

      if (modalMode === "add") {
        const res = await fetch("/api/bonus-courses", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
          body: JSON.stringify({
            name: formName.trim(),
            category: formCategory,
            kodeBase: formKodeBase.trim().toUpperCase(),
            classCode: formCode.trim().toUpperCase(),
            description: formDescription.trim(),
            groupLink: formGroupLink.trim(),
            lastSessionDate: formLastSessionDate,
          }),
        });
        if (!res.ok) {
          const d = await res.json();
          setSaveError(d.error || "Gagal menambahkan.");
          return;
        }
      } else {
        const res = await fetch(`/api/bonus-courses/${editId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
          body: JSON.stringify({
            name: formName.trim(),
            category: formCategory,
            Kode_Basis: formKodeBase.trim().toUpperCase(),
            classCode: formCode.trim().toUpperCase(),
            description: formDescription.trim(),
            groupLink: formGroupLink.trim(),
            lastSessionDate: formLastSessionDate,
          }),
        });
        if (!res.ok) {
          const d = await res.json();
          setSaveError(d.error || "Gagal menyimpan perubahan.");
          return;
        }
      }

      setShowModal(false);
      await fetchTopics();
    } catch {
      setSaveError("Terjadi kesalahan. Coba lagi.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!user || !deleteTarget) return;
    const id = deleteTarget.id;
    setDeleteTarget(null);
    setDeletingId(id);
    try {
      const idToken = await user.getIdToken();
      await fetch(`/api/bonus-courses/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${idToken}` },
      });
      await fetchTopics();
    } catch (e) {
      console.error("[AdminBonus] delete error", e);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <ProtectedRoute requireAdmin>
      <div className={styles.page}>
        <header className={styles.header}>
          <h1 className={styles.title}>Kelola Kursus Tambahan</h1>
          <p className={styles.subtitle}>
            Daftar topik kursus bonus yang bisa diklaim peserta beasiswa setelah lulus.
          </p>
        </header>

        {/* ── Tabel ── */}
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Kategori</th>
                <th>Judul</th>
                <th>Kode Basis</th>
                <th>Kode Kelas</th>
                <th style={{ width: 120 }}>Status</th>
                <th style={{ width: 96 }}></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className={styles.centerCell}>
                    <Loader2 size={20} style={{ animation: "spin 1s linear infinite", color: "var(--color-primary)", verticalAlign: "middle" }} />
                    {" "}Memuat data...
                  </td>
                </tr>
              ) : topics.length === 0 ? null : (
                topics.map((topic) => {
                  const isActive = (topic.status || "active") === "active";
                  return (
                  <tr key={topic.id} style={isActive ? undefined : { opacity: 0.55 }}>
                    <td>
                      {topic.category === "wpb" ? "WPB" : topic.category === "bootcamp" ? "Bootcamp" : "Video Learning"}
                    </td>
                    <td>{topic.name}</td>
                    <td>
                      {topic.Kode_Basis
                        ? <code className={styles.code}>{topic.Kode_Basis}</code>
                        : <span className={styles.dash}>—</span>}
                    </td>
                    <td>
                      <code className={styles.code}>{topic.classCode}</code>
                    </td>
                    <td>
                      <button
                        type="button"
                        className={`${styles.statusToggle} ${isActive ? styles.statusOn : styles.statusOff}`}
                        onClick={() => handleToggleStatus(topic)}
                        disabled={togglingId === topic.id}
                        title={isActive ? "Klik untuk nonaktifkan (sembunyikan dari siswa)" : "Klik untuk aktifkan"}
                      >
                        {togglingId === topic.id ? (
                          <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />
                        ) : (
                          <>
                            <span className={styles.statusDot} />
                            {isActive ? "Aktif" : "Nonaktif"}
                          </>
                        )}
                      </button>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          className={styles.actionBtn}
                          onClick={() => openEdit(topic)}
                          title="Edit"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          className={`${styles.actionBtn} ${styles.deleteBtn}`}
                          onClick={() => setDeleteTarget(topic)}
                          disabled={deletingId === topic.id}
                          title="Hapus"
                        >
                          {deletingId === topic.id
                            ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
                            : <Trash2 size={14} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })
              )}

              {/* Baris placeholder Tambah Kelas */}
              {!loading && (
                <tr className={styles.addRow} onClick={openAdd}>
                  <td colSpan={6}>
                    <span className={styles.addRowInner}>
                      <Plus size={15} />
                      Tambah Kelas
                    </span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Delete Confirm Modal ── */}
      {deleteTarget && (
        <div className={styles.overlay} onClick={() => setDeleteTarget(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()} style={{ maxWidth: 380 }}>
            <div className={styles.modalHeader}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <AlertTriangle size={20} style={{ color: "#ff4444", flexShrink: 0 }} />
                <h2 className={styles.modalTitle}>Hapus Kelas?</h2>
              </div>
              <button className={styles.closeBtn} onClick={() => setDeleteTarget(null)}>
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: "12px 24px 24px" }}>
              <p style={{ fontSize: 14, color: "var(--color-gray-600)", margin: "0 0 20px" }}>
                Yakin hapus <strong>&ldquo;{deleteTarget.name}&rdquo;</strong>? Tindakan ini tidak bisa dibatalkan.
              </p>
              <div className={styles.modalActions}>
                <button className="btn btn-secondary" onClick={() => setDeleteTarget(null)}>Batal</button>
                <button
                  className="btn btn-primary"
                  style={{ background: "#ff4444", borderColor: "#ff4444" }}
                  onClick={handleDelete}
                >
                  Hapus
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Add / Edit Modal ── */}
      {showModal && (
        <div className={styles.overlay} onClick={closeModal}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>
                {modalMode === "add" ? "Tambah Kelas" : "Edit Kelas"}
              </h2>
              <button className={styles.closeBtn} onClick={closeModal} disabled={saving}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className={styles.form}>
              <div className={styles.formBody}>
                <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                <label className={styles.label} htmlFor="formName">Judul</label>
                <input
                  id="formName"
                  className={styles.input}
                  type="text"
                  placeholder="Contoh: Digital Marketing"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  autoFocus
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="formCategory">Kategori</label>
                <select
                  id="formCategory"
                  className={styles.input}
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                >
                  <option value="vl">Video Learning</option>
                  <option value="wpb">WPB (Workshop / Pelatihan)</option>
                  <option value="bootcamp">Bootcamp</option>
                </select>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="formKodeBase">Kode Basis</label>
                <input
                  id="formKodeBase"
                  className={styles.input}
                  type="text"
                  placeholder="Contoh: BASE01"
                  value={formKodeBase}
                  onChange={(e) => setFormKodeBase(e.target.value.toUpperCase())}
                  maxLength={20}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="formCode">Kode Kelas</label>
                <input
                  id="formCode"
                  className={styles.input}
                  type="text"
                  placeholder="Contoh: BDM45"
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                  maxLength={10}
                  required
                />
              </div>

              {(formCategory === "wpb" || formCategory === "bootcamp") && (
                <>
                  <div className={styles.formGroup}>
                    <label className={styles.label} htmlFor="formLastSessionDate">Tanggal Sesi Terakhir</label>
                    <input
                      id="formLastSessionDate"
                      className={styles.input}
                      type="date"
                      value={formLastSessionDate}
                      onChange={(e) => setFormLastSessionDate(e.target.value)}
                      required
                    />
                  </div>
                  <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                    <label className={styles.label} htmlFor="formDescription">Deskripsi & Jadwal</label>
                    <textarea
                      id="formDescription"
                      className={styles.input}
                      placeholder="Contoh: Kelas ini membahas AI. Jadwal: 12 Nov 2026."
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      rows={3}
                      style={{ resize: "vertical" }}
                      required
                    />
                  </div>
                  <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                    <label className={styles.label} htmlFor="formGroupLink">Link Grup WA</label>
                    <input
                      id="formGroupLink"
                      className={styles.input}
                      type="url"
                      placeholder="https://chat.whatsapp.com/..."
                      value={formGroupLink}
                      onChange={(e) => setFormGroupLink(e.target.value)}
                      required
                    />
                  </div>
                </>
              )}

              {saveError && <p className={styles.errorMsg} style={{ marginTop: 10 }}>{saveError}</p>}
              </div>

              <div className={styles.modalActions}>
                <button type="button" className="btn btn-secondary" onClick={closeModal} disabled={saving}>
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving || !formName.trim() || !formCode.trim()}
                >
                  {saving
                    ? <><Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> Menyimpan...</>
                    : modalMode === "add" ? "Tambah" : "Simpan Perubahan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </ProtectedRoute>
  );
}
