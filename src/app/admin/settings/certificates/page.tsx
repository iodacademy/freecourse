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
  // Diagnosis koneksi GAS
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  // Audit sertifikat (certified tapi PDF/datanya bermasalah)
  const [auditing, setAuditing] = useState(false);
  const [auditResult, setAuditResult] = useState<any>(null);

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

  // Tes koneksi ke GAS (dryRun: tidak benar-benar membuat sertifikat).
  // Simpan dulu sebelum tes agar GAS URL terbaru terbaca server.
  async function testGas(dryRun: boolean) {
    setTesting(true);
    setTestResult(null);
    try {
      const token = await getToken();
      // Simpan settings terlebih dahulu supaya server pakai URL terbaru.
      await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(settings),
      });
      const res = await fetch("/api/admin/diagnostics/gas", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ dryRun }),
      });
      const text = await res.text();
      let data: any = null;
      try { data = text ? JSON.parse(text) : null; } catch {
        data = { verdict: `Server membalas non-JSON (HTTP ${res.status})`, responseSnippet: text.slice(0, 300) };
      }
      if (res.status === 403) data = { verdict: "Hanya Super Admin yang bisa menjalankan tes ini." };
      setTestResult(data);
    } catch (e: any) {
      setTestResult({ verdict: "Gagal memanggil endpoint diagnosis", responseSnippet: e?.message });
    } finally {
      setTesting(false);
    }
  }

  // Audit: cari peserta certified tapi PDF hilang / data cacat.
  // fix=true → tandai pdfPending agar cron membuatkan PDF-nya.
  async function runAudit(fix: boolean) {
    setAuditing(true);
    if (!fix) setAuditResult(null);
    try {
      const token = await getToken();
      const res = await fetch("/api/admin/students/audit-certificates", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ fix }),
      });
      const text = await res.text();
      let data: any = null;
      try { data = text ? JSON.parse(text) : null; } catch {
        data = { error: `Server membalas non-JSON (HTTP ${res.status})` };
      }
      if (res.status === 403) data = { error: "Hanya Super Admin yang bisa menjalankan audit ini." };
      setAuditResult(data);
    } catch (e: any) {
      setAuditResult({ error: e?.message || "Gagal menjalankan audit." });
    } finally {
      setAuditing(false);
    }
  }

  if (loading) return <div style={{ padding: "24px", color: "#9ca3af", fontSize: 14 }}>Memuat...</div>;

  const divider = <div style={{ height: 1, background: '#f3f4f6', margin: '20px 0' }} />;

  return (
    <div className={styles.page} style={{ paddingBottom: 80 }}>

      {/* ── SATU KOTAK untuk semua konfigurasi sertifikat ── */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Konfigurasi Sertifikat</h2>
        <p className={styles.sectionDesc}>
          URL Google Apps Script, template slide, dan judul untuk setiap jenis sertifikat.
        </p>

        {/* GAS */}
        <p style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 10px' }}>
          Google Apps Script
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
          <span className={styles.fieldHint}>
            Wajib diakhiri <strong>/exec</strong> dan deploy GAS harus "Anyone" agar bisa diakses server.
          </span>

          {/* Tombol diagnosis */}
          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => testGas(true)}
              disabled={testing}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "#1e293b", background: "#f1f5f9", border: "1px solid #cbd5e1", padding: "8px 14px", borderRadius: 8, cursor: testing ? "wait" : "pointer" }}
            >
              {testing ? "Menguji..." : "Tes Koneksi GAS (aman)"}
            </button>
            <button
              type="button"
              onClick={() => testGas(false)}
              disabled={testing}
              title="Membuat 1 sertifikat uji sungguhan untuk memastikan generate PDF berhasil"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "#fff", background: "#1e293b", border: "1px solid #1e293b", padding: "8px 14px", borderRadius: 8, cursor: testing ? "wait" : "pointer" }}
            >
              Tes Generate PDF Sungguhan
            </button>
          </div>

          {testResult && (
            <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: 8, fontSize: 13, background: testResult.success ? "#f0fdf4" : "#fef2f2", border: `1px solid ${testResult.success ? "#bbf7d0" : "#fecaca"}` }}>
              <div style={{ fontWeight: 700, color: testResult.success ? "#15803d" : "#b91c1c", marginBottom: 6 }}>
                {testResult.success ? "✓ GAS sehat" : "✗ Ada masalah"} — {testResult.verdict || "tidak ada verdict"}
              </div>
              {typeof testResult.httpStatus !== "undefined" && (
                <div style={{ color: "#475569", marginBottom: 4 }}>HTTP {testResult.httpStatus}{testResult.durationMs ? ` · ${testResult.durationMs}ms` : ""}</div>
              )}
              {testResult.parsedJson?.downloadUrl && (
                <div style={{ marginBottom: 4 }}>
                  PDF uji: <a href={testResult.parsedJson.downloadUrl} target="_blank" rel="noreferrer" style={{ color: "#2563eb" }}>buka</a>
                </div>
              )}
              {testResult.responseSnippet && (
                <div style={{ marginTop: 6, fontFamily: "monospace", fontSize: 11, color: "#64748b", whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: 120, overflowY: "auto" }}>
                  {testResult.responseSnippet}
                </div>
              )}
            </div>
          )}

          {/* Audit sertifikat: certified tapi PDF hilang / data cacat */}
          <div style={{ marginTop: 16, padding: "12px 14px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#92400e", marginBottom: 4 }}>
              Audit Sertifikat
            </div>
            <div style={{ fontSize: 12, color: "#92400e", marginBottom: 10 }}>
              Cek peserta yang sudah tersertifikasi tapi PDF-nya hilang/menggantung, atau datanya cacat (nama/ID kosong).
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => runAudit(false)}
                disabled={auditing}
                style={{ fontSize: 13, fontWeight: 600, color: "#92400e", background: "#fef3c7", border: "1px solid #fcd34d", padding: "8px 14px", borderRadius: 8, cursor: auditing ? "wait" : "pointer" }}
              >
                {auditing ? "Memeriksa..." : "Periksa (laporan saja)"}
              </button>
              {/* Tombol antre hanya bila MASIH ada yang belum diantrekan */}
              {auditResult && auditResult.notQueuedCount > 0 && (
                <button
                  type="button"
                  onClick={() => runAudit(true)}
                  disabled={auditing}
                  title="Tandai pdfPending agar cron membuatkan PDF yang hilang"
                  style={{ fontSize: 13, fontWeight: 600, color: "#fff", background: "#b45309", border: "1px solid #b45309", padding: "8px 14px", borderRadius: 8, cursor: auditing ? "wait" : "pointer" }}
                >
                  Antrekan {auditResult.notQueuedCount} PDF yang belum diantre
                </button>
              )}
              {/* Kalau ada PDF hilang tapi SEMUA sudah diantrekan → status, bukan tombol */}
              {auditResult && auditResult.missingPdfCount > 0 && auditResult.notQueuedCount === 0 && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "#15803d", background: "#f0fdf4", border: "1px solid #bbf7d0", padding: "8px 14px", borderRadius: 8 }}>
                  ✓ Sudah diantrekan ({auditResult.alreadyQueuedCount})
                </span>
              )}
            </div>

            {auditResult && (
              <div style={{ marginTop: 10, fontSize: 13, color: "#1f2937" }}>
                {auditResult.error ? (
                  <span style={{ color: "#b91c1c" }}>{auditResult.error}</span>
                ) : (
                  <>
                    <div>Total tersertifikasi: <strong>{auditResult.totalCertified}</strong></div>
                    <div>PDF hilang/menggantung: <strong style={{ color: auditResult.missingPdfCount ? "#b45309" : "#15803d" }}>{auditResult.missingPdfCount}</strong></div>
                    {auditResult.missingPdfCount > 0 && (
                      <div style={{ paddingLeft: 12, color: "#475569", fontSize: 12, marginTop: 2 }}>
                        • Sudah diantre (menunggu cron): <strong style={{ color: "#15803d" }}>{auditResult.alreadyQueuedCount}</strong><br />
                        • Belum diantre: <strong style={{ color: auditResult.notQueuedCount ? "#b45309" : "#15803d" }}>{auditResult.notQueuedCount}</strong>
                      </div>
                    )}
                    <div style={{ marginTop: 4 }}>Data cacat (tak bisa generate): <strong style={{ color: auditResult.missingDataCount ? "#b91c1c" : "#15803d" }}>{auditResult.missingDataCount}</strong></div>
                    {auditResult.queuedNow > 0 && (
                      <div style={{ color: "#15803d", marginTop: 4 }}>✓ {auditResult.queuedNow} PDF baru diantrekan ke cron.</div>
                    )}
                    {auditResult.note && <div style={{ color: "#64748b", marginTop: 4, fontSize: 12 }}>{auditResult.note}</div>}
                    {auditResult.missingDataSample?.length > 0 && (
                      <details style={{ marginTop: 6 }}>
                        <summary style={{ cursor: "pointer", fontSize: 12, color: "#b91c1c" }}>Lihat data cacat ({auditResult.missingDataCount})</summary>
                        <ul style={{ paddingLeft: 18, fontSize: 12, color: "#7f1d1d", marginTop: 4 }}>
                          {auditResult.missingDataSample.map((m: any, i: number) => (
                            <li key={i}>{m.email} — {m.reason}</li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {divider}

        {/* Kursus Utama */}
        <p style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 10px' }}>
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
          <label className={styles.label}>ID Template Google Slide</label>
          <input
            type="text"
            className={styles.fieldInput}
            value={settings.mainCertSlideTemplateId}
            onChange={(e) => setSettings({ ...settings, mainCertSlideTemplateId: e.target.value })}
            placeholder="1BxiMVs0XRA5nFMDkVBdBZjgmUUqptlbs74OgVE2upms"
          />
          <span className={styles.fieldHint}>
            Salin dari URL: docs.google.com/presentation/d/<strong>[ID]</strong>/edit
          </span>
        </div>

        {divider}

        {/* Sertifikat Workshop */}
        <p style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 10px' }}>
          Sertifikat Kehadiran Workshop
        </p>
        <div className={styles.inputGroup}>
          <label className={styles.label}>ID Template Google Slide</label>
          <input
            type="text"
            className={styles.fieldInput}
            value={settings.workshopCertSlideTemplateId}
            onChange={(e) => setSettings({ ...settings, workshopCertSlideTemplateId: e.target.value })}
            placeholder="1BxiMVs0XRA5nFMDkVBdBZjgmUUqptlbs74OgVE2upms"
          />
          <span className={styles.fieldHint}>
            Judul dan tanggal diambil otomatis dari data event. Salin dari URL: docs.google.com/presentation/d/<strong>[ID]</strong>/edit
          </span>
        </div>
      </div>

      {/* ── STICKY SAVE ── */}
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
