"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import styles from "./page.module.css";
import { AlertTriangle, Copy, Check, School, Target, Mic, Search, X, Upload, User, ImageIcon, Calendar, Clock, Monitor, ChevronRight, ArrowLeft } from "lucide-react";
import { ConfirmDialog } from "@/components/Modal/Dialogs";

interface EventData {
  id: string;
  name: string;
  description: string | null;
  channelType: string;
  status: "active" | "draft" | "ended";
  courseId: string | null;
  startDate: string | null;
  endDate: string | null;
  campusName: string | null;
  partnerCode: string | null;
  createdAt: any;
}

const CHANNEL_LABELS: Record<string, string> = {
  b2b_campus: "Kemitraan (B2B)",
  b2c_ads: "Beasiswa / Ads",
  b2c_workshop: "Workshop",
};

const CHANNEL_PATHS: Record<string, string> = {
  b2b_campus: "/partner",
  b2c_ads: "/beasiswa",
  b2c_workshop: "/workshop",
};

export default function AdminEventsPage() {
  const { user } = useAuth();
  const [events, setEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const [activeSearch, setActiveSearch] = useState("");

  // Modal — 2-step wizard
  const [showModal, setShowModal] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2>(1);        // 1=pilih channel, 2=form
  const [editing, setEditing] = useState<EventData | null>(null);
  const [confirmDeleteEvent, setConfirmDeleteEvent] = useState<EventData | null>(null);

  // Form umum
  const [form, setForm] = useState({
    name: "",
    description: "",
    channelType: "b2c_workshop" as string,
    status: "draft" as string,
    startDate: "",
    partnerCode: "",
  });

  // Form khusus workshop
  const [workshopForm, setWorkshopForm] = useState({
    date: "",           // ISO: "2026-06-15"
    dayLabel: "",       // Manual: "Sabtu"
    time: "",           // Manual: "09.00-12.00 WIB"
    platform: "Zoom Online",
    meetingLink: "",
    waGroupLink: "",
    speakerName: "",
    speakerTitle: "",
    speakerPhoto: "",
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const getToken = useCallback(async () => {
    if (!user) return "";
    try { return await (user as any).getIdToken(); } catch { return ""; }
  }, [user]);

  // Fetch events
  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      const res = await fetch("/api/events", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Gagal memuat data");
      const data = await res.json();
      setEvents(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  // Filtered — channel + search lokal
  const filtered = events.filter((e) => {
    const matchChannel = filter === "all" || e.channelType === filter;
    if (!activeSearch) return matchChannel;
    const q = activeSearch.toLowerCase();
    return matchChannel && (
      e.name.toLowerCase().includes(q) ||
      (e.partnerCode || "").toLowerCase().includes(q) ||
      (e.campusName || "").toLowerCase().includes(q)
    );
  });

  const handleSearch = (ev: React.KeyboardEvent<HTMLInputElement>) => {
    if (ev.key !== "Enter") return;
    setActiveSearch(searchInput.trim());
  };

  const handleClearSearch = () => {
    setSearchInput("");
    setActiveSearch("");
  };

  // Upload foto pemateri
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const uploadPhoto = async (slug: string): Promise<string> => {
    if (!photoFile) return workshopForm.speakerPhoto;
    setUploadingPhoto(true);
    try {
      const token = await getToken();
      const fd = new FormData();
      fd.append("file", photoFile);
      fd.append("path", `workshop-speakers/${slug}/photo`);
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (!res.ok) throw new Error("Gagal upload foto");
      const { url } = await res.json();
      return url;
    } finally {
      setUploadingPhoto(false);
    }
  };

  // Create / Update
  const handleSave = async () => {
    if (!form.name.trim()) {
      setError("Judul / nama event wajib diisi");
      return;
    }
    if (form.channelType === "b2b_campus" && !form.partnerCode.trim()) {
      setError("Kode Mitra wajib diisi untuk channel Kemitraan (B2B)");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const token = await getToken();
      const isWorkshop = form.channelType === "b2c_workshop";

      // Kalau workshop & ada foto baru → upload dulu
      let photoUrl = workshopForm.speakerPhoto;
      if (isWorkshop && photoFile) {
        const slug = form.name.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-");
        photoUrl = await uploadPhoto(slug);
      }

      const workshopData = isWorkshop ? {
        title: form.name,
        date: workshopForm.date,           // ISO: "2026-06-15"
        dayLabel: workshopForm.dayLabel,   // "Sabtu"
        time: workshopForm.time,           // "09.00-12.00 WIB"
        platform: workshopForm.platform,
        meetingLink: workshopForm.meetingLink,
        waGroupLink: workshopForm.waGroupLink,
        speakerName: workshopForm.speakerName,
        speakerTitle: workshopForm.speakerTitle,
        speakerPhoto: photoUrl,
      } : null;

      const payload = {
        name: form.name,
        description: form.description,
        channelType: form.channelType,
        status: form.status,
        startDate: form.startDate || null,
        partnerCode: form.channelType === "b2b_campus" ? form.partnerCode : null,
        workshopData,
      };

      if (editing) {
        const res = await fetch(`/api/events/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload),
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Gagal menyimpan"); }
      } else {
        const res = await fetch("/api/events", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload),
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Gagal membuat event"); }
      }
      closeModal();
      await fetchEvents();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  // Toggle status
  const toggleStatus = async (evt: EventData) => {
    try {
      const token = await getToken();
      const newStatus = evt.status === "active" ? "draft" : "active";
      await fetch(`/api/events/${evt.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus }),
      });
      await fetchEvents();
    } catch (e: any) {
      setError(e.message);
    }
  };

  // Delete
  const handleDelete = (evt: EventData) => {
    setConfirmDeleteEvent(evt);
  };

  const executeDelete = async () => {
    if (!confirmDeleteEvent) return;
    try {
      const token = await getToken();
      await fetch(`/api/events/${confirmDeleteEvent.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      await fetchEvents();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setConfirmDeleteEvent(null);
    }
  };

  // Get link for event
  const getEventLink = (evt: EventData) => {
    if (evt.channelType === "b2b_campus" && evt.partnerCode) {
      return `/partner/${evt.partnerCode.toLowerCase()}`;
    }
    const basePath = CHANNEL_PATHS[evt.channelType] || "/beasiswa";
    return `${basePath}/${evt.id}`;
  };

  // Copy link
  const copyLink = (evt: EventData) => {
    const link = `${window.location.origin}${getEventLink(evt)}`;
    navigator.clipboard.writeText(link);
    setCopied(evt.id);
    setTimeout(() => setCopied(null), 2000);
  };

  // Modal helpers
  const openCreate = () => {
    setEditing(null);
    setWizardStep(1);
    setForm({ name: "", description: "", channelType: "b2c_workshop", status: "draft", startDate: "", partnerCode: "" });
    setWorkshopForm({ date: "", dayLabel: "", time: "", platform: "Zoom Online", meetingLink: "", waGroupLink: "", speakerName: "", speakerTitle: "", speakerPhoto: "" });
    setPhotoFile(null);
    setPhotoPreview("");
    setError("");
    setShowModal(true);
  };

  const openEdit = (evt: EventData) => {
    let formattedDate = "";
    if (evt.startDate) {
      try {
        const ms = (typeof evt.startDate === 'object' && '_seconds' in (evt.startDate as any))
          ? (evt.startDate as any)._seconds * 1000
          : evt.startDate;
        formattedDate = new Date(ms).toISOString().split("T")[0];
      } catch (e) { console.error("Invalid date", evt.startDate); }
    }
    const wd = (evt as any).workshopData;
    setEditing(evt);
    setWizardStep(2);
    setForm({
      name: evt.name,
      description: evt.description || "",
      channelType: evt.channelType,
      status: evt.status,
      startDate: formattedDate,
      partnerCode: evt.partnerCode || "",
    });
    setWorkshopForm({
      date: wd?.date || "",
      dayLabel: wd?.dayLabel || "",
      time: wd?.time || "",
      platform: wd?.platform || "Zoom Online",
      meetingLink: wd?.meetingLink || "",
      waGroupLink: wd?.waGroupLink || "",
      speakerName: wd?.speakerName || "",
      speakerTitle: wd?.speakerTitle || "",
      speakerPhoto: wd?.speakerPhoto || "",
    });
    setPhotoFile(null);
    setPhotoPreview(wd?.speakerPhoto || "");
    setError("");
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
    setWizardStep(1);
    setPhotoFile(null);
    setPhotoPreview("");
  };

  return (
    <ProtectedRoute requireAdmin>
      <div className={styles.page}>
        <header className={styles.header}>
          <div>
            <h1 className={styles.title}>Kelola Event & Channel</h1>
            <p className={styles.subtitle}>Buat event baru, dapatkan link pendaftaran untuk setiap channel.</p>
          </div>
          <button className="btn btn-primary" onClick={openCreate}>+ Buat Event Baru</button>
        </header>

        {error && (
          <div className={styles.errorBanner}>
            <AlertTriangle size={18} /> {error}
            <button onClick={() => setError("")} className={styles.errorClose}>×</button>
          </div>
        )}

        <div className={styles.filterBar}>
          <div className={styles.filters}>
            {[
              { key: "all", label: "Semua Event", icon: null },
              { key: "b2b_campus", label: "Kemitraan", icon: <School size={16} /> },
              { key: "b2c_ads", label: "Beasiswa/Ads", icon: <Target size={16} /> },
              { key: "b2c_workshop", label: "Workshop", icon: <Mic size={16} /> },
            ].map((f) => (
              <button
                key={f.key}
                className={`${styles.filterBtn} ${filter === f.key ? styles.active : ""}`}
                onClick={() => { setFilter(f.key); setActiveSearch(""); setSearchInput(""); }}
              >
                {f.icon && <span style={{ marginRight: '6px', display: 'inline-flex', verticalAlign: 'middle' }}>{f.icon}</span>}
                {f.label}
              </button>
            ))}
          </div>
          <div className={styles.searchWrap}>
            <Search size={15} className={styles.searchIcon} />
            <input
              className={styles.searchInput}
              type="text"
              placeholder="Cari nama event, kode mitra... (Enter)"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={handleSearch}
            />
            {(searchInput || activeSearch) && (
              <button className={styles.searchClear} onClick={handleClearSearch}>
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className={styles.loadingWrap}>
            <div className={styles.spinner} />
            <p>Memuat data event...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-gray-400)' }}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
            </div>
            <h3>Belum Ada Event</h3>
            <p>Klik &quot;+ Buat Event Baru&quot; untuk memulai.</p>
          </div>
        ) : (
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Nama Event</th>
                  <th>Channel</th>
                  <th>Link Pendaftaran</th>
                  <th>Status</th>
                  <th className={styles.actionsCell}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((evt) => {
                  const isActive = evt.status === "active";
                  const link = getEventLink(evt);
                  return (
                    <tr key={evt.id} className={!isActive ? styles.inactiveRow : ""}>
                      <td>
                        <div className={styles.fw500}>{evt.name}</div>
                        {evt.description && (
                          <div className={styles.textSm} style={{ color: "var(--color-gray-500)", marginTop: 2 }}>
                            {evt.description.substring(0, 60)}{evt.description.length > 60 ? "..." : ""}
                          </div>
                        )}
                      </td>
                      <td>
                        <div className={styles.channelBadge}>
                          {CHANNEL_LABELS[evt.channelType] || evt.channelType}
                        </div>
                      </td>
                      <td>
                        <div className={styles.linkCell}>
                          <span className={styles.linkText}>{link}</span>
                          <button
                            className={styles.copyBtn}
                            onClick={() => copyLink(evt)}
                            title="Salin Link Pendaftaran"
                          >
                            {copied === evt.id ? (
                              <><Check size={14} /> Tersalin</>
                            ) : (
                              <><Copy size={14} /> Salin</>
                            )}
                          </button>
                        </div>
                      </td>
                      <td>
                        <span className={`${styles.statusBadge} ${styles[evt.status]}`}>
                          {isActive ? "Aktif" : evt.status === "draft" ? "Draft" : "Selesai"}
                        </span>
                      </td>
                      <td className={styles.actionsCell}>
                        <button className={styles.actionBtn} onClick={() => openEdit(evt)} title="Edit">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                          Edit
                        </button>
                        <button className={styles.actionBtn} onClick={() => toggleStatus(evt)} title={isActive ? "Nonaktifkan" : "Aktifkan"}>
                          {isActive ? (
                            <><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg> Nonaktifkan</>
                          ) : (
                            <><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg> Aktifkan</>
                          )}
                        </button>
                        <button className={`${styles.actionBtn} ${styles.dangerBtn}`} onClick={() => handleDelete(evt)} title="Hapus">
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

      {/* ═══ MODAL — 2-step Wizard ═══ */}
      {showModal && (
        <div className={styles.modalBackdrop} onClick={closeModal}>
          <div className={`${styles.modal} ${form.channelType === "b2c_workshop" && wizardStep === 2 ? styles.modalWide : ""}`} onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className={styles.modalHeader}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {!editing && wizardStep === 2 && (
                  <button className={styles.backBtn} onClick={() => setWizardStep(1)} title="Kembali">
                    <ArrowLeft size={16} />
                  </button>
                )}
                <div>
                  <h2 style={{ margin: 0, fontSize: 18 }}>
                    {editing ? `Edit Event — ${form.channelType === "b2c_workshop" ? "Workshop" : form.channelType === "b2b_campus" ? "Kemitraan" : "Beasiswa/Ads"}` : wizardStep === 1 ? "Buat Event Baru" : `Form ${form.channelType === "b2c_workshop" ? "Workshop" : form.channelType === "b2b_campus" ? "Kemitraan" : "Beasiswa/Ads"}`}
                  </h2>
                  {!editing && (
                    <p style={{ margin: 0, fontSize: 12, color: "var(--color-gray-500)", marginTop: 2 }}>
                      {wizardStep === 1 ? "Langkah 1 dari 2 — Pilih channel" : "Langkah 2 dari 2 — Isi detail event"}
                    </p>
                  )}
                </div>
              </div>
              <button className={styles.modalClose} onClick={closeModal}><X size={20} /></button>
            </div>

            <div className={styles.modalBody}>
              {/* ── STEP 1: Pilih Channel ── */}
              {wizardStep === 1 && !editing && (
                <div>
                  <p className={styles.formHint} style={{ marginBottom: 20 }}>Pilih jenis channel untuk event ini:</p>
                  <div className={styles.channelPicker}>
                    {[
                      { key: "b2c_workshop", label: "Workshop", desc: "Event berbayar/gratis dengan pemateri, foto, jadwal, dan platform.", icon: <Mic size={28} />, color: "#cc0000" },
                      { key: "b2c_ads", label: "Beasiswa / Ads", desc: "Landing page untuk program beasiswa atau kampanye iklan.", icon: <Target size={28} />, color: "#2563eb" },
                      { key: "b2b_campus", label: "Kemitraan (B2B)", desc: "Event khusus kampus atau mitra dengan kode pendaftaran.", icon: <School size={28} />, color: "#059669" },
                    ].map(ch => (
                      <button
                        key={ch.key}
                        className={`${styles.channelCard} ${form.channelType === ch.key ? styles.channelCardActive : ""}`}
                        onClick={() => setForm({ ...form, channelType: ch.key })}
                        style={form.channelType === ch.key ? { borderColor: ch.color, background: `${ch.color}08` } : {}}
                      >
                        <div className={styles.channelCardIcon} style={{ color: ch.color }}>{ch.icon}</div>
                        <div className={styles.channelCardLabel}>{ch.label}</div>
                        <div className={styles.channelCardDesc}>{ch.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ── STEP 2: Form Editor ── */}
              {wizardStep === 2 && (
                <div className={styles.formGrid}>
                  {/* ─── WORKSHOP FORM ─── */}
                  {form.channelType === "b2c_workshop" && (
                    <>
                      {/* Kiri: Detail Workshop */}
                      <div className={styles.formCol}>
                        <div className={styles.formSection}>
                          <div className={styles.formSectionTitle}>Detail Workshop</div>

                          <div className={styles.formGroup}>
                            <label className={styles.formLabel}>Judul Workshop <span className={styles.required}>*</span></label>
                            <input
                              className={styles.formInput}
                              type="text"
                              placeholder="Contoh: Workshop Literasi Finansial Gen-Z"
                              value={form.name}
                              onChange={(e) => setForm({ ...form, name: e.target.value })}
                              disabled={!!editing}
                            />
                            {!editing && form.name && (
                              <span className={styles.formHint}>
                                URL: <code>/workshop/{form.name.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-")}</code>
                              </span>
                            )}
                          </div>

                          <div className={styles.formRow}>
                            <div className={styles.formGroup}>
                              <label className={styles.formLabel}><Calendar size={13} style={{ verticalAlign: "middle", marginRight: 4 }} />Tanggal <span className={styles.required}>*</span></label>
                              <input
                                className={styles.formInput}
                                type="date"
                                value={workshopForm.date}
                                onChange={(e) => setWorkshopForm({ ...workshopForm, date: e.target.value })}
                              />
                              {workshopForm.date && (
                                <span className={styles.formHint}>
                                  Tampil: {new Date(workshopForm.date + "T00:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                                </span>
                              )}
                            </div>
                            <div className={styles.formGroup}>
                              <label className={styles.formLabel}>Hari</label>
                              <input
                                className={styles.formInput}
                                type="text"
                                placeholder="Sabtu"
                                value={workshopForm.dayLabel}
                                onChange={(e) => setWorkshopForm({ ...workshopForm, dayLabel: e.target.value })}
                              />
                            </div>
                          </div>
                          <div className={styles.formRow}>
                            <div className={styles.formGroup}>
                              <label className={styles.formLabel}><Clock size={13} style={{ verticalAlign: "middle", marginRight: 4 }} />Jam</label>
                              <input
                                className={styles.formInput}
                                type="text"
                                placeholder="09.00-12.00 WIB"
                                value={workshopForm.time}
                                onChange={(e) => setWorkshopForm({ ...workshopForm, time: e.target.value })}
                              />
                            </div>
                          </div>

                          <div className={styles.formGroup}>
                            <label className={styles.formLabel}><Monitor size={13} style={{ verticalAlign: "middle", marginRight: 4 }} />Platform</label>
                            <input
                              className={styles.formInput}
                              type="text"
                              placeholder="Zoom Online / Offline / Google Meet"
                              value={workshopForm.platform}
                              onChange={(e) => setWorkshopForm({ ...workshopForm, platform: e.target.value })}
                            />
                          </div>

                          <div className={styles.formGroup}>
                            <label className={styles.formLabel}>
                              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: "middle", marginRight: 4 }}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                              Link Meeting <span className={styles.formBadgeInfo}>Untuk Email</span>
                            </label>
                            <input
                              className={styles.formInput}
                              type="url"
                              placeholder="https://zoom.us/j/... atau https://meet.google.com/..."
                              value={workshopForm.meetingLink}
                              onChange={(e) => setWorkshopForm({ ...workshopForm, meetingLink: e.target.value })}
                            />
                            <span className={styles.formHint}>Link akan dikirim ke peserta melalui email konfirmasi.</span>
                          </div>

                          <div className={styles.formGroup}>
                            <label className={styles.formLabel}>
                              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: "middle", marginRight: 4 }}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                              Grup WhatsApp <span className={styles.formBadgeInfo}>Untuk Email</span>
                            </label>
                            <input
                              className={styles.formInput}
                              type="url"
                              placeholder="https://chat.whatsapp.com/..."
                              value={workshopForm.waGroupLink}
                              onChange={(e) => setWorkshopForm({ ...workshopForm, waGroupLink: e.target.value })}
                            />
                            <span className={styles.formHint}>Link grup WA dikirimkan bersamaan dengan konfirmasi pendaftaran.</span>
                          </div>

                          <div className={styles.formGroup}>
                            <label className={styles.formLabel}>Deskripsi (opsional)</label>
                            <textarea
                              className={styles.formTextarea}
                              placeholder="Deskripsi singkat workshop..."
                              value={form.description}
                              onChange={(e) => setForm({ ...form, description: e.target.value })}
                              rows={3}
                            />
                          </div>

                          <div className={styles.formRow}>
                            <div className={styles.formGroup}>
                              <label className={styles.formLabel}>Status</label>
                              <select className={styles.formInput} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                                <option value="draft">Draft</option>
                                <option value="active">Aktif</option>
                                <option value="ended">Selesai</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Kanan: Data Pemateri */}
                      <div className={styles.formCol}>
                        <div className={styles.formSection}>
                          <div className={styles.formSectionTitle}>Data Pemateri</div>

                          {/* Foto Upload */}
                          <div className={styles.formGroup}>
                            <label className={styles.formLabel}>
                              <ImageIcon size={13} style={{ verticalAlign: "middle", marginRight: 4 }} />Foto Pemateri
                              <span className={styles.formBadgeSizeHint}>Square 1:1 · min 240×240px</span>
                            </label>
                            <div className={styles.photoUploadArea} onClick={() => photoInputRef.current?.click()}>
                              {photoPreview ? (
                                <img src={photoPreview} alt="Preview" className={styles.photoPreview} />
                              ) : (
                                <div className={styles.photoPlaceholder}>
                                  <User size={40} />
                                  <span>Klik untuk upload foto</span>
                                  <span className={styles.photoHint}>JPG/PNG, maks 2MB</span>
                                </div>
                              )}
                              <div className={styles.photoOverlay}>
                                <Upload size={20} />
                                <span>{photoPreview ? "Ganti Foto" : "Upload Foto"}</span>
                              </div>
                            </div>
                            <input
                              ref={photoInputRef}
                              type="file"
                              accept="image/*"
                              style={{ display: "none" }}
                              onChange={handlePhotoSelect}
                            />
                            {uploadingPhoto && <span className={styles.formHint}>Mengupload foto...</span>}
                          </div>

                          <div className={styles.formGroup}>
                            <label className={styles.formLabel}>Nama Pemateri <span className={styles.required}>*</span></label>
                            <input
                              className={styles.formInput}
                              type="text"
                              placeholder="Contoh: Dr. Andi Pratama"
                              value={workshopForm.speakerName}
                              onChange={(e) => setWorkshopForm({ ...workshopForm, speakerName: e.target.value })}
                            />
                          </div>

                          <div className={styles.formGroup}>
                            <label className={styles.formLabel}>Jabatan / Title</label>
                            <input
                              className={styles.formInput}
                              type="text"
                              placeholder="Contoh: Financial Planner & CFP"
                              value={workshopForm.speakerTitle}
                              onChange={(e) => setWorkshopForm({ ...workshopForm, speakerTitle: e.target.value })}
                            />
                          </div>

                          {/* Preview Card */}
                          {(workshopForm.speakerName || photoPreview) && (
                            <div className={styles.speakerPreviewCard}>
                              <div className={styles.speakerPreviewLabel}>PEMATERI</div>
                              <div className={styles.speakerPreviewBody}>
                                {photoPreview && <img src={photoPreview} alt="Speaker" className={styles.speakerPreviewImg} />}
                                <div>
                                  <div className={styles.speakerPreviewName}>{workshopForm.speakerName || "Nama Pemateri"}</div>
                                  <div className={styles.speakerPreviewTitle}>{workshopForm.speakerTitle || "Jabatan"}</div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}

                  {/* ─── BEASISWA / ADS FORM ─── */}
                  {form.channelType === "b2c_ads" && (
                    <div className={styles.formCol} style={{ gridColumn: "1 / -1" }}>
                      <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Nama Event <span className={styles.required}>*</span></label>
                        <input className={styles.formInput} type="text" placeholder="Contoh: Program Beasiswa DBS 2026" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                      </div>
                      <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Deskripsi (opsional)</label>
                        <textarea className={styles.formTextarea} placeholder="Deskripsi singkat..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
                      </div>
                      <div className={styles.formRow}>
                        <div className={styles.formGroup}>
                          <label className={styles.formLabel}>Tanggal Mulai</label>
                          <input className={styles.formInput} type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
                        </div>
                        <div className={styles.formGroup}>
                          <label className={styles.formLabel}>Status</label>
                          <select className={styles.formInput} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                            <option value="draft">Draft</option><option value="active">Aktif</option><option value="ended">Selesai</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ─── KEMITRAAN B2B FORM ─── */}
                  {form.channelType === "b2b_campus" && (
                    <div className={styles.formCol} style={{ gridColumn: "1 / -1" }}>
                      <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Nama Event <span className={styles.required}>*</span></label>
                        <input className={styles.formInput} type="text" placeholder="Contoh: Kemitraan Universitas ABC" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                      </div>
                      <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Kode Mitra <span className={styles.required}>*</span></label>
                        <input className={styles.formInput} type="text" placeholder="Contoh: KAMPUS-X" value={form.partnerCode} onChange={(e) => setForm({ ...form, partnerCode: e.target.value.toUpperCase().replace(/\s/g, "-") })} />
                        <span className={styles.formHint}>Peserta harus memasukkan kode ini saat mendaftar.</span>
                      </div>
                      <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Deskripsi (opsional)</label>
                        <textarea className={styles.formTextarea} placeholder="Deskripsi singkat..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
                      </div>
                      <div className={styles.formRow}>
                        <div className={styles.formGroup}>
                          <label className={styles.formLabel}>Tanggal Mulai</label>
                          <input className={styles.formInput} type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
                        </div>
                        <div className={styles.formGroup}>
                          <label className={styles.formLabel}>Status</label>
                          <select className={styles.formInput} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                            <option value="draft">Draft</option><option value="active">Aktif</option><option value="ended">Selesai</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {error && <div className={styles.formError}><AlertTriangle size={14} /> {error}</div>}
            </div>

            {/* Footer */}
            <div className={styles.modalFooter}>
              <button className={styles.modalBtnCancel} onClick={closeModal}>Batal</button>
              {wizardStep === 1 && !editing ? (
                <button className={styles.modalBtnSave} onClick={() => setWizardStep(2)}>
                  Lanjut <ChevronRight size={15} />
                </button>
              ) : (
                <button className={styles.modalBtnSave} onClick={handleSave} disabled={saving || uploadingPhoto}>
                  {saving || uploadingPhoto ? "Menyimpan..." : editing ? "Simpan Perubahan" : "Buat Event"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog 
        isOpen={!!confirmDeleteEvent}
        onClose={() => setConfirmDeleteEvent(null)}
        onConfirm={executeDelete}
        title="Hapus Event"
        message={`Yakin ingin menghapus event "${confirmDeleteEvent?.name}"?`}
        confirmText="Hapus"
        confirmStyle={{ background: '#cc0000', borderColor: '#cc0000', color: 'white' }}
      />
    </ProtectedRoute>
  );
}
