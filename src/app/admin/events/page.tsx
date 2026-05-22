"use client";

import { useState, useEffect, useCallback } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import styles from "./page.module.css";
import { AlertTriangle, Copy, Check, School, Target, Mic } from "lucide-react";

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

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<EventData | null>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    channelType: "b2c_ads" as string,
    status: "draft" as string,
    startDate: "",
    partnerCode: "",
  });
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

  // Filtered
  const filtered = events.filter((e) => {
    if (filter === "all") return true;
    return e.channelType === filter;
  });

  // Create / Update
  const handleSave = async () => {
    if (!form.name.trim()) {
      setError("Nama event wajib diisi");
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
      if (editing) {
        await fetch(`/api/events/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            name: form.name,
            description: form.description,
            channelType: form.channelType,
            status: form.status,
            startDate: form.startDate || null,
            partnerCode: form.channelType === "b2b_campus" ? form.partnerCode : null,
          }),
        });
      } else {
        const res = await fetch("/api/events", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            name: form.name,
            description: form.description,
            channelType: form.channelType,
            status: form.status,
            startDate: form.startDate || null,
            partnerCode: form.channelType === "b2b_campus" ? form.partnerCode : null,
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Gagal membuat event");
        }
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
  const handleDelete = async (evt: EventData) => {
    if (!confirm(`Hapus event "${evt.name}"?`)) return;
    try {
      const token = await getToken();
      await fetch(`/api/events/${evt.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      await fetchEvents();
    } catch (e: any) {
      setError(e.message);
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
    setForm({ name: "", description: "", channelType: "b2c_ads", status: "draft", startDate: "", partnerCode: "" });
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
      } catch (e) {
        console.error("Invalid date", evt.startDate);
      }
    }

    setEditing(evt);
    setForm({
      name: evt.name,
      description: evt.description || "",
      channelType: evt.channelType,
      status: evt.status,
      startDate: formattedDate,
      partnerCode: evt.partnerCode || "",
    });
    setError("");
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
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
              onClick={() => setFilter(f.key)}
            >
              {f.icon && <span style={{ marginRight: '6px', display: 'inline-flex', verticalAlign: 'middle' }}>{f.icon}</span>}
              {f.label}
            </button>
          ))}
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

      {/* Modal */}
      {showModal && (
        <div className={styles.modalBackdrop} onClick={closeModal}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>{editing ? "Edit Event" : "Buat Event Baru"}</h2>
              <button className={styles.modalClose} onClick={closeModal}>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Nama Event</label>
                <input
                  className={styles.formInput}
                  type="text"
                  placeholder="Contoh: Workshop Literasi Finansial Gen-Z"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Deskripsi (opsional)</label>
                <textarea
                  className={styles.formTextarea}
                  placeholder="Deskripsi singkat event..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                />
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Tipe Channel</label>
                  <select
                    className={styles.formInput}
                    value={form.channelType}
                    onChange={(e) => setForm({ ...form, channelType: e.target.value })}
                    disabled={!!editing}
                  >
                    <option value="b2c_ads">Beasiswa / Ads (Channel 2)</option>
                    <option value="b2c_workshop">Workshop (Channel 3)</option>
                    <option value="b2b_campus">Kemitraan / B2B (Channel 1)</option>
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Status</label>
                  <select
                    className={styles.formInput}
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                  >
                    <option value="draft">Draft</option>
                    <option value="active">Aktif</option>
                    <option value="ended">Selesai</option>
                  </select>
                </div>
              </div>

              {form.channelType === "b2b_campus" && (
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Kode Mitra (Wajib untuk B2B)</label>
                  <input
                    className={styles.formInput}
                    type="text"
                    placeholder="Contoh: KAMPUS-X"
                    value={form.partnerCode}
                    onChange={(e) => setForm({ ...form, partnerCode: e.target.value.toUpperCase().replace(/\s/g, "-") })}
                  />
                  <span className={styles.formHint}>Peserta harus memasukkan kode ini saat mendaftar.</span>
                </div>
              )}

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Tanggal Mulai (opsional)</label>
                <input
                  className={styles.formInput}
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                />
              </div>

              {/* Link Preview */}
              {!editing && form.name && (
                <div className={styles.linkPreview}>
                  <div className={styles.linkPreviewLabel}>Link pendaftaran akan dibuat setelah event disimpan.</div>
                </div>
              )}
            </div>

            <div className={styles.modalFooter}>
              <button className={styles.modalBtnCancel} onClick={closeModal}>Batal</button>
              <button className={styles.modalBtnSave} onClick={handleSave} disabled={saving}>
                {saving ? "Menyimpan..." : editing ? "Simpan Perubahan" : "Buat Event"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ProtectedRoute>
  );
}
