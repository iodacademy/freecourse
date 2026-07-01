"use client";

import { useEffect, useState } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import { Trash2, Plus, Loader2, Pencil, X, AlertTriangle, Video, GraduationCap, Presentation, Gift, FileText, Download, ArrowLeft } from "lucide-react";
import styles from "./page.module.css";

interface WorkshopData {
  date?: string;
  time?: string;
  platform?: string;
  meetingLink?: string;
  waGroupLink?: string;
}

interface BonusTopic {
  id: string;
  name: string;
  classCode?: string;
  category?: string;
  benefitType?: string;
  description?: string;
  groupLink?: string;
  lastSessionDate?: string;
  Kode_Basis?: string;
  workshopData?: WorkshopData;
  downloadUrl?: string;
  status?: string;
}

type ModalMode = "add" | "edit";

// Kategori yang bisa dipilih di step 1
type CategoryKey = "workshop" | "bootcamp" | "vl" | "lainnya";
// Sub-tipe untuk kategori "Bonus Lainnya"
type LainnyaType = "review_cv" | "downloadable";

/** Label kategori untuk tampilan tabel. */
function categoryLabel(topic: BonusTopic): string {
  const c = topic.category;
  if (c === "workshop") return "Workshop";
  if (c === "bootcamp") return "Bootcamp";
  if (c === "review_cv") return "Bonus Lainnya (Review CV)";
  if (c === "downloadable") return "Bonus Lainnya (Download)";
  if (c === "wpb") return "WPB (lama)";
  return "Video Learning";
}

