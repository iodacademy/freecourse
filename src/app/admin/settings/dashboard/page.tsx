"use client";

import { useEffect, useState, useCallback } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import { Copy, RefreshCw, CheckCircle2, Sparkles, ChevronDown, ChevronRight } from "lucide-react";

interface MappingOptions {
  steps: Array<{ id: string; order: number; title: string; label: string; hasAssessment: boolean; kkm: number | null; questionCount: number }>;
  questions: Array<{ id: string; text: string; type: string; stepId: string; stepTitle: string; label: string }>;
}

interface Settings {
  targets?: { totalPendaftar?: number; perempuan?: number; disabilitas?: number };
  dashboardMapping?: {
    quizStepId?: string;
    survey1QuestionId?: string;
    feedbackQuestionId?: string;
    survey2QuestionId?: string;
  };
  publicDashboardEnabled?: boolean;
  publicDashboardToken?: string;
  googleSheetsId?: string;
  googleSheetName?: string;
  syncKey?: string;
  syncIntervalHours?: number;
}

function randomToken(len = 24): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function findDefault(questions: MappingOptions["questions"], ...keywords: string[]): string {
  for (const q of questions) {
    const lower = (q.text || "").toLowerCase();
    if (keywords.every((k) => lower.includes(k))) return q.id;
  }
  return "";
}
function findDefaultStep(steps: MappingOptions["steps"]): string {
  const keywords = ["cash flow", "alokasi pemasukan", "dana darurat"];
  const found = steps.find(
    (s) => s.hasAssessment && keywords.some((k) => (s.title || "").toLowerCase().includes(k))
  );
  return found?.id || (steps.find((s) => s.hasAssessment)?.id || "");
}

function getOrigin(): string {
  return typeof window !== "undefined" ? window.location.origin : "";
}

const GAS_CODE = `function syncDashboardSheet() {
  const props = PropertiesService.getScriptProperties();
  const url = props.getProperty('NEXTJS_URL') + '/api/sync/sheet-data';
  const syncKey = props.getProperty('SYNC_KEY');
  const sheetId = props.getProperty('SHEET_ID');
  const sheetName = props.getProperty('SHEET_NAME') || 'Data Dashboard';

  const res = UrlFetchApp.fetch(url, {
    headers: { 'X-Sync-Key': syncKey },
    muteHttpExceptions: true
  });
  if (res.getResponseCode() !== 200) throw new Error('Sync gagal: ' + res.getContentText());

  const data = JSON.parse(res.getContentText());
  const ss = SpreadsheetApp.openById(sheetId);
  let sheet = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
  sheet.clear();
  sheet.getRange(1, 1, data.rows.length + 1, data.headers.length)
       .setValues([data.headers, ...data.rows]);
  sheet.getRange('A1:Z1').setFontWeight('bold').setBackground('#FFE5E5');
  sheet.getRange(1, data.headers.length + 2).setValue('Last Sync: ' + data.generatedAt);
}`;

