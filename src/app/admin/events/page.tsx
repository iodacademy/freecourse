"use client";

import { useState, useEffect, useCallback } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import styles from "./page.module.css";

interface EventData {
  id: string;
  name: string;
  description: string;
  channelType: "b2b_campus" | "b2c_ads" | "b2c_workshop";
  status: "active" | "draft" | "ended";
  startDate: string | null;
  endDate: string | null;
  campusName: string | null;
  partnerCode: string | null;
  createdAt: any;
}

const CHANNEL_LABELS: Record<string, string> = {
  b2b_campus: "🏫 Kemitraan (B2B)",
  b2c_ads: "🎯 Beasiswa / Ads",
  b2c_workshop: "🎤 Workshop",
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

  // Copy link
  const copyLink = (evt: EventData) => {
    const basePath = CHANNEL_PATHS[evt.channelType] || "/beasiswa";
    const link = `${window.location.origin}${basePath}/${evt.id}`;
    navigator.clipboard.writeText(link);
    setCopied(evt.id);
    setTimeout(() => setCopied(null), 2000);
  };

  // Modal helpers
  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", description: "", channelType: "b2c_ads", status: "draft", startDate: "" });
    setError("");
    setShowModal(true);
  };

  const openEdit = (evt: EventData) => {
    setEditing(evt);
    setForm({
      name: evt.name,
      description: evt.description || "",
      channelType: evt.channelType,
      status: evt.status,
      startDate: evt.startDate ? new Date(evt.startDate).toISOString().split("T")[0] : "",
    });
    setError("");
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
  };

  // Get link for event
  const getEventLink = (evt: EventData) => {
    const basePath = CHANNEL_PATHS[evt.channelType] || "/beasiswa";
    return `${basePath}/${evt.id}`;
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
            ⚠️ {error}
            <button onClick={() => setError("")} className={styles.errorClose}>×</button>
          </div>
        )}

        <div className={styles.filters}>
          {[
            { key: "all", label: "Semua Event" },
            { key: "b2b_campus", label: "🏫 Kemitraan" },
            { key: "b2c_ads", label: "🎯 Beasiswa/Ads" },
            { key: "b2c_workshop", label: "🎤 Workshop" },
          ].map((f) => (
            <button
              key={f.key}
              className={`${styles.filterBtn} ${filter === f.key ? styles.active : ""}`}
              onClick={() => setFilter(f.key)}
            >
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
            <div className={styles.emptyIcon}>📅</div>
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
                        <span className={styles.channelBadge}>
                          {CHANNEL_LABELS[evt.channelType] || evt.channelType}
                        </span>
                      </td>
                      <td>
                        <div className={styles.linkCell}>
                          <span className={styles.linkText}>{link}</span>
                          <button
                            className={`${styles.copyBtn} ${copied === evt.id ? styles.copyBtnDone : ""}`}
                            onClick={() => copyLink(evt)}
                          >
                            {copied === evt.id ? "✓ Tersalin" : "📋 Salin"}
                          </button>
                        </div>
                      </td>
                      <td>
                        <span className={`${styles.statusBadge} ${styles[evt.status]}`}>
                          {isActive ? "Aktif" : evt.status === "draft" ? "Draft" : "Selesai"}
                        </span>
                      </td>
                      <td className={styles.actionsCell}>
                        <button className={styles.iconBtn} onClick={() => openEdit(evt)} title="Edit">✏️</button>
                        <button className={styles.iconBtn} onClick={() => toggleStatus(evt)} title={isActive ? "Nonaktifkan" : "Aktifkan"}>
                          {isActive ? "🚫" : "✅"}
                        </button>
                        <button className={styles.iconBtn} onClick={() => handleDelete(evt)} title="Hapus">🗑️</button>
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
              <button className={styles.modalClose} onClick={closeModal}>×</button>
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
                    <option value="b2c_ads">🎯 Beasiswa / Ads (Channel 2)</option>
                    <option value="b2c_workshop">🎤 Workshop (Channel 3)</option>
                    <option value="b2b_campus">🏫 Kemitraan / B2B (Channel 1)</option>
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
