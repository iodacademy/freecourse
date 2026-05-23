"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import ProtectedRoute from "@/components/ProtectedRoute";
import styles from "./page.module.css";
import type { UserProfile } from "@/lib/types";
import { useAuth } from "@/contexts/AuthContext";
import {
  Trash2, X, User, Mail, Phone, MapPin, CalendarDays, Venus, Mars,
  CircleUserRound, Building2, Hash, Tag, Link2, CheckCircle2, XCircle,
  BarChart2, Eye, Download, BookOpen, Trophy, Clock, CheckSquare, Activity,
  BookMarked, Loader2, AlertCircle, Search, ChevronLeft, ChevronRight
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
  student: Partial<UserProfile> | null;
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

  const pd = student.profileData || {};
  const namaLengkap = student.displayName || "—";
  const email = student.email || "—";
  const photoURL = student.photoURL || null;
  const initials = namaLengkap.split(" ").slice(0, 2).map((w: string) => w[0] || "").join("").toUpperCase();

  const jenisKelamin = pd.jenis_kelamin || "—";
  const tanggalLahir = (Array.isArray(pd.tanggal_lahir) ? pd.tanggal_lahir[0] : pd.tanggal_lahir) || "";
  const whatsapp = pd.nomor_whatsapp || "—";
  const asalDaerah = typeof pd.asal_daerah === "object" && pd.asal_daerah !== null ? pd.asal_daerah as { province?: string; city?: string } : null;
  const provinsi = asalDaerah?.province || (typeof pd.asal_daerah === "string" ? pd.asal_daerah : "—");
  const kota = asalDaerah?.city || "—";
  const disabilitas = pd.disabilitas || "—";
  const channelSource = student.channelSource;
  const partnerCode = student.partnerCode || null;
  const eventId = student.eventId || null;
  const createdAt = student.createdAt ? new Date(student.createdAt as any).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "—";

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
            <InfoRow icon={CalendarDays} label="Tanggal Lahir" value={getAge(tanggalLahir)} />
            <InfoRow icon={Phone} label="Nomor WhatsApp" value={whatsapp} />
          </div>

          {/* Asal Daerah */}
          <div className={styles.detailSection}>
            <div className={styles.detailSectionTitle}>
              <MapPin size={14} /> Asal Daerah
            </div>
            <InfoRow icon={MapPin} label="Provinsi" value={provinsi} />
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

          {/* Channel Pendaftaran */}
          <div className={styles.detailSection}>
            <div className={styles.detailSectionTitle}>
              <Link2 size={14} /> Channel Pendaftaran
            </div>
            <InfoRow icon={Tag} label="Channel" value={channelLabel(channelSource)} />
            {partnerCode && <InfoRow icon={Building2} label="Kode Mitra" value={
              <code style={{ background: "#FFF5F5", padding: "2px 8px", borderRadius: 4, color: "#CC0000", fontWeight: 700, letterSpacing: 1 }}>{partnerCode}</code>
            } />}
            {eventId && <InfoRow icon={Hash} label="Event ID" value={
              <code style={{ background: "#f5f5f5", padding: "2px 8px", borderRadius: 4, color: "#525252", fontWeight: 600 }}>{eventId}</code>
            } />}
          </div>

          {/* Status Profil */}
          <div className={styles.detailSection}>
            <div className={styles.detailSectionTitle}>
              <BarChart2 size={14} /> Status Akun
            </div>
            <InfoRow
              icon={student.profileCompleted ? CheckCircle2 : XCircle}
              label="Status Profil"
              value={student.profileCompleted
                ? <span style={{ color: "#16a34a", fontWeight: 600 }}>Profil Lengkap</span>
                : <span style={{ color: "#f59e0b", fontWeight: 600 }}>Belum Lengkap</span>
              }
            />
            <InfoRow icon={CalendarDays} label="Tanggal Daftar" value={createdAt} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminStudentsPage() {
  const { user } = useAuth();
  const [students, setStudents] = useState<Partial<UserProfile>[]>([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  // Search state
  const [searchInput, setSearchInput] = useState("");
  const [activeSearch, setActiveSearch] = useState("");

  // Pagination cursor-based
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasNext, setHasNext] = useState(false);
  const [page, setPage] = useState(1);
  const [cursors, setCursors] = useState<string[]>([]);

  // State detail modal
  const [detailTarget, setDetailTarget] = useState<Partial<UserProfile> | null>(null);
  // State progress modal
  const [progressTarget, setProgressTarget] = useState<Partial<UserProfile> | null>(null);

  // State untuk konfirmasi hapus
  const [deleteTarget, setDeleteTarget] = useState<Partial<UserProfile> | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const getToken = useCallback(async () => {
    if (!user) return "";
    try { return await (user as any).getIdToken(); } catch { return ""; }
  }, [user]);

  const fetchUsers = useCallback(async (after?: string | null, search?: string, channel?: string) => {
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      const params = new URLSearchParams({ limit: "50" });
      if (after) params.set("after", after);
      if (search) params.set("search", search);
      if (channel && channel !== "all") params.set("channel", channel);

      const res = await fetch(`/api/users?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setStudents(data);
          setHasNext(false);
          setNextCursor(null);
        } else {
          setStudents(data.users || []);
          setHasNext(data.hasNext || false);
          setNextCursor(data.nextCursor || null);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    fetchUsers(null, "", "all");
  }, [fetchUsers]);

  // Filter lokal pada data yang sudah di-load
  const filteredStudents = students.filter((s) => {
    const matchChannel = filter === "all" || s.channelSource === filter;
    if (!activeSearch) return matchChannel;
    const q = activeSearch.toLowerCase();
    return matchChannel && (
      s.displayName?.toLowerCase().includes(q) ||
      s.email?.toLowerCase().includes(q) ||
      (s.partnerCode || "").toLowerCase().includes(q)
    );
  });

  // Enter di search box → cari lokal dulu, kalau tidak ada baru fetch server
  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    const q = searchInput.trim();
    setActiveSearch(q);
    if (q) {
      const found = students.some(s =>
        s.displayName?.toLowerCase().includes(q.toLowerCase()) ||
        s.email?.toLowerCase().includes(q.toLowerCase()) ||
        (s.partnerCode || "").toLowerCase().includes(q.toLowerCase())
      );
      if (!found) {
        setCursors([]); setPage(1);
        fetchUsers(null, q, filter);
      }
    } else {
      setCursors([]); setPage(1);
      fetchUsers(null, "", filter);
    }
  };

  // Clear search
  const handleClearSearch = () => {
    setSearchInput(""); setActiveSearch("");
    setCursors([]); setPage(1);
    fetchUsers(null, "", filter);
  };

  const handleFilterChange = (newFilter: string) => {
    setFilter(newFilter);
    setSearchInput(""); setActiveSearch("");
    setCursors([]); setPage(1);
    fetchUsers(null, "", newFilter);
  };

  const handleNext = () => {
    if (!hasNext || !nextCursor) return;
    setCursors(prev => [...prev, nextCursor]);
    setPage(p => p + 1);
    fetchUsers(nextCursor, activeSearch, filter);
  };

  const handlePrev = () => {
    if (page <= 1) return;
    const newCursors = [...cursors];
    newCursors.pop();
    const prevCursor = newCursors[newCursors.length - 1] || null;
    setCursors(newCursors);
    setPage(p => p - 1);
    fetchUsers(prevCursor, activeSearch, filter);
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
      setDeleteTarget(null);
      // Refresh halaman saat ini
      setCursors(prev => { const last = prev[prev.length - 1] || null; return prev; });
      fetchUsers(cursors[cursors.length - 1] || null, activeSearch, filter);
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
          <button className="btn btn-primary" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <Download size={15} /> Export ke Excel
          </button>
        </header>

        <div className={styles.filterBar}>
          <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center", flexWrap: "wrap" }}>
            <button className={`${styles.filterBtn} ${filter === "all" ? styles.active : ""}`} onClick={() => handleFilterChange("all")}>Semua Siswa</button>
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

        <div className={styles.tableCard}>
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Nama Siswa</th>
                <th>Email</th>
                <th>Channel Pendaftaran</th>
                <th>Status Profil</th>
                <th>Tanggal Daftar</th>
                <th className={styles.actionsCell}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((s) => (
                <tr
                  key={s.uid}
                  className={styles.clickableRow}
                  onClick={() => setDetailTarget(s)}
                >
                  <td className={styles.fw500}>{s.displayName}</td>
                  <td className={styles.textSm}>{s.email}</td>
                  <td>
                    {/* Tampilkan channel badge saja, eventId & partnerCode di detail */}
                    <span className={styles.channelBadge}>
                      {channelLabel(s.channelSource)}
                    </span>
                  </td>
                  <td>
                    {s.profileCompleted ? (
                      <span className={`${styles.statusBadge} ${styles.complete}`}>Lengkap</span>
                    ) : (
                      <span className={`${styles.statusBadge} ${styles.incomplete}`}>Belum Lengkap</span>
                    )}
                  </td>
                  <td>{s.createdAt ? new Date(s.createdAt as any).toLocaleDateString("id-ID") : "-"}</td>
                  <td className={styles.actionsCell} onClick={(e) => e.stopPropagation()}>
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
                <tr><td colSpan={6} className={styles.emptyState}>Memuat data siswa...</td></tr>
              ) : filteredStudents.length === 0 ? (
                <tr><td colSpan={6} className={styles.emptyState}>
                  {activeSearch ? `Tidak ada siswa yang cocok dengan "${activeSearch}".` : "Tidak ada data siswa ditemukan."}
                </td></tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className={styles.pagination}>
          <span className={styles.paginationInfo}>
            Halaman {page} &bull; Menampilkan {filteredStudents.length} siswa
            {activeSearch && <> (hasil pencarian: <strong>{activeSearch}</strong>)</>}
          </span>
          <div className={styles.paginationBtns}>
            <button className={styles.pageBtn} onClick={handlePrev} disabled={page <= 1 || loading}>
              <ChevronLeft size={15} /> Sebelumnya
            </button>
            <span className={styles.pageNum}>{page}</span>
            <button className={styles.pageBtn} onClick={handleNext} disabled={!hasNext || loading}>
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

      {/* Dialog Konfirmasi Hapus */}
      {deleteTarget && (
        <div className={styles.modalOverlay} onClick={() => !deleting && setDeleteTarget(null)}>
          <div className={styles.confirmModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.confirmIcon}>
              <Trash2 size={36} color="#dc2626" />
            </div>
            <h2 className={styles.confirmTitle}>Hapus Akun Siswa?</h2>
            <p className={styles.confirmDesc}>
              Kamu akan menghapus akun <strong>{deleteTarget.displayName || deleteTarget.email}</strong> secara permanen.
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
    </ProtectedRoute>
  );
}
