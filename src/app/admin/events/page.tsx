"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import styles from "./page.module.css";
import { AlertTriangle, Archive, Copy, Check, School, Target, Mic, Search, X, Upload, User, ImageIcon, Calendar, Clock, Monitor, ChevronRight, ArrowLeft } from "lucide-react";
import { ConfirmDialog } from "@/components/Modal/Dialogs";
import type { BenefitCategory, DynamicForm } from "@/lib/types";
import { BENEFIT_CATEGORY_OPTIONS, getExplicitBenefitCategories, isBenefitCategoryAllowed } from "@/lib/benefit-categories";

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
  formId?: string | null;
  benefitCategories?: BenefitCategory[];
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
  const [forms, setForms] = useState<DynamicForm[]>([]);
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
    audienceLabel: "",
    formId: "",
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
  
  // Form khusus beasiswa WPB / Bootcamp
  const [beasiswaConfig, setBeasiswaConfig] = useState({
    type: "vl" as "vl" | "wpb" | "bootcamp",
    namaKelas: "",
    kodeBasis: "",
    kodeKelas: "",
    waGroupLink: "",
    topikList: [] as Array<{ judul: string; jadwal: string }>,
  });
  const [benefitCategories, setBenefitCategories] = useState<BenefitCategory[]>(["vl"]);
  // Judul benefit spesifik. Kosong = semua judul dalam kategori terpilih.
  const [benefitTopicIds, setBenefitTopicIds] = useState<string[]>([]);
  const [benefitTopics, setBenefitTopics] = useState<Array<{ id: string; name: string; category?: string }>>([]);

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

  const fetchForms = useCallback(async () => {
    try {
      const token = await getToken();
      const res = await fetch("/api/admin/forms", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setForms(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("[AdminEvents] Gagal memuat daftar form:", e);
    }
  }, [getToken]);

  useEffect(() => { fetchForms(); }, [fetchForms]);

  const fetchBenefitTopics = useCallback(async () => {
    try {
      const token = await getToken();
      const res = await fetch("/api/bonus-courses?all=1", { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return;
      const data = await res.json();
      setBenefitTopics(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("[AdminEvents] Gagal memuat daftar benefit:", e);
    }
  }, [getToken]);

  useEffect(() => { fetchBenefitTopics(); }, [fetchBenefitTopics]);

  // Filtered — channel + search lokal
  const filtered = events.filter((e) => {
    const isArchived = e.status !== "active";
    const matchStatus = filter === "archived" ? isArchived : !isArchived;
    const matchChannel = filter === "all" || filter === "archived" || e.channelType === filter;
    const baseMatch = matchStatus && matchChannel;
    if (!activeSearch) return baseMatch;
    const q = activeSearch.toLowerCase();
    return baseMatch && (
      e.name.toLowerCase().includes(q) ||
      (e.partnerCode || "").toLowerCase().includes(q) ||
      (e.campusName || "").toLowerCase().includes(q)
    );
  });

  const emptyCopy = filter === "archived"
    ? {
        title: "Arsip Masih Kosong",
        body: "Event draft atau selesai akan muncul di sini.",
      }
    : {
        title: "Belum Ada Event Aktif",
        body: "Klik \"+ Buat Event Baru\" untuk memulai.",
      };

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
    const usesBenefitCategories = form.channelType === "b2c_ads" || form.channelType === "b2b_campus";
    if (usesBenefitCategories && benefitCategories.length === 0) {
      setError("Pilih minimal satu kategori benefit untuk event ini");
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
      const eventBenefitCategories = usesBenefitCategories ? benefitCategories : [];
      // Hanya kirim judul yang masih relevan dengan kategori terpilih.
      const eventBenefitTopicIds = usesBenefitCategories
        ? benefitTopicIds.filter((id) => {
            const t = benefitTopics.find((x) => x.id === id);
            return t ? isBenefitCategoryAllowed(t.category || "vl", eventBenefitCategories.length ? eventBenefitCategories : null) : false;
          })
        : [];

      const payload = {
        name: form.name,
        description: form.description,
        channelType: form.channelType,
        status: form.status,
        startDate: form.startDate || null,
        partnerCode: form.channelType === "b2b_campus" ? form.partnerCode : null,
        audienceLabel: form.channelType === "b2b_campus" ? form.audienceLabel : null,
        formId: form.formId || null,
        workshopData,
        benefitCategories: eventBenefitCategories,
        benefitTopicIds: eventBenefitTopicIds,
        beasiswaConfig: form.channelType === "b2c_ads"
          ? { ...beasiswaConfig, benefitCategories: eventBenefitCategories }
          : null,
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
    setForm({ name: "", description: "", channelType: "", status: "draft", startDate: "", partnerCode: "", audienceLabel: "", formId: "" });
    setWorkshopForm({ date: "", dayLabel: "", time: "", platform: "Zoom Online", meetingLink: "", waGroupLink: "", speakerName: "", speakerTitle: "", speakerPhoto: "" });
    setBeasiswaConfig({ type: "vl", namaKelas: "", kodeBasis: "", kodeKelas: "", waGroupLink: "", topikList: [] });
    setBenefitCategories(["vl"]);
    setBenefitTopicIds([]);
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
      audienceLabel: (evt as any).audienceLabel || "",
      formId: evt.formId || "",
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
    
    const bc = (evt as any).beasiswaConfig;
    const explicitBenefitCategories = getExplicitBenefitCategories(evt);
    const savedBenefitCategories: BenefitCategory[] = explicitBenefitCategories.length > 0
      ? explicitBenefitCategories
      : bc?.type
        ? [bc.type as BenefitCategory]
        : evt.channelType === "b2b_campus"
          ? BENEFIT_CATEGORY_OPTIONS.map((opt) => opt.value)
          : ["vl"];
    setBeasiswaConfig({
      type: bc?.type || "vl",
      namaKelas: bc?.namaKelas || "",
      kodeBasis: bc?.kodeBasis || "",
      kodeKelas: bc?.kodeKelas || "",
      waGroupLink: bc?.waGroupLink || "",
      topikList: bc?.topikList || [],
    });
    setBenefitCategories(savedBenefitCategories);
    setBenefitTopicIds(
      Array.isArray((evt as any).benefitTopicIds) ? (evt as any).benefitTopicIds
        : Array.isArray((bc as any)?.benefitTopicIds) ? (bc as any).benefitTopicIds : []
    );

    setPhotoFile(null);
    setPhotoPreview(wd?.speakerPhoto || "");
    setError("");
    setShowModal(true);
  };

  const toggleBenefitCategory = (category: BenefitCategory) => {
    setBenefitCategories((prev) => {
      if (prev.includes(category)) return prev.filter((item) => item !== category);
      return [...prev, category];
    });
  };

  const renderBenefitCategoryPicker = () => (
    <div className={styles.formGroup}>
      <label className={styles.formLabel}>Kategori Benefit yang Ditampilkan ke Siswa <span className={styles.required}>*</span></label>
      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))" }}>
        {BENEFIT_CATEGORY_OPTIONS.map((option) => {
          const checked = benefitCategories.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => toggleBenefitCategory(option.value)}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                textAlign: "left",
                padding: "12px 14px",
                borderRadius: 8,
                border: checked ? "1.5px solid var(--color-primary)" : "1px solid #d8dee8",
                background: checked ? "rgba(204,0,0,0.06)" : "#fff",
                cursor: "pointer",
              }}
            >
              <span style={{
                width: 18,
                height: 18,
                borderRadius: 4,
                border: checked ? "1px solid var(--color-primary)" : "1px solid #9aa4b2",
                background: checked ? "var(--color-primary)" : "#fff",
                color: "#fff",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                flex: "0 0 auto",
              }}>
                {checked ? "✓" : ""}
              </span>
              <span>
                <strong style={{ display: "block", fontSize: 14 }}>{option.label}</strong>
                <span style={{ display: "block", fontSize: 12, color: "#64748b", marginTop: 2 }}>{option.description}</span>
              </span>
            </button>
          );
        })}
      </div>
      <span className={styles.formHint}>Jika memilih 2 kategori, siswa hanya melihat 2 tab itu dan tetap hanya bisa memilih 1 benefit.</span>

      {/* Pilih judul spesifik (opsional). Kosong = semua judul di kategori terpilih. */}
      {(() => {
        const inCategory = benefitTopics.filter((t) =>
          isBenefitCategoryAllowed(t.category || "vl", benefitCategories.length ? benefitCategories : null)
        );
        if (inCategory.length === 0) return null;
        return (
          <div style={{ marginTop: 16 }}>
            <label className={styles.formLabel}>Judul Benefit Tertentu (opsional)</label>
            <div style={{ display: "grid", gap: 6, maxHeight: 220, overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: 8, padding: 10 }}>
              {inCategory.map((t) => {
                const checked = benefitTopicIds.includes(t.id);
                return (
                  <label key={t.id} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => setBenefitTopicIds((prev) =>
                        prev.includes(t.id) ? prev.filter((x) => x !== t.id) : [...prev, t.id]
                      )}
                      style={{ marginTop: 2 }}
                    />
                    <span>
                      {t.name}
                      <span style={{ color: "#94a3b8", marginLeft: 6 }}>({t.category || "vl"})</span>
                    </span>
                  </label>
                );
              })}
            </div>
            <span className={styles.formHint}>
              Biarkan kosong agar SEMUA judul di kategori terpilih tampil. Centang untuk membatasi ke judul tertentu saja.
            </span>
          </div>
        );
      })()}
    </div>
  );

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
              { key: "all", label: "Semua Event Aktif", icon: null },
              { key: "b2b_campus", label: "Kemitraan", icon: <School size={16} /> },
              { key: "b2c_ads", label: "Beasiswa/Ads", icon: <Target size={16} /> },
              { key: "b2c_workshop", label: "Workshop", icon: <Mic size={16} /> },
              { key: "archived", label: "Arsip", icon: <Archive size={16} /> },
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
            <h3>{emptyCopy.title}</h3>
            <p>{emptyCopy.body}</p>
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
                        onClick={() => { setForm({ ...form, channelType: ch.key }); setWizardStep(2); }}
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
                  <div className={styles.formCol} style={{ gridColumn: "1 / -1" }}>
                    <div className={styles.formSection}>
                      <div className={styles.formSectionTitle}>Form Pendaftaran</div>
                      <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Form yang Dipakai Peserta</label>
                        <select
                          className={styles.formInput}
                          value={form.formId}
                          onChange={(e) => setForm({ ...form, formId: e.target.value })}
                        >
                          <option value="">Gunakan Default Global</option>
                          {forms.filter((f) => !f.isActive || f.id === form.formId).map((f) => (
                            <option key={f.id} value={f.id}>
                              {f.title}{f.isActive ? " (Default Global - pinned)" : " (Custom/Event Only)"}
                            </option>
                          ))}
                        </select>
                        <span className={styles.formHint}>
                          Kosongkan untuk event lama/default. Pilih custom form jika event ini perlu form khusus, misalnya asal daerah terbatas.
                        </span>
                      </div>
                    </div>
                  </div>

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
                              <label className={styles.formLabel}>Tanggal <span className={styles.required}>*</span></label>
                              <input
                                className={styles.formInput}
                                type="date"
                                value={workshopForm.date}
                                onChange={(e) => setWorkshopForm({ ...workshopForm, date: e.target.value })}
                              />
                              {workshopForm.date && (
                                <span className={styles.formHint}>
                                  Tampil: {new Date(workshopForm.date + "T00:00:00").toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className={styles.formRow}>
                            <div className={styles.formGroup}>
                              <label className={styles.formLabel}>Jam</label>
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
                            <label className={styles.formLabel}>Platform</label>
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
                              Foto Pemateri
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
                        <label className={styles.formLabel}>Tipe Landing Beasiswa</label>
                        <select
                          className={styles.formInput}
                          value={beasiswaConfig.type}
                          onChange={(e) => {
                            const nextType = e.target.value as "vl" | "wpb" | "bootcamp";
                            setBeasiswaConfig({ ...beasiswaConfig, type: nextType });
                            setBenefitCategories((prev) => (
                              prev.includes(nextType as BenefitCategory) ? prev : [...prev, nextType as BenefitCategory]
                            ));
                          }}
                        >
                          <option value="vl">Video Learning (Default)</option>
                          <option value="wpb">WPB (Workshop Praktikal Berproject)</option>
                          <option value="bootcamp">Bootcamp</option>
                        </select>
                        <span className={styles.formHint}>Dipakai untuk tampilan landing lama. Pilihan benefit siswa diatur dari checklist di bawah.</span>
                      </div>

                      {renderBenefitCategoryPicker()}

                      {beasiswaConfig.type !== "vl" && (
                        <>
                          <div className={styles.formGroup}>
                            <label className={styles.formLabel}>Nama Kelas Bootcamp/WPB <span className={styles.required}>*</span></label>
                            <input className={styles.formInput} type="text" placeholder="Contoh: Frontend Engineering" value={beasiswaConfig.namaKelas} onChange={(e) => setBeasiswaConfig({ ...beasiswaConfig, namaKelas: e.target.value })} />
                          </div>
                          <div className={styles.formGroup}>
                            <label className={styles.formLabel}>Kode Basis <span className={styles.required}>*</span></label>
                            <input className={styles.formInput} type="text" placeholder="Contoh: BLG" value={beasiswaConfig.kodeBasis} onChange={(e) => setBeasiswaConfig({ ...beasiswaConfig, kodeBasis: e.target.value })} />
                          </div>
                          <div className={styles.formGroup}>
                            <label className={styles.formLabel}>Kode Kelas <span className={styles.required}>*</span></label>
                            <input className={styles.formInput} type="text" placeholder="Contoh: BLG81" value={beasiswaConfig.kodeKelas} onChange={(e) => setBeasiswaConfig({ ...beasiswaConfig, kodeKelas: e.target.value })} />
                          </div>
                          <div className={styles.formGroup}>
                            <label className={styles.formLabel}>Link Grup WhatsApp <span className={styles.required}>*</span></label>
                            <input className={styles.formInput} type="url" placeholder="https://chat.whatsapp.com/..." value={beasiswaConfig.waGroupLink} onChange={(e) => setBeasiswaConfig({ ...beasiswaConfig, waGroupLink: e.target.value })} />
                          </div>
                          
                          {/* Dynamic Topik List */}
                          <div className={styles.formGroup}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                              <label className={styles.formLabel} style={{ marginBottom: 0 }}>Daftar Topik Pelatihan</label>
                              <button 
                                type="button" 
                                onClick={() => setBeasiswaConfig({ 
                                  ...beasiswaConfig, 
                                  topikList: [...(beasiswaConfig.topikList || []), { judul: "", jadwal: "" }] 
                                })}
                                style={{
                                  background: "#e8f0fe", color: "#1a73e8", border: "none",
                                  padding: "4px 12px", borderRadius: "16px", fontSize: "0.85rem", cursor: "pointer", fontWeight: 600
                                }}
                              >
                                + Tambah Topik
                              </button>
                            </div>
                            
                            {beasiswaConfig.topikList && beasiswaConfig.topikList.length > 0 ? (
                              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                                {beasiswaConfig.topikList.map((topik, idx) => (
                                  <div key={idx} style={{ display: "flex", gap: "12px", alignItems: "flex-start", background: "#f8f9fa", padding: "12px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "8px" }}>
                                      <input 
                                        className={styles.formInput} 
                                        type="text" 
                                        placeholder="Judul Topik (mis. HTML Dasar)" 
                                        value={topik.judul}
                                        onChange={(e) => {
                                          const newList = [...(beasiswaConfig.topikList || [])];
                                          newList[idx].judul = e.target.value;
                                          setBeasiswaConfig({ ...beasiswaConfig, topikList: newList });
                                        }}
                                      />
                                      <input 
                                        className={styles.formInput} 
                                        type="text" 
                                        placeholder="Jadwal (mis. 15 Agustus 2026)" 
                                        value={topik.jadwal}
                                        onChange={(e) => {
                                          const newList = [...(beasiswaConfig.topikList || [])];
                                          newList[idx].jadwal = e.target.value;
                                          setBeasiswaConfig({ ...beasiswaConfig, topikList: newList });
                                        }}
                                      />
                                    </div>
                                    <button 
                                      type="button" 
                                      title="Hapus"
                                      onClick={() => {
                                        const newList = [...(beasiswaConfig.topikList || [])];
                                        newList.splice(idx, 1);
                                        setBeasiswaConfig({ ...beasiswaConfig, topikList: newList });
                                      }}
                                      style={{ background: "none", border: "none", color: "#dc3545", cursor: "pointer", fontSize: "1.2rem", padding: "4px" }}
                                    >
                                      🗑️
                                    </button>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div style={{ fontSize: "0.9rem", color: "#6c757d", fontStyle: "italic", padding: "8px 0" }}>Belum ada topik yang ditambahkan.</div>
                            )}
                          </div>
                        </>
                      )}

                      <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Deskripsi (opsional)</label>
                        <textarea className={styles.formTextarea} placeholder="Deskripsi singkat..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
                      </div>
                      <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Status</label>
                        <select className={styles.formInput} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                          <option value="draft">Draft</option><option value="active">Aktif</option><option value="ended">Selesai</option>
                        </select>
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
                        <label className={styles.formLabel}>Sapaan Peserta</label>
                        <input className={styles.formInput} type="text" placeholder="Contoh: Mahasiswa, Karyawan, Member" value={form.audienceLabel} onChange={(e) => setForm({ ...form, audienceLabel: e.target.value })} />
                        <span className={styles.formHint}>Tampil di landing page: "Selamat Datang, <em>[Sapaan]</em> [Nama Event]!"</span>
                      </div>
                      {renderBenefitCategoryPicker()}
                      <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Deskripsi (opsional)</label>
                        <textarea className={styles.formTextarea} placeholder="Deskripsi singkat..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
                      </div>
                      <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Status</label>
                        <select className={styles.formInput} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                          <option value="draft">Draft</option><option value="active">Aktif</option><option value="ended">Selesai</option>
                        </select>
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
              {wizardStep === 2 && (
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
