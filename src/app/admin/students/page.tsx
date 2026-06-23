"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import ProtectedRoute from "@/components/ProtectedRoute";
import styles from "./page.module.css";
import type { UserProfile } from "@/lib/types";
import type { DashboardStudent } from "@/lib/dashboard-aggregator";
import { useAuth } from "@/contexts/AuthContext";
import {
  Trash2, X, User, Mail, MapPin, CalendarDays, Venus, Mars,
  CircleUserRound, Building2, Hash, Tag, Link2, CheckCircle2, XCircle,
  BarChart2, Eye, Download, BookOpen, Trophy, Clock, CheckSquare, Activity,
  BookMarked, Loader2, AlertCircle, Search, ChevronLeft, ChevronRight, Pencil, Save, UserX
} from "lucide-react";

function getAge(ttlStr: string): string {
  if (!ttlStr) return "—";
  const d = new Date(ttlStr + "T00:00:00");
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  if (today.getMonth() < d.getMonth() || (today.getMonth() === d.getMonth() && today.getDate() < d.getDate())) age--;
  const formatted = d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  return `${formatted} (${age} tahun)`;
}

function channelLabel(src?: string | null) {
  if (src === "kemitraan") return "Kemitraan";
  if (src === "beasiswa") return "Beasiswa";
  if (src === "workshop") return "Workshop";
  if (src === "umum") return "Umum";
  return src || "—";
}

/* ─── Progress Modal ────────────────────────────────────── */
interface ProgressModalProps {
  student: Partial<UserProfile> | null;
  onClose: () => void;
  getToken: () => Promise<string>;
}

