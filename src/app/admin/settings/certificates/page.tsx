"use client";

import { useState, useEffect } from "react";
import styles from "../page.module.css";
import { CheckCircle, Save } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function CertificatesSettingsPage() {
  const { user } = useAuth();
  const [settings, setSettings] = useState({
    gasWebAppUrl: "",
    mainCertTitle: "",
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
        setSettings(prev => ({
          ...prev,
          gasWebAppUrl: data.gasWebAppUrl || "",
          mainCertTitle: data.mainCertTitle || "",
          workshopCertSlideTemplateId: data.workshopCertSlideTemplateId || "",
        }));
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
        body: JSON.stringify({
          gasWebAppUrl: settings.gasWebAppUrl,
          mainCertTitle: settings.mainCertTitle,
          workshopCertSlideTemplateId: settings.workshopCertSlideTemplateId,
        }),
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

  if (loading) return <div style={{ padding: 24 }}>Memuat...</div>;

  return (
    <div className={styles.page}>
      {/* ── INTEGRASI GAS ── */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Integrasi Google Apps Script (GAS)</h2>
        <p className={styles.sectionDesc}>URL Web App GAS untuk generate sertifikat PDF dan kirim email otomatis.</p>
        
        <div className={styles.inputGroup}>
          <label className={styles.label}>GAS Web App URL</label>
          <input 
            type="text" 
            className="input w-full" 
            value={settings.gasWebAppUrl}
            onChange={(e) => setSettings({ ...settings, gasWebAppUrl: e.target.value })}
            placeholder="https://script.google.com/macros/s/.../exec"
          />
        </div>
        {settings.gasWebAppUrl && (
          <div className={styles.testConnection}>
            <span className={styles.statusOk}>
              <CheckCircle size={15} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 4 }} />
              URL sudah diisi
            </span>
          </div>
        )}
      </div>

      {/* ── SERTIFIKAT KURSUS UTAMA ── */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Sertifikat Kursus Utama</h2>
        <p className={styles.sectionDesc}>
          Judul yang tampil pada kalimat <em>"materi modul …"</em> di halaman klaim sertifikat peserta.
        </p>
        <div className={styles.inputGroup}>
          <label className={styles.label}>Judul Sertifikat</label>
          <input
            type="text"
            className="input w-full"
            value={settings.mainCertTitle}
            onChange={(e) => setSettings({ ...settings, mainCertTitle: e.target.value })}
            placeholder="Contoh: Literasi Finansial Dasar"
          />
        </div>
      </div>

      {/* ── SERTIFIKAT WORKSHOP ── */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Sertifikat Kehadiran Workshop</h2>
        <p className={styles.sectionDesc}>
          ID template Google Slide untuk sertifikat kehadiran workshop. Data judul dan tanggal diambil otomatis dari data event.
        </p>
        <div className={styles.inputGroup}>
          <label className={styles.label}>ID Template Google Slide (Workshop)</label>
          <input
            type="text"
            className="input w-full"
            value={settings.workshopCertSlideTemplateId}
            onChange={(e) => setSettings({ ...settings, workshopCertSlideTemplateId: e.target.value })}
            placeholder="1BxiMVs0XRA5nFMDkVBdBZjgmUUqptlbs74OgVE2upms"
          />
          <p style={{ fontSize: 12, color: "#888", marginTop: 4, marginBottom: 0 }}>
            Salin dari URL Google Slides: docs.google.com/presentation/d/<strong>[ID di sini]</strong>/edit
          </p>
        </div>
      </div>

      {/* ── TOMBOL SIMPAN ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button 
          className="btn btn-primary" 
          onClick={saveSettings} 
          disabled={saving}
        >
          <Save size={16} style={{ marginRight: 8, display: 'inline' }} />
          {saving ? "Menyimpan..." : "Simpan Pengaturan"}
        </button>
        {saveSuccess && <span style={{ color: "var(--color-success)", fontSize: 14, fontWeight: 600 }}>✓ Tersimpan!</span>}
        {saveError && <span style={{ color: "#cc0000", fontSize: 14 }}>{saveError}</span>}
      </div>
    </div>
  );
}
