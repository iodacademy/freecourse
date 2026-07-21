"use client";

import { useEffect, useState } from "react";
import styles from "../page.module.css";
import { Save } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface CertificateSettings {
  mainCertTitle: string;
  mainCertSlideTemplateId: string;
  workshopCertSlideTemplateId: string;
}

export default function CertificatesSettingsPage() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<CertificateSettings>({
    mainCertTitle: "",
    mainCertSlideTemplateId: "",
    workshopCertSlideTemplateId: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    if (user) void fetchSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function getToken() {
    if (!user) return "";
    try {
      return await (user as any).getIdToken();
    } catch {
      return "";
    }
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

  if (loading) {
    return <div style={{ padding: "24px", color: "#9ca3af", fontSize: 14 }}>Memuat...</div>;
  }

  const divider = <div style={{ height: 1, background: "#f3f4f6", margin: "20px 0" }} />;

  return (
    <div className={styles.page} style={{ paddingBottom: 80 }}>
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Konfigurasi Sertifikat</h2>
        <p className={styles.sectionDesc}>
          Atur teks dan template visual sertifikat yang terlihat oleh peserta.
        </p>

        <p style={{ fontSize: 12, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 10px" }}>
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
            Tampil pada kalimat materi modul di halaman klaim sertifikat peserta.
          </span>
        </div>
        <div className={styles.inputGroup}>
          <label className={styles.label}>ID Template Google Slide</label>
          <input
            type="text"
            className={styles.fieldInput}
            value={settings.mainCertSlideTemplateId}
            onChange={(e) => setSettings({ ...settings, mainCertSlideTemplateId: e.target.value })}
            placeholder="ID template Google Slide"
          />
        </div>

        {divider}

        <p style={{ fontSize: 12, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 10px" }}>
          Sertifikat Kehadiran Workshop
        </p>
        <div className={styles.inputGroup}>
          <label className={styles.label}>ID Template Google Slide</label>
          <input
            type="text"
            className={styles.fieldInput}
            value={settings.workshopCertSlideTemplateId}
            onChange={(e) => setSettings({ ...settings, workshopCertSlideTemplateId: e.target.value })}
            placeholder="ID template Google Slide"
          />
        </div>

        {saveSuccess && <div className={styles.successBox}>Pengaturan berhasil disimpan.</div>}
        {saveError && <div className={styles.errorBox}>{saveError}</div>}

        <div style={{ marginTop: 24 }}>
          <button className="btn btn-primary" onClick={saveSettings} disabled={saving}>
            <Save size={16} />
            {saving ? "Menyimpan..." : "Simpan Pengaturan"}
          </button>
        </div>
      </div>
    </div>
  );
}