function DashboardSettingsContent() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<Settings>({});
  const [options, setOptions] = useState<MappingOptions>({ steps: [], questions: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [showGasTutorial, setShowGasTutorial] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const [sRes, oRes] = await Promise.all([
        fetch("/api/admin/settings", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/admin/dashboard/mapping-options", { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const s = await sRes.json();
      const o = await oRes.json();
      setSettings(s || {});
      setOptions(o || { steps: [], questions: [] });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  async function save(patch: Partial<Settings>) {
    if (!user) return;
    setSaving(true);
    setSavedMsg(null);
    try {
      const token = await user.getIdToken();
      const next = { ...settings, ...patch };
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(next),
      });
      if (!res.ok) throw new Error("Gagal simpan");
      setSettings(next);
      setSavedMsg("Tersimpan");
      setTimeout(() => setSavedMsg(null), 2000);
    } catch (e: any) {
      alert("Gagal simpan: " + (e?.message || ""));
    } finally {
      setSaving(false);
    }
  }

  function setTarget(key: "totalPendaftar" | "perempuan" | "disabilitas", val: number) {
    const next = { ...(settings.targets || {}), [key]: val };
    setSettings({ ...settings, targets: next });
  }
  function setMapping(key: "quizStepId" | "survey1QuestionId" | "feedbackQuestionId" | "survey2QuestionId", val: string) {
    const next = { ...(settings.dashboardMapping || {}), [key]: val };
    setSettings({ ...settings, dashboardMapping: next });
  }

  function autoDetectQuiz() {
    const id = findDefaultStep(options.steps);
    if (id) setMapping("quizStepId", id);
    else alert("Tidak ditemukan step yang cocok.");
  }
  function autoDetectSurvey1() {
    const id = findDefault(options.questions, "literasi keuangan", "soft skills");
    if (id) setMapping("survey1QuestionId", id);
    else alert("Tidak ditemukan pertanyaan yang cocok.");
  }
  function autoDetectFeedback() {
    const id = findDefault(options.questions, "ceritakan", "alasan");
    if (id) setMapping("feedbackQuestionId", id);
    else alert("Tidak ditemukan pertanyaan yang cocok.");
  }
  function autoDetectSurvey2() {
    const id = findDefault(options.questions, "minat", "preferensi kerja");
    if (id) setMapping("survey2QuestionId", id);
    else alert("Tidak ditemukan pertanyaan yang cocok.");
  }

  function getSelectedStep(): MappingOptions["steps"][number] | undefined {
    return options.steps.find((s) => s.id === settings.dashboardMapping?.quizStepId);
  }
  function getSelectedQ(key: "survey1QuestionId" | "feedbackQuestionId" | "survey2QuestionId") {
    const id = settings.dashboardMapping?.[key];
    if (!id) return undefined;
    return options.questions.find((q) => q.id === id);
  }

  async function generateSyncKey() {
    if (confirm("Generate Sync Key baru? Trigger GAS lama akan berhenti bekerja sampai key di-update.")) {
      const k = randomToken(32);
      await save({ syncKey: k });
    }
  }

  async function generatePublicToken() {
    if (settings.publicDashboardToken) {
      if (!confirm("Token baru akan menonaktifkan link lama. Lanjutkan?")) return;
    }
    const t = randomToken(20);
    await save({ publicDashboardToken: t });
  }

  async function togglePublicDashboard(enabled: boolean) {
    const patch: Partial<Settings> = { publicDashboardEnabled: enabled };
    // Generate token kalau enable pertama kali
    if (enabled && !settings.publicDashboardToken) {
      patch.publicDashboardToken = randomToken(20);
    }
    await save(patch);
  }

  async function copyToClipboard(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      alert(`${label} berhasil disalin`);
    } catch {
      alert("Gagal menyalin");
    }
  }

  if (loading) {
    return <div style={{ padding: 40 }}><p>Memuat pengaturan...</p></div>;
  }

  const mapping = settings.dashboardMapping || {};
  const selectedStep = getSelectedStep();
  const selectedQ1 = getSelectedQ("survey1QuestionId");
  const selectedQ2 = getSelectedQ("feedbackQuestionId");
  const selectedQ3 = getSelectedQ("survey2QuestionId");
  const publicUrl = settings.publicDashboardToken
    ? `${getOrigin()}/dashboard-public/${settings.publicDashboardToken}`
    : "";

  return (
    <div style={{ padding: "var(--space-6) var(--space-8)", maxWidth: 900, margin: "0 auto" }}>
      <header>
        {savedMsg && (
          <div style={{ marginBottom: 16, padding: "6px 12px", background: "var(--color-success-light)", color: "var(--color-success)", borderRadius: 6, display: "inline-flex", alignItems: "center", gap: 6 }}>
            <CheckCircle2 size={14} /> {savedMsg}
          </div>
        )}
      </header>

      {/* ── Section 1: Target Capaian ─────────────────────────────── */}
      <Section title="Target Capaian" desc="Diisi sesuai target sponsor / program. Dipakai untuk hitung % di card dashboard.">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          <FieldNum label="Target Total Pendaftar" value={settings.targets?.totalPendaftar || 0} onChange={(v) => setTarget("totalPendaftar", v)} />
          <FieldNum label="Target Pendaftar Perempuan" value={settings.targets?.perempuan || 0} onChange={(v) => setTarget("perempuan", v)} />
          <FieldNum label="Target Pendaftar Disabilitas" value={settings.targets?.disabilitas || 0} onChange={(v) => setTarget("disabilitas", v)} />
        </div>
        <button className="btn btn-primary" style={{ marginTop: 16 }} disabled={saving} onClick={() => save({ targets: settings.targets || {} })}>
          {saving ? "Menyimpan..." : "Simpan Target"}
        </button>
      </Section>

      {/* ── Section 2: Mapping Laporan ────────────────────────────── */}
      <Section
        title="Mapping Laporan Dashboard"
        desc="Pilih step quiz + 3 pertanyaan survey supaya kolom di dashboard & sheet ambil data dari sumber yang benar."
      >
        {/* Step Quiz */}
        <div style={{ marginBottom: 24 }}>
          <Label>Step untuk Nilai Quiz</Label>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <select className="form-select" style={{ flex: 1 }} value={mapping.quizStepId || ""} onChange={(e) => setMapping("quizStepId", e.target.value)}>
              <option value="">-- Pilih step --</option>
              {options.steps.filter((s) => s.hasAssessment).map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
            <button className="btn btn-secondary" type="button" onClick={autoDetectQuiz} title="Auto-Detect berdasar kata kunci">
              <Sparkles size={14} /> Auto
            </button>
          </div>
          {selectedStep && (
            <PreviewBox>
              <div><CheckCircle2 size={14} color="var(--color-success)" /> <strong>Step terpilih:</strong> {selectedStep.title}</div>
              <div style={{ marginTop: 4, fontSize: 12, color: "var(--color-gray-500)" }}>
                Jumlah soal: {selectedStep.questionCount} · KKM: {selectedStep.kkm ?? "-"}
              </div>
            </PreviewBox>
          )}
        </div>

        {/* Survei 1 */}
        <QuestionPicker
          label="Pertanyaan untuk Nilai Survei 1 (Kepuasan)"
          options={options.questions}
          value={mapping.survey1QuestionId || ""}
          onChange={(id) => setMapping("survey1QuestionId", id)}
          onAuto={autoDetectSurvey1}
          selected={selectedQ1}
        />

        {/* Feedback */}
        <QuestionPicker
          label="Pertanyaan untuk Feedback Materi"
          options={options.questions}
          value={mapping.feedbackQuestionId || ""}
          onChange={(id) => setMapping("feedbackQuestionId", id)}
          onAuto={autoDetectFeedback}
          selected={selectedQ2}
        />

        {/* Survei 2 */}
        <QuestionPicker
          label="Pertanyaan untuk Nilai Survei 2 (Keyakinan Kesiapan Kerja)"
          options={options.questions}
          value={mapping.survey2QuestionId || ""}
          onChange={(id) => setMapping("survey2QuestionId", id)}
          onAuto={autoDetectSurvey2}
          selected={selectedQ3}
        />

        <button className="btn btn-primary" disabled={saving} onClick={() => save({ dashboardMapping: settings.dashboardMapping || {} })}>
          {saving ? "Menyimpan..." : "Simpan Mapping"}
        </button>
      </Section>

      {/* ── Section 3: Public Link ────────────────────────────────── */}
      <Section title="Public Link Dashboard" desc="Aktifkan link publik untuk share dashboard ke stakeholder (chart + stat agregat, tanpa data per siswa).">
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <input
            type="checkbox"
            checked={settings.publicDashboardEnabled || false}
            onChange={(e) => togglePublicDashboard(e.target.checked)}
            id="public-toggle"
            style={{ width: 18, height: 18 }}
          />
          <label htmlFor="public-toggle" style={{ fontWeight: 600 }}>
            {settings.publicDashboardEnabled ? "Aktif" : "Nonaktif"} — link publik {settings.publicDashboardEnabled ? "bisa" : "tidak"} diakses
          </label>
        </div>
        {settings.publicDashboardEnabled && publicUrl && (
          <div>
            <Label>URL Publik</Label>
            <div style={{ display: "flex", gap: 8 }}>
              <input className="form-input" value={publicUrl} readOnly style={{ flex: 1, fontFamily: "monospace", fontSize: 12 }} />
              <button className="btn btn-secondary" onClick={() => copyToClipboard(publicUrl, "Link publik")}>
                <Copy size={14} /> Salin
              </button>
              <button className="btn btn-secondary" onClick={generatePublicToken}>
                <RefreshCw size={14} /> Regenerate
              </button>
            </div>
            <p style={{ fontSize: 12, color: "var(--color-gray-500)", marginTop: 8 }}>
              ⚠️ Regenerate akan membuat link lama berhenti bekerja.
            </p>
          </div>
        )}
      </Section>

      {/* ── Section 4: Sync Google Sheet ──────────────────────────── */}
      <Section title="Sinkron Google Sheet (Otomatis via GAS Cron)" desc="Data Bagian 1 + Bagian 2 di-push ke Google Sheet berkala. GAS yang pull dari aplikasi.">
        <div style={{ marginBottom: 16 }}>
          <Label>Google Sheets ID</Label>
          <input
            className="form-input"
            placeholder="Ambil dari URL: https://docs.google.com/spreadsheets/d/{ID}/edit"
            value={settings.googleSheetsId || ""}
            onChange={(e) => setSettings({ ...settings, googleSheetsId: e.target.value })}
          />
        </div>
        <div style={{ marginBottom: 16 }}>
          <Label>Nama Sheet (Tab)</Label>
          <input
            className="form-input"
            placeholder="Data Dashboard"
            value={settings.googleSheetName || ""}
            onChange={(e) => setSettings({ ...settings, googleSheetName: e.target.value })}
          />
        </div>
        <div style={{ marginBottom: 16 }}>
          <Label>Sync Key (untuk header X-Sync-Key di GAS)</Label>
          <div style={{ display: "flex", gap: 8 }}>
            <input className="form-input" value={settings.syncKey || ""} readOnly placeholder="(belum di-generate)" style={{ flex: 1, fontFamily: "monospace", fontSize: 12 }} />
            <button className="btn btn-secondary" onClick={() => copyToClipboard(settings.syncKey || "", "Sync Key")} disabled={!settings.syncKey}>
              <Copy size={14} /> Salin
            </button>
            <button className="btn btn-secondary" onClick={generateSyncKey}>
              <RefreshCw size={14} /> Generate
            </button>
          </div>
        </div>

        <button className="btn btn-primary" disabled={saving} onClick={() => save({
          googleSheetsId: settings.googleSheetsId,
          googleSheetName: settings.googleSheetName,
        })}>
          {saving ? "Menyimpan..." : "Simpan Konfigurasi Sheet"}
        </button>

        <div style={{ marginTop: 24, padding: 16, background: "var(--color-gray-50)", borderRadius: 8 }}>
          <button className="btn btn-secondary" type="button" onClick={() => setShowGasTutorial((v) => !v)}>
            {showGasTutorial ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            Cara Setup di GAS (klik untuk buka)
          </button>
          {showGasTutorial && (
            <div style={{ marginTop: 12, fontSize: 13, lineHeight: 1.7 }}>
              <p><strong>Langkah-langkah deploy ke Google Apps Script:</strong></p>
              <ol style={{ paddingLeft: 20 }}>
                <li>Buka <a href="https://script.google.com" target="_blank" rel="noreferrer" style={{ color: "var(--color-primary)" }}>script.google.com</a> → New Project</li>
                <li>Paste kode di bawah (klik tombol "Salin Code GAS")</li>
                <li>Buka menu <strong>Project Settings</strong> (icon roda gigi kiri) → scroll ke <strong>Script Properties</strong> → Add property:
                  <ul>
                    <li><code>NEXTJS_URL</code> = <code>{getOrigin()}</code></li>
                    <li><code>SYNC_KEY</code> = isi dengan Sync Key dari atas</li>
                    <li><code>SHEET_ID</code> = isi dengan Sheets ID dari atas</li>
                    <li><code>SHEET_NAME</code> = isi dengan Nama Sheet (atau biarkan kosong = "Data Dashboard")</li>
                  </ul>
                </li>
                <li>Buka menu <strong>Triggers</strong> (icon jam tangan kiri) → Add Trigger:
                  <ul>
                    <li>Function: <code>syncDashboardSheet</code></li>
                    <li>Event source: <strong>Time-driven</strong></li>
                    <li>Type: <strong>Hour timer</strong> → Every hour</li>
                  </ul>
                </li>
                <li>Test "Run" manual sekali → cek di Google Sheet → harus terisi data</li>
              </ol>
              <button className="btn btn-secondary" style={{ marginTop: 12 }} onClick={() => copyToClipboard(GAS_CODE, "Code GAS")}>
                <Copy size={14} /> Salin Code GAS
              </button>
              <pre style={{ marginTop: 12, padding: 12, background: "#1e1e1e", color: "#e6e6e6", borderRadius: 6, overflowX: "auto", fontSize: 11, lineHeight: 1.5 }}>{GAS_CODE}</pre>
            </div>
          )}
        </div>
      </Section>
    </div>
  );
}

// ─── Helpers UI ─────────────────────────────────────────────────────────────

function Section({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <section style={{ background: "white", padding: 24, borderRadius: 12, border: "1px solid var(--color-gray-200)", marginBottom: 24 }}>
      <h2 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 700 }}>{title}</h2>
      <p style={{ margin: "0 0 20px", color: "var(--color-gray-500)", fontSize: 13 }}>{desc}</p>
      {children}
    </section>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 600 }}>{children}</label>;
}