export default function AdminBonusCoursesPage() {
  const { user } = useAuth();

  const [topics, setTopics] = useState<BonusTopic[]>([]);
  const [loading, setLoading] = useState(true);

  // Tab aktif / arsip (arsip = benefit berstatus nonaktif)
  const [activeTab, setActiveTab] = useState<"active" | "archived">("active");

  // Delete confirm modal
  const [deleteTarget, setDeleteTarget] = useState<BonusTopic | null>(null);

  // Add/Edit modal
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>("add");
  const [wizardStep, setWizardStep] = useState<1 | 2>(1); // 1=pilih kategori, 2=form
  const [editId, setEditId] = useState<string | null>(null);

  // Kategori aktif dalam modal (resolved: vl|bootcamp|workshop|review_cv|downloadable)
  const [formCategory, setFormCategory] = useState<string>("vl");

  // Field umum
  const [formName, setFormName] = useState("");
  const [formKodeBase, setFormKodeBase] = useState("");
  const [formCode, setFormCode] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formGroupLink, setFormGroupLink] = useState("");
  const [formLastSessionDate, setFormLastSessionDate] = useState("");
  // Field workshop
  const [wsDate, setWsDate] = useState("");
  const [wsTime, setWsTime] = useState("");
  const [wsPlatform, setWsPlatform] = useState("Zoom Online");
  const [wsMeetingLink, setWsMeetingLink] = useState("");
  const [wsWaGroupLink, setWsWaGroupLink] = useState("");
  // Field downloadable
  const [downloadUrl, setDownloadUrl] = useState("");

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
      const res = await fetch("/api/bonus-courses?all=1", {
        headers: { Authorization: `Bearer ${idToken}` },
        cache: "no-store",
      });
      if (res.ok) setTopics(await res.json());
    } catch (e) {
      console.error("[AdminBenefit] fetch error", e);
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleStatus(topic: BonusTopic) {
    if (!user || togglingId) return;
    const next = (topic.status || "active") === "active" ? "inactive" : "active";
    setTogglingId(topic.id);
    setTopics((prev) => prev.map((t) => (t.id === topic.id ? { ...t, status: next } : t)));
    try {
      const idToken = await user.getIdToken();
      const res = await fetch(`/api/bonus-courses/${topic.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) throw new Error();
    } catch (e) {
      console.error("[AdminBenefit] toggle error", e);
      setTopics((prev) => prev.map((t) => (t.id === topic.id ? { ...t, status: topic.status || "active" } : t)));
    } finally {
      setTogglingId(null);
    }
  }

  useEffect(() => { fetchTopics(); }, [user]); // eslint-disable-line

  function resetForm() {
    setFormName("");
    setFormKodeBase("");
    setFormCode("");
    setFormDescription("");
    setFormGroupLink("");
    setFormLastSessionDate("");
    setWsDate("");
    setWsTime("");
    setWsPlatform("Zoom Online");
    setWsMeetingLink("");
    setWsWaGroupLink("");
    setDownloadUrl("");
    setSaveError("");
  }

  function openAdd() {
    setModalMode("add");
    setEditId(null);
    setFormCategory("vl");
    resetForm();
    setWizardStep(1);
    setShowModal(true);
  }

  // Pilih kategori di step 1 → lanjut step 2
  function pickCategory(cat: CategoryKey, lainnyaType?: LainnyaType) {
    if (cat === "lainnya") {
      setFormCategory(lainnyaType || "review_cv");
    } else {
      setFormCategory(cat);
    }
    setWizardStep(2);
  }

  function openEdit(topic: BonusTopic) {
    setModalMode("edit");
    setEditId(topic.id);
    setFormCategory(topic.category || "vl");
    setFormName(topic.name);
    setFormKodeBase(topic.Kode_Basis || "");
    setFormCode(topic.classCode || "");
    setFormDescription(topic.description || "");
    setFormGroupLink(topic.groupLink || "");
    setFormLastSessionDate(topic.lastSessionDate || "");
    setWsDate(topic.workshopData?.date || "");
    setWsTime(topic.workshopData?.time || "");
    setWsPlatform(topic.workshopData?.platform || "Zoom Online");
    setWsMeetingLink(topic.workshopData?.meetingLink || "");
    setWsWaGroupLink(topic.workshopData?.waGroupLink || "");
    setDownloadUrl(topic.downloadUrl || "");
    setSaveError("");
    setWizardStep(2); // langsung ke form saat edit
    setShowModal(true);
  }

  function closeModal() {
    if (saving) return;
    setShowModal(false);
  }

  function buildPayload() {
    const benefitType =
      formCategory === "review_cv" ? "review_cv" : formCategory === "downloadable" ? "downloadable" : "course";
    return {
      name: formName.trim(),
      category: formCategory,
      benefitType,
      kodeBase: formKodeBase.trim().toUpperCase(),
      Kode_Basis: formKodeBase.trim().toUpperCase(),
      classCode: formCode.trim().toUpperCase(),
      description: formDescription.trim(),
      groupLink: formGroupLink.trim(),
      lastSessionDate: formLastSessionDate,
      workshopData:
        formCategory === "workshop"
          ? {
              date: wsDate,
              time: wsTime.trim(),
              platform: wsPlatform.trim(),
              meetingLink: wsMeetingLink.trim(),
              waGroupLink: wsWaGroupLink.trim(),
            }
          : undefined,
      downloadUrl: formCategory === "downloadable" ? downloadUrl.trim() : undefined,
    };
  }

  // Validasi minimal per kategori sebelum submit
  function validate(): string | null {
    if (!formName.trim()) return "Judul wajib diisi.";
    if ((formCategory === "vl" || formCategory === "bootcamp") && !formCode.trim())
      return "Kode Kelas wajib diisi.";
    if (formCategory === "workshop" && !wsDate) return "Tanggal workshop wajib diisi.";
    if (formCategory === "downloadable" && !downloadUrl.trim()) return "Link download wajib diisi.";
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const err = validate();
    if (err) { setSaveError(err); return; }
    setSaving(true);
    setSaveError("");

    try {
      const idToken = await user.getIdToken();
      const payload = buildPayload();

      const res =
        modalMode === "add"
          ? await fetch("/api/bonus-courses", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
              body: JSON.stringify(payload),
            })
          : await fetch(`/api/bonus-courses/${editId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
              body: JSON.stringify(payload),
            });

      if (!res.ok) {
        const d = await res.json();
        setSaveError(d.error || "Gagal menyimpan.");
        return;
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
      console.error("[AdminBenefit] delete error", e);
    } finally {
      setDeletingId(null);
    }
  }

  const modalTitle =
    modalMode === "edit"
      ? "Edit Benefit"
      : wizardStep === 1
      ? "Tambah Benefit"
      : `Tambah Benefit — ${categoryLabel({ id: "", name: "", category: formCategory })}`;

  // Pisahkan aktif vs arsip (nonaktif) berdasarkan status.
  const isTopicActive = (t: BonusTopic) => (t.status || "active") === "active";
  const activeCount = topics.filter(isTopicActive).length;
  const archivedCount = topics.length - activeCount;
  const visibleTopics = topics.filter((t) =>
    activeTab === "active" ? isTopicActive(t) : !isTopicActive(t)
  );

  return (
    <ProtectedRoute requireAdmin>
      <div className={styles.page}>
        <header className={styles.header}>
          <h1 className={styles.title}>Kelola Benefit</h1>
          <p className={styles.subtitle}>
            Daftar benefit yang bisa dipilih peserta setelah klaim sertifikat, dikelompokkan per kategori.
          </p>
        </header>

        {/* ── Tab Aktif / Arsip ── */}
        <div className={styles.tabs}>
          <button
            type="button"
            className={`${styles.tab} ${activeTab === "active" ? styles.tabActive : ""}`}
            onClick={() => setActiveTab("active")}
          >
            Aktif{!loading && ` (${activeCount})`}
          </button>
          <button
            type="button"
            className={`${styles.tab} ${activeTab === "archived" ? styles.tabActive : ""}`}
            onClick={() => setActiveTab("archived")}
          >
            Arsip{!loading && ` (${archivedCount})`}
          </button>
        </div>

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
              ) : visibleTopics.length === 0 ? (
                <tr>
                  <td colSpan={6} className={styles.centerCell} style={{ color: "var(--color-gray-500)" }}>
                    {activeTab === "archived"
                      ? "Belum ada benefit di arsip."
                      : "Belum ada benefit. Klik “Tambah Benefit” di bawah."}
                  </td>
                </tr>
              ) : (
                visibleTopics.map((topic) => {
                  const isActive = (topic.status || "active") === "active";
                  return (
                    <tr key={topic.id} style={isActive ? undefined : { opacity: 0.55 }}>
                      <td>{categoryLabel(topic)}</td>
                      <td>{topic.name}</td>
                      <td>
                        {topic.Kode_Basis
                          ? <code className={styles.code}>{topic.Kode_Basis}</code>
                          : <span className={styles.dash}>—</span>}
                      </td>
                      <td>
                        {topic.classCode
                          ? <code className={styles.code}>{topic.classCode}</code>
                          : <span className={styles.dash}>—</span>}
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
                          <button className={styles.actionBtn} onClick={() => openEdit(topic)} title="Edit">
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

              {/* Baris placeholder Tambah — hanya di tab Aktif */}
              {!loading && activeTab === "active" && (
                <tr className={styles.addRow} onClick={openAdd}>
                  <td colSpan={6}>
                    <span className={styles.addRowInner}>
                      <Plus size={15} />
                      Tambah Benefit
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
                <h2 className={styles.modalTitle}>Hapus Benefit?</h2>
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
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {modalMode === "add" && wizardStep === 2 && (
                  <button className={styles.closeBtn} onClick={() => setWizardStep(1)} title="Kembali">
                    <ArrowLeft size={18} />
                  </button>
                )}
                <h2 className={styles.modalTitle}>{modalTitle}</h2>
              </div>
              <button className={styles.closeBtn} onClick={closeModal} disabled={saving}>
                <X size={18} />
              </button>
            </div>

            {/* STEP 1: Pilih Kategori */}
            {modalMode === "add" && wizardStep === 1 && (
              <div className={styles.categoryPicker}>
                <p className={styles.categoryHint}>Pilih kategori benefit yang ingin ditambahkan:</p>
                <div className={styles.categoryGrid}>
                  <button type="button" className={styles.categoryCard} onClick={() => pickCategory("workshop")}>
                    <Presentation size={26} />
                    <span className={styles.categoryCardLabel}>Workshop</span>
                    <span className={styles.categoryCardDesc}>Event dengan jadwal, platform, link meeting & grup WA.</span>
                  </button>
                  <button type="button" className={styles.categoryCard} onClick={() => pickCategory("bootcamp")}>
                    <GraduationCap size={26} />
                    <span className={styles.categoryCardLabel}>Bootcamp</span>
                    <span className={styles.categoryCardDesc}>Kelas intensif dengan kode redeem portal.</span>
                  </button>
                  <button type="button" className={styles.categoryCard} onClick={() => pickCategory("vl")}>
                    <Video size={26} />
                    <span className={styles.categoryCardLabel}>Video Learning</span>
                    <span className={styles.categoryCardDesc}>Akses modul video via kode redeem portal.</span>
                  </button>
                  <button type="button" className={styles.categoryCard} onClick={() => pickCategory("lainnya", "review_cv")}>
                    <FileText size={26} />
                    <span className={styles.categoryCardLabel}>Bonus Lainnya · Review CV</span>
                    <span className={styles.categoryCardDesc}>Peserta upload CV untuk direview tim.</span>
                  </button>
                  <button type="button" className={styles.categoryCard} onClick={() => pickCategory("lainnya", "downloadable")}>
                    <Download size={26} />
                    <span className={styles.categoryCardLabel}>Bonus Lainnya · Konten Downloadable</span>
                    <span className={styles.categoryCardDesc}>E-book, template, tracker — judul + link download.</span>
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: Form */}
            {(wizardStep === 2 || modalMode === "edit") && (
              <form onSubmit={handleSubmit} className={styles.form}>
                <div className={styles.formBody}>
                  {/* Judul (semua kategori) */}
                  <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                    <label className={styles.label} htmlFor="formName">Judul</label>
                    <input
                      id="formName"
                      className={styles.input}
                      type="text"
                      placeholder={
                        formCategory === "workshop" ? "Contoh: Workshop Literasi Finansial Gen-Z" :
                        formCategory === "review_cv" ? "Contoh: Beasiswa Review CV" :
                        formCategory === "downloadable" ? "Contoh: E-Book Panduan Menabung" :
                        "Contoh: Digital Marketing"
                      }
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      autoFocus
                      required
                    />
                  </div>

                  {/* ── VL / BOOTCAMP ── */}
                  {(formCategory === "vl" || formCategory === "bootcamp") && (
                    <>
                      <div className={styles.formGroup}>
                        <label className={styles.label} htmlFor="formKodeBase">Kode Basis</label>
                        <input id="formKodeBase" className={styles.input} type="text" placeholder="Contoh: BASE01"
                          value={formKodeBase} onChange={(e) => setFormKodeBase(e.target.value.toUpperCase())} maxLength={20} />
                      </div>
                      <div className={styles.formGroup}>
                        <label className={styles.label} htmlFor="formCode">Kode Kelas</label>
                        <input id="formCode" className={styles.input} type="text" placeholder="Contoh: BDM45"
                          value={formCode} onChange={(e) => setFormCode(e.target.value.toUpperCase())} maxLength={10} required />
                      </div>
                    </>
                  )}

                  {/* ── BOOTCAMP extra ── */}
                  {formCategory === "bootcamp" && (
                    <>
                      <div className={styles.formGroup}>
                        <label className={styles.label} htmlFor="formLastSessionDate">Tanggal Sesi Terakhir</label>
                        <input id="formLastSessionDate" className={styles.input} type="date"
                          value={formLastSessionDate} onChange={(e) => setFormLastSessionDate(e.target.value)} />
                      </div>
                      <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                        <label className={styles.label} htmlFor="formDescription">Deskripsi & Jadwal</label>
                        <textarea id="formDescription" className={styles.input} rows={3} style={{ resize: "vertical" }}
                          placeholder="Contoh: Kelas ini membahas AI. Jadwal: 12 Nov 2026."
                          value={formDescription} onChange={(e) => setFormDescription(e.target.value)} />
                      </div>
                      <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                        <label className={styles.label} htmlFor="formGroupLink">Link Grup WA</label>
                        <input id="formGroupLink" className={styles.input} type="url" placeholder="https://chat.whatsapp.com/..."
                          value={formGroupLink} onChange={(e) => setFormGroupLink(e.target.value)} />
                      </div>
                    </>
                  )}

                  {/* ── WORKSHOP ── */}
                  {formCategory === "workshop" && (
                    <>
                      <div className={styles.formGroup}>
                        <label className={styles.label} htmlFor="wsDate">Tanggal</label>
                        <input id="wsDate" className={styles.input} type="date" value={wsDate}
                          onChange={(e) => setWsDate(e.target.value)} required />
                      </div>
                      <div className={styles.formGroup}>
                        <label className={styles.label} htmlFor="wsTime">Jam</label>
                        <input id="wsTime" className={styles.input} type="text" placeholder="09.00-12.00 WIB"
                          value={wsTime} onChange={(e) => setWsTime(e.target.value)} />
                      </div>
                      <div className={styles.formGroup}>
                        <label className={styles.label} htmlFor="wsPlatform">Platform</label>
                        <input id="wsPlatform" className={styles.input} type="text" placeholder="Zoom Online / Offline / Google Meet"
                          value={wsPlatform} onChange={(e) => setWsPlatform(e.target.value)} />
                      </div>
                      <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                        <label className={styles.label} htmlFor="wsMeetingLink">Link Meeting (untuk email)</label>
                        <input id="wsMeetingLink" className={styles.input} type="url" placeholder="https://zoom.us/j/... atau https://meet.google.com/..."
                          value={wsMeetingLink} onChange={(e) => setWsMeetingLink(e.target.value)} />
                      </div>
                      <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                        <label className={styles.label} htmlFor="wsWaGroupLink">Grup WhatsApp (untuk email)</label>
                        <input id="wsWaGroupLink" className={styles.input} type="url" placeholder="https://chat.whatsapp.com/..."
                          value={wsWaGroupLink} onChange={(e) => setWsWaGroupLink(e.target.value)} />
                      </div>
                      <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                        <label className={styles.label} htmlFor="formDescription">Deskripsi (opsional)</label>
                        <textarea id="formDescription" className={styles.input} rows={3} style={{ resize: "vertical" }}
                          placeholder="Deskripsi singkat workshop..."
                          value={formDescription} onChange={(e) => setFormDescription(e.target.value)} />
                      </div>
                    </>
                  )}

                  {/* ── REVIEW CV ── */}
                  {formCategory === "review_cv" && (
                    <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                      <label className={styles.label} htmlFor="formDescription">Instruksi / Deskripsi (opsional)</label>
                      <textarea id="formDescription" className={styles.input} rows={3} style={{ resize: "vertical" }}
                        placeholder="Contoh: Upload CV terbaru kamu (PDF, maks 5MB). Tim kami akan mereview dalam 3 hari kerja."
                        value={formDescription} onChange={(e) => setFormDescription(e.target.value)} />
                    </div>
                  )}

                  {/* ── DOWNLOADABLE ── */}
                  {formCategory === "downloadable" && (
                    <>
                      <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                        <label className={styles.label} htmlFor="downloadUrl">Link Download</label>
                        <input id="downloadUrl" className={styles.input} type="url" placeholder="https://drive.google.com/... atau link lain"
                          value={downloadUrl} onChange={(e) => setDownloadUrl(e.target.value)} required />
                      </div>
                      <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                        <label className={styles.label} htmlFor="formDescription">Deskripsi (opsional)</label>
                        <textarea id="formDescription" className={styles.input} rows={3} style={{ resize: "vertical" }}
                          placeholder="Deskripsi singkat konten..."
                          value={formDescription} onChange={(e) => setFormDescription(e.target.value)} />
                      </div>
                    </>
                  )}

                  {saveError && <p className={styles.errorMsg} style={{ marginTop: 10 }}>{saveError}</p>}
                </div>

                <div className={styles.modalActions}>
                  <button type="button" className="btn btn-secondary" onClick={closeModal} disabled={saving}>
                    Batal
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={saving || !formName.trim()}>
                    {saving
                      ? <><Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> Menyimpan...</>
                      : modalMode === "add" ? "Tambah" : "Simpan Perubahan"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </ProtectedRoute>
  );
}
