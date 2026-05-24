"use client";

import { useState, useEffect } from "react";
import styles from "../page.module.css";
import { Save } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function CertificatesSettingsPage() {
  const { user } = useAuth();
  const [settings, setSettings] = useState({
    gasWebAppUrl: "",
    mainCertTitle: "",
    mainCertSlideTemplateId: "",
    workshopCertSlideTemplateId: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    if (user) fetchSettings();
  }, [user]);

  async function getToken() {
    if (!user) return "";
    try { return await (user as any).getIdToken(); } catch { return ""; }
  }

  async function fetchSettings() {
    try {
      const token = await getToken();
      const res = await fetch("/api/admin/settings", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSettings({
          gasWebAppUrl: data.gasWebAppUrl || "",
          mainCertTitle: data.mainCertTitle || "",
          mainCertSlideTemplateId: data.mainCertSlideTemplateId || "",
          workshopCertSlideTemplateId: data.workshopCertSlideTemplateId || "",
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function saveSettings() {
    setSaving(true);
    setSaveSuccess(false);
    setSaveError("");
    try {
      const token = await getToken();
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        const data = await res.json();
        setSaveError(data.error || "Gagal menyimpan");
      }
    } catch (e) {
      console.error(e);
      setSaveError("Terjadi kesalahan");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div style={{ padding: "24px", color: "#9ca3af", fontSize: 14 }}>Memuat...</div>;

  return (
    <div className={styles.page} style={{ paddingBottom: 80 }}>

      {/* ── 1 KOTAK: GAS + Sertifikat Kursus Utama ── */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Google Apps Script & Sertifikat Kursus</h2>
        <p className={styles.sectionDesc}>
          Konfigurasi URL GAS dan template sertifikat untuk kursus utama Financial Literacy.
        </p>

        <div className={styles.inputGroup}>
          <label className={styles.label}>GAS Web App URL</label>
          <input
            type="text"
            className={styles.fieldInput}
            value={settings.gasWebAppUrl}
            onChange={(e) => setSettings({ ...settings, gasWebAppUrl: e.target.value })}
            placeholder="https://script.google.com/macros/s/.../exec"
          />
        </div>

        <div style={{ height: 1, background: '#f3f4f6', margin: '20px 0' }} />

        <p style={{ fontSize: 13, fontWeight: 600, color: '#374151', margin: '0 0 16px' }}>
          Sertifikat Kursus Utama
        </p>

        <div className={styles.inputGroup}>
          <label className={styles.label}>Judul Sertifikat</label>
          <input
            type="text"
            className={styles.fieldInput}
            value={settings.mainCertTitle}
            onChange={(e) => setSettings({ ...settings, mainCertTitle: e.target.value })}
            placeholder="Contoh: Literasi Finansial Dasar"
          />
          <span className={styles.fieldHint}>
            Tampil pada kalimat <em>"materi modul …"</em> di halaman klaim sertifikat peserta.
          </span>
        </div>

        <div className={styles.inputGroup}>
          <label className={styles.label}>ID Template Google Slide (Kursus Utama)</label>
          <input
            type="text"
            className={styles.fieldInput}
            value={settings.mainCertSlideTemplateId}
            onChange={(e) => setSettings({ ...settings, mainCertSlideTemplateId: e.target.value })}
            placeholder="1BxiMVs0XRA5nFMDkVBdBZjgmUUqptlbs74OgVE2upms"
          />
          <span className={styles.fieldHint}>
            Salin dari URL Google Slides: docs.google.com/presentation/d/<strong>[ID]</strong>/edit
          </span>
        </div>
      </div>

      {/* ── KOTAK: Sertifikat Workshop ── */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Sertifikat Kehadiran Workshop</h2>
        <p className={styles.sectionDesc}>
          Template Google Slide untuk sertifikat kehadiran workshop.
          Judul dan tanggal diambil otomatis dari data event.
        </p>
        <div className={styles.inputGroup}>
          <label className={styles.label}>ID Template Google Slide (Workshop)</label>
          <input
            type="text"
            className={styles.fieldInput}
            value={settings.workshopCertSlideTemplateId}
            onChange={(e) => setSettings({ ...settings, workshopCertSlideTemplateId: e.target.value })}
            placeholder="1BxiMVs0XRA5nFMDkVBdBZjgmUUqptlbs74OgVE2upms"
          />
          <span className={styles.fieldHint}>
            Salin dari URL Google Slides: docs.google.com/presentation/d/<strong>[ID]</strong>/edit
          </span>
        </div>
      </div>

      {/* ── STICKY SAVE BUTTON ── */}
      <div style={{
        position: 'fixed',
        bottom: 24,
        right: 32,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        zIndex: 100,
      }}>
        {saveSuccess && (
          <span style={{
            background: '#f0fdf4',
            color: '#15803d',
            fontSize: 13,
            fontWeight: 600,
            padding: '6px 12px',
            borderRadius: 6,
            border: '1px solid #bbf7d0',
          }}>
            ✓ Tersimpan
          </span>
        )}
        {saveError && (
          <span style={{
            background: '#fef2f2',
            color: '#cc0000',
            fontSize: 13,
            padding: '6px 12px',
            borderRadius: 6,
            border: '1px solid #fecaca',
          }}>
            {saveError}
          </span>
        )}
        <button
          className="btn btn-primary"
          onClick={saveSettings}
          disabled={saving}
          style={{
            fontSize: 14,
            padding: '10px 22px',
            boxShadow: '0 4px 16px rgba(204,0,0,0.3)',
          }}
        >
          <Save size={15} />
          {saving ? "Menyimpan..." : "Simpan"}
        </button>
      </div>
    </div>
  );
}