function ProgressModal({ student, onClose, getToken }: ProgressModalProps) {
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!student) return;
    function handler(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [student, onClose]);

  useEffect(() => {
    document.body.style.overflow = student ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [student]);

  useEffect(() => {
    if (!student?.uid) return;
    async function fetchProgress() {
      setLoading(true);
      setError("");
      try {
        const token = await getToken();
        const res = await fetch(`/api/enrollments?userId=${student!.uid}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error("Gagal memuat data progress");
        const data = await res.json();
        setEnrollments(data);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    fetchProgress();
  }, [student, getToken]);

  if (!student) return null;

  const namaLengkap = student.displayName || "—";
  const photoURL = student.photoURL || null;
  const initials = namaLengkap.split(" ").slice(0, 2).map((w: string) => w[0] || "").join("").toUpperCase();

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.detailModal} style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.detailHeader}>
          <div className={styles.detailAvatar}>
            {photoURL ? (
              <Image src={photoURL} alt="Avatar" width={64} height={64} style={{ borderRadius: "50%", objectFit: "cover" }} />
            ) : (
              <div className={styles.detailInitials}>{initials}</div>
            )}
          </div>
          <div className={styles.detailHeaderInfo}>
            <h2 className={styles.detailName}>{namaLengkap}</h2>
            <div className={styles.detailEmail}>{student.email}</div>
            <div className={styles.detailMetaRow}>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", display: "flex", alignItems: "center", gap: 4 }}>
                <Activity size={12} /> Progress Belajar
              </span>
            </div>
          </div>
          <button className={styles.detailClose} onClick={onClose}><X size={18} /></button>
        </div>

        {/* Body */}
        <div className={styles.detailBody}>
          {loading && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "40px 0", color: "#64748b" }}>
              <Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} /> Memuat data progress...
            </div>
          )}
          {error && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "16px", background: "#fef2f2", borderRadius: 8, color: "#b91c1c", fontSize: 14 }}>
              <AlertCircle size={16} /> {error}
            </div>
          )}
          {!loading && !error && enrollments.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px 0", color: "#94a3b8" }}>
              <BookOpen size={36} style={{ marginBottom: 12, opacity: 0.4 }} />
              <div style={{ fontSize: 14 }}>Siswa ini belum memiliki data enrollment.</div>
            </div>
          )}
          {!loading && enrollments.map((enr: any) => {
            const stepProgress = enr.stepProgress || {};
            const completedSteps = Object.values(stepProgress).filter((s: any) => s.completed).length;
            const totalSteps = Object.keys(stepProgress).length;
            const pct = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
            const statusColor = enr.status === "completed" ? "#CC0000" : enr.status === "in_progress" ? "#CC0000" : "#94a3b8";
            const statusLabel = enr.status === "completed" ? "Selesai" : enr.status === "in_progress" ? "Sedang Belajar" : "Belum Mulai";

            // Hitung rata-rata skor assessment
            const scores: number[] = [];
            Object.values(stepProgress).forEach((s: any) => {
              if (s.assessmentResult?.score != null) scores.push(s.assessmentResult.score);
            });
            const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

            const certClaimed = enr.certificateClaimed || enr.certificateId;
            const updatedAt = enr.updatedAt?.seconds
              ? new Date(enr.updatedAt.seconds * 1000).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })
              : "—";

            return (
              <div key={enr.id} className={styles.detailSection}>
                <div className={styles.detailSectionTitle}>
                  <BookMarked size={14} /> {enr.courseId || "Kelas Utama"}
                </div>

                {/* Progress Bar */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 12, color: "#64748b" }}>Progress Materi</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: pct === 100 ? "#CC0000" : "#1e293b" }}>{pct}%</span>
                  </div>
                  <div style={{ height: 8, borderRadius: 99, background: "#f5f5f5", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, borderRadius: 99, background: pct === 100 ? "#CC0000" : "linear-gradient(90deg, #CC0000, #FF3333)", transition: "width 0.5s ease" }} />
                  </div>
                </div>

                {/* Stats Grid */}
                <div className={styles.progressGrid}>
                  <div className={styles.progressStat}>
                    <CheckSquare size={16} style={{ color: "#CC0000" }} />
                    <div className={styles.progressStatVal}>{completedSteps} / {totalSteps}</div>
                    <div className={styles.progressStatLabel}>Materi Selesai</div>
                  </div>
                  {avgScore !== null && (
                    <div className={styles.progressStat}>
                      <BarChart2 size={16} style={{ color: "#CC0000" }} />
                      <div className={styles.progressStatVal}>{avgScore}</div>
                      <div className={styles.progressStatLabel}>Rata-rata Skor</div>
                    </div>
                  )}
                  <div className={styles.progressStat}>
                    <Trophy size={16} style={{ color: certClaimed ? "#CC0000" : "#94a3b8" }} />
                    <div className={styles.progressStatVal} style={{ color: certClaimed ? "#CC0000" : "#94a3b8" }}>
                      {certClaimed ? "Ada" : "Belum"}
                    </div>
                    <div className={styles.progressStatLabel}>Sertifikat</div>
                  </div>
                  <div className={styles.progressStat}>
                    <Activity size={16} style={{ color: statusColor }} />
                    <div className={styles.progressStatVal} style={{ color: statusColor, fontSize: 12 }}>{statusLabel}</div>
                    <div className={styles.progressStatLabel}>Status</div>
                  </div>
                </div>

                <div style={{ fontSize: 11, color: "#94a3b8", display: "flex", alignItems: "center", gap: 4, marginTop: 8 }}>
                  <Clock size={11} /> Terakhir aktif: {updatedAt}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface StudentDetailModalProps {
  student: (DashboardStudent & { displayName?: string, photoURL?: string | null }) | null;
  onClose: () => void;
}

function StudentDetailModal({ student, onClose }: StudentDetailModalProps) {
  useEffect(() => {
    if (!student) return;
    function handler(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [student, onClose]);

  useEffect(() => {
    document.body.style.overflow = student ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [student]);

  if (!student) return null;

  const namaLengkap = student.namaLengkap || student.displayName || "—";
  const email = student.email || "—";
  const photoURL = student.photoURL || null;
  const initials = namaLengkap.split(" ").slice(0, 2).map((w: string) => w[0] || "").join("").toUpperCase();

  const jenisKelamin = student.jenisKelamin || "—";
  const umur = student.umur || "—";
  const kota = student.kota || "—";
  const disabilitas = student.disabilitas || "—";
  const channelSource = student.channelSource || student.channel;
  const detailChannel = student.detailChannel || "—";
  const minat = student.minat || "—";
  const status = student.status || "—";
  const nilaiQuiz = student.nilaiQuiz || "—";
  const survei1 = student.nilaiSurvei1 || "—";
  const survei2 = student.nilaiSurvei2 || "—";
  const createdAt = student.tanggalDaftar || "—";

  function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value: string | React.ReactNode }) {
    return (
      <div className={styles.detailRow}>
        <div className={styles.detailIcon}><Icon size={15} /></div>
        <div>
          <div className={styles.detailLabel}>{label}</div>
          <div className={styles.detailValue}>{value || "—"}</div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.detailModal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.detailHeader}>
          <div className={styles.detailAvatar}>
            {photoURL ? (
              <Image src={photoURL} alt="Avatar" width={64} height={64} style={{ borderRadius: "50%", objectFit: "cover" }} />
            ) : (
              <div className={styles.detailInitials}>{initials}</div>
            )}
            <div className={styles.detailOnlineDot} />
          </div>
          <div className={styles.detailHeaderInfo}>
            <h2 className={styles.detailName}>{namaLengkap}</h2>
            <div className={styles.detailEmail}>{email}</div>
            <div className={styles.detailMetaRow}>
              <span className={styles.channelBadge}>{channelLabel(channelSource)}</span>
              <span className={styles.detailDate}>
                <CalendarDays size={12} style={{ marginRight: 4, verticalAlign: "middle" }} />
                Daftar {createdAt}
              </span>
            </div>
          </div>
          <button className={styles.detailClose} onClick={onClose} aria-label="Tutup">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className={styles.detailBody}>
          {/* Data Diri */}
          <div className={styles.detailSection}>
            <div className={styles.detailSectionTitle}>
              <CircleUserRound size={14} /> Data Diri
            </div>
            <InfoRow icon={User} label="Nama Lengkap" value={namaLengkap} />
            <InfoRow icon={Mail} label="Email" value={email} />
            <InfoRow icon={jenisKelamin === "Perempuan" ? Venus : Mars} label="Jenis Kelamin" value={jenisKelamin} />
            <InfoRow icon={CalendarDays} label="Umur" value={`${umur} tahun`} />
          </div>

          {/* Asal Daerah */}
          <div className={styles.detailSection}>
            <div className={styles.detailSectionTitle}>
              <MapPin size={14} /> Asal Daerah
            </div>
            <InfoRow icon={MapPin} label="Kota / Kabupaten" value={kota} />
          </div>

          {/* Status Disabilitas */}
          <div className={styles.detailSection}>
            <div className={styles.detailSectionTitle}>
              <CheckCircle2 size={14} /> Status Disabilitas
            </div>
            <InfoRow
              icon={disabilitas === "Tidak" || disabilitas === "Bukan Penyandang Disabilitas" ? CheckCircle2 : XCircle}
              label="Penyandang Disabilitas"
              value={
                disabilitas === "Tidak" || disabilitas === "Bukan Penyandang Disabilitas"
                  ? <span style={{ color: "#16a34a", fontWeight: 600 }}>Bukan Penyandang</span>
                  : disabilitas === "Ya" || disabilitas === "Penyandang Disabilitas"
                    ? <span style={{ color: "#dc2626", fontWeight: 600 }}>Penyandang Disabilitas</span>
                    : disabilitas
              }
            />
          </div>

          {/* Channel & Minat */}
          <div className={styles.detailSection}>
            <div className={styles.detailSectionTitle}>
              <Link2 size={14} /> Pendaftaran & Minat
            </div>
            <InfoRow icon={Tag} label="Channel" value={channelLabel(channelSource)} />
            <InfoRow icon={Building2} label="Detail Channel" value={detailChannel} />
            <InfoRow icon={BarChart2} label="Topik Diminati" value={minat} />
            <InfoRow icon={CalendarDays} label="Tanggal Daftar" value={createdAt} />
          </div>

          {/* Progress Belajar */}
          <div className={styles.detailSection}>
            <div className={styles.detailSectionTitle}>
              <BarChart2 size={14} /> Progress Belajar & Evaluasi
            </div>
            <InfoRow
              icon={status === "Selesai" || status === "Tersertifikasi" ? CheckCircle2 : XCircle}
              label="Status Belajar"
              value={status === "Selesai" || status === "Tersertifikasi"
                ? <span style={{ color: "#16a34a", fontWeight: 600 }}>{status}</span>
                : <span style={{ color: "#f59e0b", fontWeight: 600 }}>{status}</span>
              }
            />
            <InfoRow
              icon={(student as any).statusKuis === "LULUS" ? CheckCircle2 : XCircle}
              label="Status Kuis"
              value={(student as any).statusKuis === "LULUS"
                ? <span style={{ color: "#16a34a", fontWeight: 700 }}>✓ LULUS</span>
                : (student as any).statusKuis === "TIDAK LULUS"
                  ? <span style={{ color: "#dc2626", fontWeight: 700 }}>✕ TIDAK LULUS</span>
                  : <span style={{ color: "#94a3b8" }}>— Belum mengerjakan kuis</span>
              }
            />
            <InfoRow icon={CheckCircle2} label="Nilai Quiz" value={nilaiQuiz} />
            <InfoRow icon={CheckCircle2} label="Survei Awal" value={survei1} />
            <InfoRow icon={CheckCircle2} label="Survei Akhir" value={survei2} />
            <InfoRow icon={Trophy} label="Sertifikat" value={(student as any).linkSertifikat ? <a href={(student as any).linkSertifikat} target="_blank" rel="noopener noreferrer" style={{color: '#2563eb', textDecoration: 'underline'}}>Lihat Sertifikat</a> : "—"} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Student Edit Modal ─────────────────────────────────── */
/* ─── Edit Identitas Peserta Modal ──────────────────────── */
interface StudentProfileEditModalProps {
  student: any | null;
  onClose: () => void;
  getToken: () => Promise<string>;
  onSaved: (updated: {
    uid: string;
    namaLengkap: string;
    jenisKelamin?: string;
    asalDaerah?: string;
    newCertUrl?: string | null;
  }) => void;
}

// Ambil nilai dari profileData dengan dukungan dua gaya nama field.
function pickProfile(pd: any, snake: string, camel: string): string {
  if (!pd) return "";
  const v = pd[snake] !== undefined && pd[snake] !== "" ? pd[snake] : pd[camel];
  if (Array.isArray(v)) return v.join(", ");
  return v != null ? String(v) : "";
}

function StudentProfileEditModal({ student, onClose, getToken, onSaved }: StudentProfileEditModalProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const [form, setForm] = useState({
    nama_lengkap: "",
    jenis_kelamin: "",
    tanggal_lahir: "",
    nomor_whatsapp: "",
    asal_daerah: "",
    disabilitas: "",
    kategori_disabilitas: "",
    minat: "",
  });

  useEffect(() => {
    if (!student) return;
    function handler(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [student, onClose]);

  useEffect(() => {
    if (!student?.uid) return;
    setError(""); setInfo(""); setLoading(true);
    (async () => {
      try {
        const token = await getToken();
        const res = await fetch(`/api/users/${student.uid}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        if (!res.ok) throw new Error("Gagal memuat data peserta");
        const u = await res.json();
        const pd = u.profileData || {};
        setForm({
          nama_lengkap: pickProfile(pd, "nama_lengkap", "namaLengkap") || u.displayName || "",
          jenis_kelamin: pickProfile(pd, "jenis_kelamin", "jenisKelamin"),
          tanggal_lahir: pickProfile(pd, "tanggal_lahir", "tanggalLahir"),
          nomor_whatsapp: pickProfile(pd, "nomor_whatsapp", "nomorWA"),
          asal_daerah: pickProfile(pd, "asal_daerah", "kotaKabupaten"),
          disabilitas: pickProfile(pd, "disabilitas", "disabilitas"),
          kategori_disabilitas: pickProfile(pd, "kategori_disabilitas_yang_anda_miliki", "kategoriDisabilitas"),
          minat: pickProfile(pd, "jika_diberikan_kesempatan_pelatihan_bidang_apa_yang_paling_anda_minati", "minat"),
        });
      } catch (e: any) {
        setError(e.message || "Gagal memuat data");
      } finally {
        setLoading(false);
      }
    })();
  }, [student, getToken]);

  const set = (k: string, v: string) => setForm(prev => ({ ...prev, [k]: v }));

  async function handleSave() {
    if (!student?.uid) return;
    if (!form.nama_lengkap.trim()) { setError("Nama lengkap wajib diisi."); return; }
    setSaving(true); setError(""); setInfo("");
    try {
      const token = await getToken();
      const body: Record<string, any> = {
        nama_lengkap: form.nama_lengkap.trim(),
        jenis_kelamin: form.jenis_kelamin,
        tanggal_lahir: form.tanggal_lahir,
        nomor_whatsapp: form.nomor_whatsapp,
        asal_daerah: form.asal_daerah,
        disabilitas: form.disabilitas,
        kategori_disabilitas_yang_anda_miliki: form.kategori_disabilitas,
        jika_diberikan_kesempatan_pelatihan_bidang_apa_yang_paling_anda_minati: form.minat,
      };
      const res = await fetch(`/api/admin/students/${student.uid}/full-edit`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan");

      if (data.certRegenerated) {
        setInfo("Data tersimpan. Sertifikat berhasil dibuat ulang dengan nama baru.");
      } else if (data.nameChanged) {
        setInfo("Data tersimpan. (Sertifikat tidak dibuat ulang karena peserta belum punya sertifikat.)");
      } else {
        setInfo("Data berhasil disimpan.");
      }

      // Beri jeda singkat agar admin sempat membaca pesan, lalu tutup & refresh.
      setTimeout(() => {
        onSaved({
          uid: student.uid,
          namaLengkap: form.nama_lengkap.trim(),
          jenisKelamin: form.jenis_kelamin,
          asalDaerah: form.asal_daerah,
          newCertUrl: data.newCertUrl || null,
        });
      }, 900);
    } catch (e: any) {
      setError(e.message || "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  }

  if (!student) return null;

  const fieldStyle: React.CSSProperties = { marginBottom: 14 };
  const labelStyle: React.CSSProperties = { display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#374151", marginBottom: 4 };
  const inputStyle: React.CSSProperties = { width: "100%", padding: "9px 12px", border: "1.5px solid #e5e7eb", borderRadius: 8, fontSize: "0.9rem" };

  return (
    <div className={styles.modalOverlay} onClick={() => !saving && onClose()}>
      <div className={styles.detailModal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.detailHeader}>
          <div className={styles.detailHeaderInfo}>
            <h2 className={styles.detailName} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <CircleUserRound size={18} /> Edit Identitas Peserta
            </h2>
            <div className={styles.detailEmail}>{student.email}</div>
          </div>
          <button className={styles.detailClose} onClick={onClose}><X size={20} /></button>
        </div>

        <div className={styles.detailBody}>
          {loading ? (
            <div style={{ textAlign: "center", padding: 32 }}>
              <Loader2 className="animate-spin" size={28} /> <p>Memuat data...</p>
            </div>
          ) : (
            <>
              <div style={fieldStyle}>
                <label style={labelStyle}>Nama Lengkap *</label>
                <input style={inputStyle} value={form.nama_lengkap} onChange={(e) => set("nama_lengkap", e.target.value)} />
                <div style={{ fontSize: "0.72rem", color: "#9ca3af", marginTop: 4 }}>
                  Mengubah nama akan otomatis membuat ulang sertifikat (jika sudah pernah klaim).
                </div>
              </div>

              <div style={fieldStyle}>
                <label style={labelStyle}>Jenis Kelamin</label>
                <select style={inputStyle} value={form.jenis_kelamin} onChange={(e) => set("jenis_kelamin", e.target.value)}>
                  <option value="">— Pilih —</option>
                  <option value="Laki-laki">Laki-laki</option>
                  <option value="Perempuan">Perempuan</option>
                </select>
              </div>

              <div style={fieldStyle}>
                <label style={labelStyle}>Tanggal Lahir</label>
                <input type="date" style={inputStyle} value={form.tanggal_lahir} onChange={(e) => set("tanggal_lahir", e.target.value)} />
              </div>

              <div style={fieldStyle}>
                <label style={labelStyle}>Nomor WhatsApp</label>
                <input style={inputStyle} value={form.nomor_whatsapp} onChange={(e) => set("nomor_whatsapp", e.target.value)} placeholder="contoh: 8123456789" />
              </div>

              <div style={fieldStyle}>
                <label style={labelStyle}>Asal Daerah / Domisili</label>
                <input style={inputStyle} value={form.asal_daerah} onChange={(e) => set("asal_daerah", e.target.value)} />
              </div>

              <div style={fieldStyle}>
                <label style={labelStyle}>Status Disabilitas</label>
                <select style={inputStyle} value={form.disabilitas} onChange={(e) => set("disabilitas", e.target.value)}>
                  <option value="">— Pilih —</option>
                  <option value="Tidak">Tidak</option>
                  <option value="Ya">Ya</option>
                </select>
              </div>

              {form.disabilitas === "Ya" && (
                <div style={fieldStyle}>
                  <label style={labelStyle}>Kategori Disabilitas</label>
                  <input style={inputStyle} value={form.kategori_disabilitas} onChange={(e) => set("kategori_disabilitas", e.target.value)} />
                </div>
              )}

              <div style={fieldStyle}>
                <label style={labelStyle}>Minat Pelatihan</label>
                <input style={inputStyle} value={form.minat} onChange={(e) => set("minat", e.target.value)} />
              </div>

              {error && <div style={{ background: "#FEE2E2", color: "#B91C1C", padding: "10px 12px", borderRadius: 8, fontSize: "0.85rem", marginTop: 8 }}>{error}</div>}
              {info && <div style={{ background: "#DCFCE7", color: "#166534", padding: "10px 12px", borderRadius: 8, fontSize: "0.85rem", marginTop: 8 }}>{info}</div>}
            </>
          )}
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", padding: 16, borderTop: "1px solid #eee" }}>
          <button className={styles.pageBtn} onClick={onClose} disabled={saving}>Batal</button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            style={{ display: "flex", alignItems: "center", gap: 6, background: "#7c3aed", color: "#fff", border: "none", padding: "9px 18px", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}
          >
            {saving ? <><Loader2 className="animate-spin" size={16} /> Menyimpan...</> : <><Save size={16} /> Simpan Perubahan</>}
          </button>
        </div>
      </div>
    </div>
  );
}

interface StudentEditModalProps {
  student: any | null;
  onClose: () => void;
  getToken: () => Promise<string>;
  onSaved: (updated: { uid: string; newScore: number }) => void;
}

function StudentEditModal({ student, onClose, getToken, onSaved }: StudentEditModalProps) {
  const [enrollment, setEnrollment] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Form state
  const [selectedStepId, setSelectedStepId] = useState<string>("");
  const [newScore, setNewScore] = useState<string>("");
  const [newCurrentStep, setNewCurrentStep] = useState<string>("");

  useEffect(() => {
    if (!student) return;
    function handler(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [student, onClose]);

  useEffect(() => {
    document.body.style.overflow = student ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [student]);

  useEffect(() => {
    if (!student?.uid) return;
    setEnrollment(null);
    setError("");
    setSuccess("");
    setSelectedStepId("");
    setNewScore("");
    setNewCurrentStep("");
    setLoading(true);

    async function fetchEnrollment() {
      try {
        const token = await getToken();
        const res = await fetch(`/api/admin/students/${student!.uid}/enrollment`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Gagal memuat data enrollment");
        const data = await res.json();
        setEnrollment(data.enrollment);
        if (data.enrollment) {
          setNewCurrentStep(String(data.enrollment.currentStep ?? ""));
          // Pilih step quiz pertama secara default
          const firstQuizStep = data.enrollment.steps?.find((s: any) => s.hasAssessment);
          if (firstQuizStep) {
            setSelectedStepId(firstQuizStep.id);
            setNewScore(firstQuizStep.currentScore != null ? String(firstQuizStep.currentScore) : "");
          }
        }
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    fetchEnrollment();
  }, [student, getToken]);

  const handleStepChange = (stepId: string) => {
    setSelectedStepId(stepId);
    const step = enrollment?.steps?.find((s: any) => s.id === stepId);
    setNewScore(step?.currentScore != null ? String(step.currentScore) : "");
  };

  const handleSave = async () => {
    if (!student?.uid || !enrollment?.id) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const token = await getToken();
      const body: any = { enrollmentId: enrollment.id };
      if (selectedStepId && newScore !== "") {
        body.quizStepId = selectedStepId;
        body.newScore = Number(newScore);
      }
      if (newCurrentStep !== "") {
        body.currentStep = Number(newCurrentStep);
      }

      const res = await fetch(`/api/admin/students/${student.uid}/enrollment`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan perubahan");

      setSuccess("Perubahan berhasil disimpan! Siswa sekarang dapat klaim sertifikat jika nilai sudah memenuhi KKM.");
      onSaved({ uid: student.uid, newScore: Number(newScore) });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (!student) return null;

  const quizSteps = enrollment?.steps?.filter((s: any) => s.hasAssessment) || [];

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.detailModal} onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
        {/* Header */}
        <div className={styles.detailHeader}>
          <div>
            <div className={styles.detailName} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Pencil size={18} color="#2563eb" />
              Edit Data Siswa
            </div>
            <div className={styles.detailEmail}>{student.namaLengkap || student.email}</div>
          </div>
          <button className={styles.closeBtn} onClick={onClose}><X size={18} /></button>
        </div>

        {/* Body */}
        <div className={styles.detailBody}>
          {loading && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#6b7280", padding: "16px 0" }}>
              <Loader2 size={16} className="spin" /> Memuat data enrollment...
            </div>
          )}

          {!loading && !enrollment && (
            <div style={{ color: "#f59e0b", padding: "12px 0", display: "flex", alignItems: "center", gap: 8 }}>
              <AlertCircle size={16} /> Siswa ini belum memiliki enrollment di kursus utama.
            </div>
          )}

          {!loading && enrollment && (
            <>
              {/* Info enrollment */}
              <div style={{ background: "#f9fafb", borderRadius: 10, padding: "12px 16px", marginBottom: 20, fontSize: 13, color: "#374151" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ color: "#6b7280" }}>Status Sertifikat</span>
                  <span style={{ fontWeight: 600, color: enrollment.certificateClaimed ? "#16a34a" : "#f59e0b" }}>
                    {enrollment.certificateClaimed ? "✓ Sudah Diklaim" : "Belum Diklaim"}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#6b7280" }}>Langkah Saat Ini</span>
                  <span style={{ fontWeight: 600 }}>{enrollment.currentStep}</span>
                </div>
              </div>

              {/* Edit Nilai Quiz */}
              {quizSteps.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 8 }}>
                    Edit Nilai Quiz
                  </label>
                  {quizSteps.length > 1 && (
                    <select
                      value={selectedStepId}
                      onChange={(e) => handleStepChange(e.target.value)}
                      style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 13, marginBottom: 10, background: "#fff" }}
                    >
                      {quizSteps.map((s: any) => (
                        <option key={s.id} value={s.id}>{s.title || s.id}</option>
                      ))}
                    </select>
                  )}
                  {selectedStepId && (
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>
                          Nilai sekarang: <strong>{quizSteps.find((s: any) => s.id === selectedStepId)?.currentScore ?? "Belum ada"}</strong>
                          {quizSteps.find((s: any) => s.id === selectedStepId)?.kkm && (
                            <span> &bull; KKM: <strong>{quizSteps.find((s: any) => s.id === selectedStepId)?.kkm}</strong></span>
                          )}
                        </div>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={newScore}
                          onChange={(e) => setNewScore(e.target.value)}
                          placeholder="Nilai baru (0–100)"
                          style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 14 }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {quizSteps.length === 0 && (
                <div style={{ color: "#6b7280", fontSize: 13, marginBottom: 16 }}>
                  Tidak ada langkah quiz di kursus ini.
                </div>
              )}

              {/* Edit Current Step */}
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 8 }}>
                  Edit Posisi Langkah Siswa
                </label>
                <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 6 }}>
                  Mengubah ini akan memajukan/memundurkan posisi belajar siswa.
                </div>
                <input
                  type="number"
                  min={1}
                  value={newCurrentStep}
                  onChange={(e) => setNewCurrentStep(e.target.value)}
                  placeholder="Langkah (misal: 5)"
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 14 }}
                />
              </div>

              {/* Feedback */}
              {error && (
                <div style={{ color: "#dc2626", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px", fontSize: 13, marginBottom: 12 }}>
                  {error}
                </div>
              )}
              {success && (
                <div style={{ color: "#16a34a", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "10px 14px", fontSize: 13, marginBottom: 12 }}>
                  {success}
                </div>
              )}

              {/* Actions */}
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button
                  onClick={onClose}
                  style={{ padding: "9px 18px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 500 }}
                >
                  Batal
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  style={{ padding: "9px 18px", borderRadius: 8, border: "none", background: "#2563eb", color: "#fff", cursor: saving ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6, opacity: saving ? 0.7 : 1 }}
                >
                  {saving ? <><Loader2 size={14} className="spin" /> Menyimpan...</> : <><Save size={14} /> Simpan Perubahan</>}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminStudentsPage() {

  const { user, profile } = useAuth();
  const [students, setStudents] = useState<any[]>([]); // 1 halaman DashboardStudent dari server
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Search state
  const [searchInput, setSearchInput] = useState("");
  const [activeSearch, setActiveSearch] = useState("");

  // Server-side pagination
  const PAGE_SIZE = 20;
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filteredTotal, setFilteredTotal] = useState(0);

  // Ringkasan & opsi dropdown dari server
  const [channelSummary, setChannelSummary] = useState<Record<string, number>>({});
  const [detailChannelOptions, setDetailChannelOptions] = useState<Array<{ value: string; count: number }>>([]);

  // Filter tambahan
  const [filterDetailChannel, setFilterDetailChannel] = useState("all");
  const [filterKuisStatus, setFilterKuisStatus] = useState("all");
  const [filterProgress, setFilterProgress] = useState("all");
  const [sortUsia, setSortUsia] = useState("default");

  // State detail modal
  const [detailTarget, setDetailTarget] = useState<any | null>(null);
  // State progress modal
  const [progressTarget, setProgressTarget] = useState<any | null>(null);
  // State edit modal (nilai kuis)
  const [editTarget, setEditTarget] = useState<any | null>(null);
  // State edit identitas/profil peserta
  const [profileEditTarget, setProfileEditTarget] = useState<any | null>(null);

  // State untuk konfirmasi hapus
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);

  // ── Super Admin: pemilih mode Auto Complete (massal vs instant form) ──
  const [chooserOpen, setChooserOpen] = useState(false);

  // ── Super Admin: percepat penyelesaian SEMUA lead (abaikan batas 5 hari) ──
  const [forceAllOpen, setForceAllOpen] = useState(false);
  const [forceAllRunning, setForceAllRunning] = useState(false);
  const [forceAllDone, setForceAllDone] = useState(false);
  const [forceAllError, setForceAllError] = useState("");
  // total = jumlah lead pending; current = sudah diproses; completed/skipped/errors = ringkasan
  const [forceAllStats, setForceAllStats] = useState({ total: 0, current: 0, completed: 0, skipped: 0, errors: 0 });
  const [forceAllLog, setForceAllLog] = useState<string[]>([]);
  
  // State for date grouping
  const [dateGroups, setDateGroups] = useState<{ date: string, students: any[] }[]>([]);
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  
  // State for PDF Queue
  const [queueStatus, setQueueStatus] = useState<"idle" | "processing" | "done">("idle");
  const [queueProgress, setQueueProgress] = useState({ current: 0, total: 0, success: 0, fail: 0 });
  const [bulkError, setBulkError] = useState("");

  const openBulkModal = async () => {
    setSelectedDates([]);
    setQueueStatus("idle");
    setBulkError("");
    setDateGroups([]);
    setBulkConfirmOpen(true);
    // Ambil SEMUA siswa pending dari server (dikelompokkan per tanggal) — bukan
    // hanya 1 halaman, karena fitur Luluskan Massal butuh seluruh data pending.
    try {
      const token = await getToken();
      const res = await fetch("/api/admin/students/pending-groups", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Gagal memuat data pending.");
      const data = await res.json();
      setDateGroups((data.groups || []).map((g: any) => ({
        date: (g.date || "").split(" ")[0] || g.date,
        students: g.students || [],
      })));
    } catch (e: any) {
      setBulkError(e.message || "Gagal memuat data pending.");
    }
  };

  const toggleDate = (date: string) => {
    setSelectedDates(prev => prev.includes(date) ? prev.filter(d => d !== date) : [...prev, date]);
  };

  const toggleAllDates = () => {
    if (selectedDates.length === dateGroups.length) {
      setSelectedDates([]);
    } else {
      setSelectedDates(dateGroups.map(g => g.date));
    }
  };

  const handleBulkComplete = async () => {
    if (selectedDates.length === 0) {
      setBulkError("Pilih minimal 1 tanggal pendaftaran.");
      return;
    }

    setBulkLoading(true);
    setBulkError("");
    setQueueStatus("processing");
    
    // Kumpulkan semua UID yang dicentang
    const targetUids: string[] = [];
    dateGroups.forEach(g => {
      if (selectedDates.includes(g.date)) {
        g.students.forEach(s => targetUids.push(s.uid));
      }
    });

    setQueueProgress({ current: 0, total: targetUids.length, success: 0, fail: 0 });

    try {
      const token = await getToken();
      
      // 1. Tembak Database (Lulus Instan)
      const res = await fetch('/api/admin/students/bulk-force-complete', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: targetUids })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memanipulasi database kelulusan.");

      // 2. Tembak PDF secara bergiliran (Antrean Jeda 3 Detik)
      let successes = 0;
      let fails = 0;
      for (let i = 0; i < targetUids.length; i++) {
        setQueueProgress(prev => ({ ...prev, current: i + 1 }));
        try {
          const pdfRes = await fetch('/api/admin/students/generate-pdf', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ userId: targetUids[i] })
          });
          if (pdfRes.ok) successes++; else fails++;
        } catch (e) {
          fails++;
        }
        // Jeda mendinginkan server Google (1 detik)
        if (i < targetUids.length - 1) {
          await new Promise(r => setTimeout(r, 1000));
        }
      }

      setQueueProgress(prev => ({ ...prev, success: successes, fail: fails }));
      setQueueStatus("done");

      // Refresh layar — ambil data terbaru (bypass cache server)
      fetchPage({ refresh: true });
    } catch (e: any) {
      setBulkError(e.message);
      setQueueStatus("idle");
    } finally {
      setBulkLoading(false);
    }
  };

  const getToken = useCallback(async () => {
    if (!user) return "";
    try { return await (user as any).getIdToken(); } catch { return ""; }
  }, [user]);

  // Helper: POST ke endpoint force-complete + parse JSON dengan aman.
  // Kalau server balas HTML (mis. error 500/timeout), lempar pesan yang jelas
  // alih-alih "Unexpected token '<'".
  const callForceComplete = async (token: string, payload: Record<string, unknown>) => {
    const res = await fetch("/api/admin/leads/force-complete-all", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    let data: any = null;
    try { data = text ? JSON.parse(text) : null; } catch {
      throw new Error(`Server membalas non-JSON (HTTP ${res.status}). Coba lagi.`);
    }
    if (!res.ok) throw new Error(data?.error || `Gagal (HTTP ${res.status}).`);
    return data;
  };

  // Super Admin: proses semua lead Instant Form TANPA menunggu 5 hari.
  // Strategi: ambil daftar lead pending dulu (action:list), lalu proses SATU
  // per SATU (action:process) supaya tiap request cepat & tidak timeout, dan
  // progress bisa ditampilkan akurat (X dari N).
  const runForceCompleteAll = async () => {
    setForceAllRunning(true);
    setForceAllDone(false);
    setForceAllError("");
    setForceAllLog([]);
    setForceAllStats({ total: 0, current: 0, completed: 0, skipped: 0, errors: 0 });

    let completed = 0, skipped = 0, errors = 0;
    try {
      const token = await getToken();

      // 1) Ambil daftar pending.
      const list = await callForceComplete(token, { action: "list" });
      const pending: string[] = list.pending || [];
      setForceAllStats((s) => ({ ...s, total: pending.length }));

      if (pending.length === 0) {
        setForceAllDone(true);
        return;
      }

      // 2) Proses satu per satu.
      for (let i = 0; i < pending.length; i++) {
        const email = pending[i];
        try {
          const out = await callForceComplete(token, { action: "process", email });
          const st = out?.result?.status;
          if (st === "completed") completed++;
          else if (st === "skipped") skipped++;
          else errors++;
          setForceAllLog((prev) => [
            `${st === "completed" ? "✓" : st === "skipped" ? "–" : "✗"} ${email}${out?.result?.reason ? ` (${out.result.reason})` : ""}`,
            ...prev,
          ].slice(0, 50));
        } catch (e: any) {
          errors++;
          setForceAllLog((prev) => [`✗ ${email} (${e.message})`, ...prev].slice(0, 50));
        }
        setForceAllStats({ total: pending.length, current: i + 1, completed, skipped, errors });
        // Jeda kecil agar tidak membanjiri GAS/server.
        await new Promise((r) => setTimeout(r, 300));
      }

      setForceAllDone(true);
      fetchPage({ refresh: true });
    } catch (e: any) {
      setForceAllError(e.message || "Terjadi kesalahan.");
    } finally {
      setForceAllRunning(false);
    }
  };

  // Ambil 1 halaman dari server (filter/search/sort/paginate dilakukan server).
  // refresh=true → bypass cache server (data terbaru). Default: SWR (cepat).
  const fetchPage = useCallback(async (opts?: { refresh?: boolean; silent?: boolean; signal?: AbortSignal }) => {
    if (opts?.refresh) setRefreshing(true);
    else if (!opts?.silent) setLoading(true);
    try {
      const token = await getToken();
      if (!token) return;

      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
        channel: filter,
        detailChannel: filterDetailChannel,
        statusKuis: filterKuisStatus,
        status: filterProgress,
        search: activeSearch,
        sortUsia,
      });
      if (opts?.refresh) params.set("refresh", "1");

      const res = await fetch(`/api/admin/students/list?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
        signal: opts?.signal,
      });
      if (res.ok) {
        const data = await res.json();
        setStudents(data.students || []);
        setTotalPages(data.totalPages || 1);
        setFilteredTotal(data.filteredTotal || 0);
        setChannelSummary(data.channelSummary || {});
        setDetailChannelOptions(data.detailChannelOptions || []);
        // Jika halaman aktif melewati total (mis. setelah filter), mundurkan.
        if (data.page && data.page !== page) setPage(data.page);
      } else if (!opts?.silent) {
        const err = await res.text();
        console.error("API Error:", res.status, err);
        alert(`Gagal memuat data (Status ${res.status}): ${err}`);
      }
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      if (!opts?.silent) {
        console.error("Fetch error:", e);
        alert(`Terjadi kesalahan saat memuat data: ${e.message}`);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getToken, page, filter, filterDetailChannel, filterKuisStatus, filterProgress, activeSearch, sortUsia]);

  // Re-fetch tiap kali filter/halaman/sort/search berubah. AbortController cegah race.
  useEffect(() => {
    const ctrl = new AbortController();
    fetchPage({ signal: ctrl.signal });
    return () => ctrl.abort();
  }, [fetchPage]);

  // Auto background refresh tiap 60 dtk (tanpa bypass — manfaatkan SWR server).
  useEffect(() => {
    const id = setInterval(() => fetchPage({ silent: true }), 60_000);
    return () => clearInterval(id);
  }, [fetchPage]);

  // Debounce search → set activeSearch + reset halaman setelah user berhenti mengetik.
  useEffect(() => {
    const t = setTimeout(() => {
      const q = searchInput.trim();
      setActiveSearch((prev) => {
        if (prev !== q) { setPage(1); return q; }
        return prev;
      });
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Tombol Refresh manual — ambil data terbaru (bypass cache server).
  const handleRefresh = () => fetchPage({ refresh: true });

  // Server sudah mengirim 1 halaman terfilter & terurut.
  const slice = students;
  const detailChannelCounts: Record<string, number> = Object.fromEntries(
    detailChannelOptions.map((o) => [o.value, o.count])
  );
  const uniqueDetailChannels = detailChannelOptions.map((o) => o.value);

  // Enter di search box → langsung terapkan (tanpa tunggu debounce).
  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    setActiveSearch(searchInput.trim());
    setPage(1);
  };

  // Clear search
  const handleClearSearch = () => {
    setSearchInput(""); setActiveSearch("");
    setPage(1);
  };

  const resetSubFilters = () => {
    setFilterDetailChannel("all");
    setFilterKuisStatus("all");
    setFilterProgress("all");
    setSortUsia("default");
  };

  const handleFilterChange = (newFilter: string) => {
    setFilter(newFilter);
    setSearchInput(""); setActiveSearch("");
    resetSubFilters();
    setPage(1);
  };

  const handleNext = () => {
    if (page < totalPages) setPage(p => p + 1);
  };

  const handlePrev = () => {
    if (page > 1) setPage(p => p - 1);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget?.uid) return;
    setDeleting(true);
    setDeleteError("");
    try {
      const token = await getToken();
      const res = await fetch(`/api/users/${deleteTarget.uid}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Gagal menghapus akun");
      }
      // Hapus dari state lokal
      setStudents(prev => prev.filter(s => s.uid !== deleteTarget.uid));
      setDeleteTarget(null);
    } catch (e: any) {
      setDeleteError(e.message || "Terjadi kesalahan");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <ProtectedRoute requireAdmin>
      <div className={styles.page}>
        <header className={styles.header}>
          <div>
            <h1 className={styles.title}>Data Siswa</h1>
            <p className={styles.subtitle}>Pantau pendaftaran dan progress belajar siswa.</p>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <button
              onClick={handleRefresh}
              disabled={refreshing || loading}
              title="Ambil data terbaru"
              style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#fff", color: "#475569", border: "1px solid #cbd5e1", padding: "8px 16px", borderRadius: "8px", cursor: refreshing ? "wait" : "pointer", fontWeight: 500 }}
            >
              <Loader2 size={15} className={refreshing ? "animate-spin" : ""} /> {refreshing ? "Menyegarkan..." : "Refresh"}
            </button>
            {!(profile?.role || "").toLowerCase().includes("public") && (
              <>
                <a 
                  href="/admin/students/fix-names"
                  target="_blank"
                  style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#fff", color: "#475569", border: "1px solid #cbd5e1", padding: "8px 16px", borderRadius: "8px", cursor: "pointer", fontWeight: 500, textDecoration: "none" }}
                >
                  <UserX size={15} /> Auto Deteksi Nama Aneh
                </a>
                <button
                  onClick={() => setChooserOpen(true)}
                  className="btn btn-secondary"
                  style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", padding: "8px 16px", borderRadius: "8px", cursor: "pointer", fontWeight: 500 }}
                >
                  <CheckCircle2 size={15} /> Auto Complete
                </button>
              </>
            )}
            <button className="btn btn-primary" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <Download size={15} /> Export ke Excel
            </button>
          </div>
        </header>

        {/* Ringkasan Channel Pendaftar */}
        <div style={{ display: "flex", gap: "16px", marginBottom: "24px", flexWrap: "wrap" }}>
          {["Umum", "Kemitraan", "Beasiswa", "Workshop"].map(ch => {
            const count = channelSummary[ch.toLowerCase()] || 0;
            return (
              <div key={ch} style={{ background: "#fff", padding: "16px 20px", borderRadius: "12px", border: "1px solid #e2e8f0", flex: "1 1 200px", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
                <div style={{ fontSize: "14px", color: "#64748b", marginBottom: "6px", fontWeight: 500 }}>{ch}</div>
                <div style={{ fontSize: "24px", fontWeight: "bold", color: "#0f172a" }}>{count}</div>
              </div>
            );
          })}
        </div>

        <div className={styles.filterBar}>
          <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center", flexWrap: "wrap" }}>
            <button className={`${styles.filterBtn} ${filter === "all" ? styles.active : ""}`} onClick={() => handleFilterChange("all")}>Semua Siswa</button>
            <button className={`${styles.filterBtn} ${filter === "umum" ? styles.active : ""}`} onClick={() => handleFilterChange("umum")}>Umum</button>
            <button className={`${styles.filterBtn} ${filter === "kemitraan" ? styles.active : ""}`} onClick={() => handleFilterChange("kemitraan")}>Kemitraan</button>
            <button className={`${styles.filterBtn} ${filter === "beasiswa" ? styles.active : ""}`} onClick={() => handleFilterChange("beasiswa")}>Beasiswa</button>
            <button className={`${styles.filterBtn} ${filter === "workshop" ? styles.active : ""}`} onClick={() => handleFilterChange("workshop")}>Workshop</button>
          </div>
          <div className={styles.searchWrap}>
            <Search size={15} className={styles.searchIcon} />
            <input
              className={styles.searchInput}
              type="text"
              placeholder="Cari nama, email, kode mitra... (Enter)"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={handleSearch}
            />
            {(searchInput || activeSearch) && (
              <button className={styles.searchClear} onClick={handleClearSearch} title="Hapus pencarian">
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Filter Tambahan Dropdowns */}
        <div style={{ display: "flex", gap: "12px", marginBottom: "20px", flexWrap: "wrap", alignItems: "center" }}>
          <select 
            value={filterDetailChannel} 
            onChange={(e) => { setFilterDetailChannel(e.target.value); setPage(1); }}
            style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px", color: "#334155", background: "#fff", cursor: "pointer", minWidth: "200px" }}
          >
            <option value="all">Semua Detail Channel</option>
            {uniqueDetailChannels.map(dc => (
              <option key={dc} value={dc}>{dc} ({detailChannelCounts[dc]} peserta)</option>
            ))}
          </select>

          <select 
            value={filterKuisStatus} 
            onChange={(e) => { setFilterKuisStatus(e.target.value); setPage(1); }}
            style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px", color: "#334155", background: "#fff", cursor: "pointer", minWidth: "160px" }}
          >
            <option value="all">Semua Status Kuis</option>
            <option value="LULUS">LULUS</option>
            <option value="TIDAK LULUS">TIDAK LULUS</option>
            <option value="Belum">Belum Mengerjakan</option>
          </select>

          <select 
            value={filterProgress} 
            onChange={(e) => { setFilterProgress(e.target.value); setPage(1); }}
            style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px", color: "#334155", background: "#fff", cursor: "pointer", minWidth: "160px" }}
          >
            <option value="all">Semua Progress</option>
            <option value="Tersertifikasi">Tersertifikasi</option>
            <option value="Selesai">Selesai (Belum Klaim)</option>
            <option value="Sedang Belajar">Sedang Belajar</option>
            <option value="Belum Mulai">Belum Mulai</option>
          </select>
          
          <div style={{ width: "1px", height: "24px", background: "#cbd5e1", margin: "0 4px" }} />

          <select 
            value={sortUsia} 
            onChange={(e) => { setSortUsia(e.target.value); setPage(1); }}
            style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px", color: "#334155", background: "#f8fafc", cursor: "pointer", minWidth: "140px", fontWeight: 500 }}
          >
            <option value="default">Urutkan Usia</option>
            <option value="Termuda">Termuda - Tertua</option>
            <option value="Tertua">Tertua - Termuda</option>
          </select>
        </div>

        <div className={styles.tableCard}>
        <div className={styles.tableContainer} style={{ overflowX: 'auto' }}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Tanggal Daftar</th>
                <th>Channel</th>
                <th>Detail</th>
                <th>Email</th>
                <th>Nama</th>
                <th>Gender</th>
                <th>Umur</th>
                <th>Kota</th>
                <th>Disabilitas</th>
                <th>Minat</th>
                <th>Status</th>
                <th>Status Kuis</th>
                <th>Nilai Quiz</th>
                <th>Survei 1</th>
                <th>Survei 2</th>
                <th>Sertifikat</th>
                <th className={styles.actionsCell} style={{ position: 'sticky', right: 0, background: '#f9fafb', zIndex: 10 }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {slice.map((s) => (
                <tr
                  key={s.uid}
                  className={styles.clickableRow}
                  onClick={() => setDetailTarget(s)}
                >
                  <td className={styles.textSm}>{s.tanggalDaftar}</td>
                  <td><span className={styles.channelBadge}>{channelLabel(s.channelSource || s.channel?.toLowerCase())}</span></td>
                  <td className={styles.textSm}>{s.detailChannel}</td>
                  <td className={styles.textSm}>{s.email}</td>
                  <td className={styles.fw500}>{s.namaLengkap}</td>
                  <td className={styles.textSm}>{s.jenisKelamin}</td>
                  <td className={styles.textSm}>{s.umur}</td>
                  <td className={styles.textSm}>{s.kota}</td>
                  <td className={styles.textSm}>{s.disabilitas}</td>
                  <td className={styles.textSm}>{s.minat}</td>
                  <td>
                    <span className={`${styles.statusBadge} ${s.status === 'Selesai' || s.status === 'Tersertifikasi' ? styles.complete : styles.incomplete}`}>
                      {s.status}
                    </span>
                  </td>
                  <td>
                    {s.statusKuis === 'LULUS' ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>✓ LULUS</span>
                    ) : s.statusKuis === 'TIDAK LULUS' ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>✕ TIDAK LULUS</span>
                    ) : (
                      <span style={{ color: '#94a3b8', fontSize: 11 }}>—</span>
                    )}
                  </td>
                  <td className={styles.textSm}>{s.nilaiQuiz}</td>
                  <td className={styles.textSm}>{s.nilaiSurvei1}</td>
                  <td className={styles.textSm}>{s.nilaiSurvei2}</td>
                  <td className={styles.textSm}>
                    {s.linkSertifikat ? <a href={s.linkSertifikat} target="_blank" rel="noopener noreferrer" style={{color: '#2563eb', textDecoration: 'underline'}}>Lihat</a> : "-"}
                  </td>
                  <td className={styles.actionsCell} onClick={(e) => e.stopPropagation()} style={{ position: 'sticky', right: 0, background: 'inherit', zIndex: 10 }}>
                    <button
                      className={styles.iconBtn}
                      title="Lihat Progress"
                      onClick={(e) => { e.stopPropagation(); setProgressTarget(s); }}
                    >
                      <BarChart2 size={15} />
                    </button>
                    <button
                      className={styles.iconBtn}
                      title="Detail Siswa"
                      onClick={(e) => { e.stopPropagation(); setDetailTarget(s); }}
                    >
                      <Eye size={15} />
                    </button>
                    {!(profile?.role || "").toLowerCase().includes("public") && (
                      <>
                        <button
                          className={styles.iconBtn}
                          title="Edit Identitas Peserta"
                          style={{ color: "#7c3aed" }}
                          onClick={(e) => { e.stopPropagation(); setProfileEditTarget(s); }}
                        >
                          <CircleUserRound size={15} />
                        </button>
                        <button
                          className={styles.iconBtn}
                          title="Edit Nilai / Progress"
                          style={{ color: "#2563eb" }}
                          onClick={(e) => { e.stopPropagation(); setEditTarget(s); }}
                        >
                          <Pencil size={15} />
                        </button>
                      </>
                    )}
                    <button
                      className={`${styles.iconBtn} ${styles.deleteBtn}`}
                      title="Hapus Akun Siswa"
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget(s); setDeleteError(""); }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
              {loading ? (
                <tr><td colSpan={15} className={styles.emptyState}>Memuat data siswa...</td></tr>
              ) : slice.length === 0 ? (
                <tr><td colSpan={15} className={styles.emptyState}>
                  {activeSearch ? `Tidak ada siswa yang cocok dengan "${activeSearch}".` : "Tidak ada data siswa ditemukan."}
                </td></tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className={styles.pagination}>
          <span className={styles.paginationInfo}>
            Halaman {page} dari {totalPages} &bull; {filteredTotal} siswa cocok &bull; menampilkan {slice.length}
            {activeSearch && <> (hasil pencarian: <strong>{activeSearch}</strong>)</>}
          </span>
          <div className={styles.paginationBtns}>
            <button className={styles.pageBtn} onClick={handlePrev} disabled={page <= 1 || loading}>
              <ChevronLeft size={15} /> Sebelumnya
            </button>
            <span className={styles.pageNum}>{page}</span>
            <button className={styles.pageBtn} onClick={handleNext} disabled={page >= totalPages || loading}>
              Berikutnya <ChevronRight size={15} />
            </button>
          </div>
        </div>
        </div> {/* /tableCard */}
      </div>

      {/* Detail Siswa Modal */}
      <StudentDetailModal student={detailTarget} onClose={() => setDetailTarget(null)} />

      {/* Progress Siswa Modal */}
      <ProgressModal student={progressTarget} onClose={() => setProgressTarget(null)} getToken={getToken} />

      {/* Edit Data Siswa Modal */}
      <StudentEditModal
        student={editTarget}
        onClose={() => setEditTarget(null)}
        getToken={getToken}
        onSaved={(updated) => {
          setStudents(prev => prev.map(s => {
            if (s.uid === updated.uid) {
              return { 
                ...s, 
                nilaiQuiz: String(updated.newScore),
                statusKuis: updated.newScore >= 60 ? "LULUS" : "TIDAK LULUS"
              };
            }
            return s;
          }));
          setEditTarget(null);
        }}
      />

      {/* Edit Identitas Peserta Modal */}
      <StudentProfileEditModal
        student={profileEditTarget}
        onClose={() => setProfileEditTarget(null)}
        getToken={getToken}
        onSaved={(updated) => {
          setStudents(prev => prev.map(s => {
            if (s.uid === updated.uid) {
              return {
                ...s,
                namaLengkap: updated.namaLengkap,
                displayName: updated.namaLengkap,
                jenisKelamin: updated.jenisKelamin || s.jenisKelamin,
                kota: updated.asalDaerah || s.kota,
                ...(updated.newCertUrl ? { linkSertifikat: updated.newCertUrl } : {}),
              } as any;
            }
            return s;
          }));
          setProfileEditTarget(null);
        }}
      />

      {/* Dialog Konfirmasi Hapus */}
      {deleteTarget && (
        <div className={styles.modalOverlay} onClick={() => !deleting && setDeleteTarget(null)}>
          <div className={styles.confirmModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.confirmIcon}>
              <Trash2 size={36} color="#dc2626" />
            </div>
            <h2 className={styles.confirmTitle}>Hapus Akun Siswa?</h2>
            <p className={styles.confirmDesc}>
              Kamu akan menghapus akun <strong>{deleteTarget.namaLengkap || deleteTarget.email}</strong> secara permanen.
              <br /><br />
              Tindakan ini akan menghapus:
            </p>
            <ul className={styles.confirmList}>
              <li>Akun Google (Firebase Authentication)</li>
              <li>Data profil siswa</li>
              <li>Riwayat enrollment &amp; progress belajar</li>
              <li>Data sertifikat (jika ada)</li>
            </ul>
            <p className={styles.confirmWarning}>Tindakan ini tidak bisa dibatalkan!</p>

            {deleteError && (
              <div className={styles.deleteError}>{deleteError}</div>
            )}

            <div className={styles.confirmActions}>
               <button className={styles.cancelBtn} onClick={() => setDeleteTarget(null)} disabled={deleting}>
                Batal
              </button>
              <button className={styles.confirmDeleteBtn} onClick={handleDeleteConfirm} disabled={deleting}>
                {deleting ? (
                  <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Menghapus...</>
                ) : (
                  <><Trash2 size={14} /> Ya, Hapus Permanen</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Bulk Complete Modal */}
      {bulkConfirmOpen && (
        <div className={styles.modalOverlay} onClick={() => !bulkLoading && setBulkConfirmOpen(false)}>
          <div className={styles.confirmModal} style={{ width: 500, maxWidth: '90%' }} onClick={(e) => e.stopPropagation()}>
            <div className={styles.confirmIcon} style={{ background: "#fef2f2" }}>
              <CheckCircle2 size={36} color="#dc2626" />
            </div>
            <h2 className={styles.confirmTitle}>Luluskan Peserta (Massal)</h2>
            
            {queueStatus === "done" ? (
              <div style={{ textAlign: "center", padding: "16px 0" }}>
                <div style={{ color: "#16a34a", fontSize: 16, fontWeight: "bold", marginBottom: 8 }}>Selesai Diproses!</div>
                <p style={{ fontSize: 14, color: "#64748b", marginBottom: 16 }}>
                  Berhasil meluluskan {queueProgress.total} peserta.<br/>
                  PDF Sukses: {queueProgress.success} | Gagal: {queueProgress.fail}
                </p>
                <button className="btn btn-primary" onClick={() => setBulkConfirmOpen(false)}>
                  Tutup
                </button>
              </div>
            ) : queueStatus === "processing" ? (
              <div style={{ textAlign: "center", padding: "16px 0" }}>
                <div style={{ color: "#2563eb", fontSize: 16, fontWeight: "bold", marginBottom: 8 }}>Sedang Memproses...</div>
                <p style={{ fontSize: 13, color: "#64748b", marginBottom: 12 }}>
                  Tolong jangan tutup halaman ini agar Antrean PDF tidak terputus.
                </p>
                <div style={{ width: "100%", background: "#e2e8f0", borderRadius: 99, height: 8, marginBottom: 8, overflow: "hidden" }}>
                  <div style={{ background: "#2563eb", height: "100%", width: `${(queueProgress.current / queueProgress.total) * 100}%`, transition: "width 0.3s" }}></div>
                </div>
                <div style={{ fontSize: 12, color: "#333", fontWeight: 600 }}>
                  Membuat PDF Sertifikat: {queueProgress.current} dari {queueProgress.total}
                </div>
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
                  (Jeda aman server: 1 detik/orang)
                </div>
              </div>
            ) : (
              <>
                <p className={styles.confirmDesc} style={{ textAlign: "left", marginBottom: 12 }}>
                  Pilih kelompok siswa berdasarkan <strong>Tanggal Pendaftaran</strong> yang ingin diluluskan secara instan:
                </p>

                {dateGroups.length === 0 ? (
                  <div style={{ padding: 16, background: "#f8fafc", borderRadius: 8, color: "#64748b", textAlign: "center", marginBottom: 16 }}>
                    Semua siswa terdaftar sudah memiliki sertifikat. Hore!
                  </div>
                ) : (
                  <div style={{ maxHeight: 320, overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: 10, marginBottom: 16, padding: "8px 0", background: "#fff" }}>
                    <div 
                      style={{ padding: "8px 16px", cursor: "pointer", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: 8, fontWeight: 600 }}
                      onClick={toggleAllDates}
                    >
                      <input type="checkbox" checked={selectedDates.length === dateGroups.length} readOnly />
                      Pilih Semua Tanggal
                    </div>
                    {dateGroups.map(g => (
                      <div 
                        key={g.date} 
                        style={{ padding: "8px 16px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "flex-start", gap: 8, fontSize: 14 }}
                      >
                        <input 
                          type="checkbox" 
                          checked={selectedDates.includes(g.date)} 
                          onChange={() => toggleDate(g.date)} 
                          style={{ marginTop: 4, cursor: "pointer" }}
                        />
                        <details style={{ flex: 1 }}>
                          <summary style={{ cursor: "pointer", outline: "none", fontWeight: 600, color: "#1e293b", userSelect: "none" }}>
                            Tanggal {g.date} <span style={{ fontWeight: 400, color: "#64748b", fontSize: 13 }}>({g.students.length} peserta)</span>
                          </summary>
                          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8, paddingRight: 4, paddingBottom: 8 }}>
                            {g.students.map((s: any) => {
                              const initial = (s.namaLengkap || s.email || "?").charAt(0).toUpperCase();
                              return (
                                <div key={s.uid} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, transition: "all 0.2s" }}>
                                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg, #3b82f6, #2563eb)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: "bold", flexShrink: 0, boxShadow: "0 2px 4px rgba(37,99,235,0.2)" }}>
                                    {initial}
                                  </div>
                                  <div style={{ flex: 1, overflow: "hidden" }}>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                      {s.namaLengkap || "Tanpa Nama"}
                                    </div>
                                    <div style={{ fontSize: 12, color: "#64748b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                      {s.email}
                                    </div>
                                  </div>
                                  <div style={{ padding: "4px 10px", borderRadius: 99, fontSize: 11, fontWeight: 600, background: s.status === "Selesai" ? "#dcfce7" : "#f1f5f9", color: s.status === "Selesai" ? "#166534" : "#475569", border: `1px solid ${s.status === "Selesai" ? "#bbf7d0" : "#e2e8f0"}` }}>
                                    {s.status}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </details>
                      </div>
                    ))}
                  </div>
                )}

                {bulkError && (
                  <div className={styles.deleteError}>{bulkError}</div>
                )}

                <div className={styles.confirmActions}>
                  <button className={styles.cancelBtn} onClick={() => setBulkConfirmOpen(false)} disabled={bulkLoading}>
                    Batal
                  </button>
                  <button className={styles.confirmDeleteBtn} onClick={handleBulkComplete} disabled={bulkLoading || dateGroups.length === 0}>
                    <CheckCircle2 size={14} /> Eksekusi & Cetak PDF
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Auto Complete: pemilih mode (massal vs instant form) */}
      {chooserOpen && (
        <div className={styles.modalOverlay} onClick={() => setChooserOpen(false)}>
          <div className={styles.confirmModal} style={{ width: 520, maxWidth: "92%" }} onClick={(e) => e.stopPropagation()}>
            <div className={styles.confirmIcon} style={{ background: "#fef2f2" }}>
              <CheckCircle2 size={36} color="#dc2626" />
            </div>
            <h2 className={styles.confirmTitle}>Auto Complete</h2>
            <p className={styles.confirmDesc} style={{ textAlign: "center", marginBottom: 16 }}>
              Pilih cara meluluskan peserta secara otomatis:
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Mode 1: Massal per tanggal */}
              <button
                onClick={() => { setChooserOpen(false); openBulkModal(); }}
                style={{ textAlign: "left", display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 16px", border: "1px solid #e2e8f0", borderRadius: 12, background: "#fff", cursor: "pointer" }}
              >
                <CheckCircle2 size={22} color="#dc2626" style={{ flexShrink: 0, marginTop: 2 }} />
                <span>
                  <span style={{ display: "block", fontWeight: 700, color: "#0f172a", marginBottom: 2 }}>Massal (per Tanggal Pendaftaran)</span>
                  <span style={{ fontSize: 13, color: "#64748b" }}>
                    Luluskan siswa yang sudah terdaftar (punya akun) berdasarkan tanggal daftar, lalu cetak PDF sertifikat.
                  </span>
                </span>
              </button>

              {/* Mode 2: Instant Form (Super Admin) */}
              {profile?.isSuperAdmin && (
                <button
                  onClick={() => { setChooserOpen(false); setForceAllDone(false); setForceAllError(""); setForceAllLog([]); setForceAllStats({ total: 0, current: 0, completed: 0, skipped: 0, errors: 0 }); setForceAllOpen(true); }}
                  style={{ textAlign: "left", display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 16px", border: "1px solid #1e293b", borderRadius: 12, background: "#1e293b", color: "#fff", cursor: "pointer" }}
                >
                  <Clock size={22} color="#fff" style={{ flexShrink: 0, marginTop: 2 }} />
                  <span>
                    <span style={{ display: "block", fontWeight: 700, marginBottom: 2 }}>Dari Facebook Instant Form (tanpa tunggu 5 hari)</span>
                    <span style={{ fontSize: 13, color: "#cbd5e1" }}>
                      Proses lead Instant Form yang belum jadi siswa: buat akun, isi kuis &amp; survei, klaim sertifikat. Kategori beasiswa diacak. <strong style={{ color: "#fca5a5" }}>Super Admin.</strong>
                    </span>
                  </span>
                </button>
              )}
            </div>

            <div className={styles.confirmActions} style={{ marginTop: 16 }}>
              <button className={styles.cancelBtn} onClick={() => setChooserOpen(false)}>Batal</button>
            </div>
          </div>
        </div>
      )}

      {/* Super Admin: Auto Complete Instant Form (abaikan batas 5 hari) */}
      {forceAllOpen && (
        <div className={styles.modalOverlay} onClick={() => !forceAllRunning && setForceAllOpen(false)}>
          <div className={styles.confirmModal} style={{ width: 480, maxWidth: "90%" }} onClick={(e) => e.stopPropagation()}>
            <div className={styles.confirmIcon} style={{ background: "#eef2ff" }}>
              <Clock size={36} color="#1e293b" />
            </div>
            <h2 className={styles.confirmTitle}>Auto Complete — Instant Form</h2>

            {forceAllDone ? (
              <div style={{ textAlign: "center", padding: "8px 0" }}>
                <div style={{ color: "#16a34a", fontSize: 16, fontWeight: "bold", marginBottom: 8 }}>Selesai!</div>
                <p style={{ fontSize: 14, color: "#64748b", marginBottom: 16 }}>
                  {forceAllStats.total === 0
                    ? "Tidak ada lead Instant Form yang perlu diproses."
                    : <>Diselesaikan: <strong>{forceAllStats.completed}</strong> &middot; Dilewati: {forceAllStats.skipped} &middot; Gagal: {forceAllStats.errors}</>}
                </p>
                <button className="btn btn-primary" onClick={() => setForceAllOpen(false)}>Tutup</button>
              </div>
            ) : forceAllRunning ? (
              <div style={{ padding: "4px 0" }}>
                <div style={{ textAlign: "center", color: "#2563eb", fontSize: 15, fontWeight: "bold", marginBottom: 8, display: "inline-flex", alignItems: "center", gap: 8, width: "100%", justifyContent: "center" }}>
                  <Loader2 size={18} className="animate-spin" /> Memproses {forceAllStats.current} dari {forceAllStats.total}
                </div>
                {/* Progress bar */}
                <div style={{ width: "100%", background: "#e2e8f0", borderRadius: 99, height: 10, margin: "8px 0", overflow: "hidden" }}>
                  <div style={{ background: "#2563eb", height: "100%", width: `${forceAllStats.total ? (forceAllStats.current / forceAllStats.total) * 100 : 0}%`, transition: "width 0.3s" }} />
                </div>
                <div style={{ fontSize: 12, color: "#475569", textAlign: "center", marginBottom: 8 }}>
                  ✓ {forceAllStats.completed} &nbsp; – {forceAllStats.skipped} &nbsp; ✗ {forceAllStats.errors}
                </div>
                <p style={{ fontSize: 12, color: "#94a3b8", textAlign: "center", marginBottom: 8 }}>
                  Jangan tutup halaman ini sampai selesai.
                </p>
                {forceAllLog.length > 0 && (
                  <div style={{ maxHeight: 140, overflowY: "auto", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 10px", fontSize: 12, fontFamily: "monospace", color: "#334155" }}>
                    {forceAllLog.map((line, i) => (
                      <div key={i} style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{line}</div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <>
                <p className={styles.confirmDesc} style={{ textAlign: "left", marginBottom: 12 }}>
                  Memproses <strong>lead Instant Form yang belum verifikasi</strong> (belum jadi
                  siswa) — <strong>tanpa menunggu batas 5 hari</strong>. Untuk tiap peserta:
                  dibuatkan akun, diisi kuis &amp; survei, lalu diklaimkan sertifikat (tanpa kirim
                  email). Kategori beasiswa di-acak otomatis.
                  <br /><br />
                  <span style={{ fontSize: 12, color: "#94a3b8" }}>
                    Peserta yang sudah verifikasi tapi belum selesai → pakai menu <strong>Massal</strong>.
                  </span>
                </p>

                {forceAllError && <div className={styles.deleteError}>{forceAllError}</div>}
                <div className={styles.confirmActions}>
                  <button className={styles.cancelBtn} onClick={() => setForceAllOpen(false)}>Batal</button>
                  <button className={styles.confirmDeleteBtn} style={{ background: "#1e293b" }} onClick={runForceCompleteAll}>
                    <Clock size={14} /> Jalankan Sekarang
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </ProtectedRoute>
  );
}