function FieldNum({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <Label>{label}</Label>
      <input
        type="number"
        className="form-input"
        min={0}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10) || 0)}
      />
    </div>
  );
}

function PreviewBox({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 8, padding: 12, background: "var(--color-gray-50)", borderRadius: 8, fontSize: 13 }}>
      {children}
    </div>
  );
}

function QuestionPicker({
  label, options, value, onChange, onAuto, selected,
}: {
  label: string;
  options: MappingOptions["questions"];
  value: string;
  onChange: (v: string) => void;
  onAuto: () => void;
  selected: MappingOptions["questions"][number] | undefined;
}) {
  return (
    <div style={{ marginBottom: 24 }}>
      <Label>{label}</Label>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <select className="form-select" style={{ flex: 1 }} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">-- Pilih pertanyaan --</option>
          {options.map((q) => (
            <option key={q.id} value={q.id}>{q.label}</option>
          ))}
        </select>
        <button className="btn btn-secondary" type="button" onClick={onAuto} title="Auto-Detect berdasar kata kunci">
          <Sparkles size={14} /> Auto
        </button>
      </div>
      {selected && (
        <PreviewBox>
          <div><CheckCircle2 size={14} color="var(--color-success)" /> <strong>Pertanyaan terpilih:</strong></div>
          <div style={{ marginTop: 4 }}>&quot;{selected.text}&quot;</div>
          <div style={{ marginTop: 6, fontSize: 12, color: "var(--color-gray-500)" }}>
            Tipe jawaban: <strong>{selected.type}</strong> · Dari: {selected.stepTitle || "(tanpa judul)"}
          </div>
        </PreviewBox>
      )}
    </div>
  );
}

export default function DashboardSettingsPage() {
  return (
    <ProtectedRoute requireAdmin>
      <DashboardSettingsContent />
    </ProtectedRoute>
  );
}
