"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import { AlertTriangle, ArrowLeft, Check, X, Download } from "lucide-react";
import styles from "./page.module.css";

interface Participant {
  uid: string;
  namaLengkap: string;
  email: string;
  nomorWA: string;
  profileCompleted: boolean;
  assessmentPassed: boolean;
  surveySubmitted: boolean;
  certificateClaimed: boolean;
  createdAt: any;
}

interface EventDetail {
  id: string;
  name: string;
  campusName: string;
  partnerCode: string;
  status: string;
  startDate: any;
  endDate: any;
}

interface Stats {
  registered: number;
  assessed: number;
  surveyed: number;
  certified: number;
}

export default function PartnerCodeDetailPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [event, setEvent] = useState<EventDetail | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [stats, setStats] = useState<Stats>({ registered: 0, assessed: 0, surveyed: 0, certified: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | "assessed" | "surveyed" | "certified">("all");

  const getToken = useCallback(async () => {
    if (!user) return "";
    try { return await (user as any).getIdToken(); } catch { return ""; }
  }, [user]);

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const token = await getToken();
      const res = await fetch(`/api/partner-codes/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Gagal memuat data");
      }
      const data = await res.json();
      setEvent(data.event);
      setParticipants(data.participants);
      setStats(data.stats);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [getToken, id]);

  useEffect(() => { fetchDetail(); }, [fetchDetail]);

  const filteredParticipants = participants.filter(p => {
    if (filter === "assessed") return p.assessmentPassed;
    if (filter === "surveyed") return p.surveySubmitted;
    if (filter === "certified") return p.certificateClaimed;
    return true;
  });

  const StatusIcon = ({ value }: { value: boolean }) =>
    value
      ? <span className={styles.statusDone}><Check size={12} /></span>
      : <span className={styles.statusPending}><X size={12} /></span>;

  return (
    <ProtectedRoute requireAdmin>
      <div className={styles.page}>
        {/* Back button */}
        <button className={styles.backBtn} onClick={() => router.push("/admin/partner-codes")}>
          <ArrowLeft size={15} /> Kembali ke Tracking Mitra
        </button>

        {loading ? (
          <div className={styles.loadingWrap}>
            <div className={styles.spinner} />
            <p>Memuat data peserta...</p>
          </div>
        ) : error ? (
          <div className={styles.errorBanner}>
            <AlertTriangle size={16} /> {error}
          </div>
        ) : event && (
          <>
            {/* Header */}
            <div className={styles.header}>
              <div>
                <h1 className={styles.title}>{event.campusName || event.name}</h1>
                <p className={styles.subtitle}>
                  Kode Mitra: <code className={styles.codeBadge}>{event.partnerCode}</code>
                  &nbsp;&middot;&nbsp;
                  <span className={`${styles.statusBadge} ${event.status === "active" ? styles.active : styles.inactive}`}>
                    {event.status === "active" ? "Aktif" : event.status === "closed" ? "Selesai" : "Draft"}
                  </span>
                </p>
              </div>
            </div>

            {/* Stats Cards */}
            <div className={styles.statsRow}>
              <button className={`${styles.statCard} ${filter === "all" ? styles.statCardActive : ""}`} onClick={() => setFilter("all")}>
                <div className={styles.statNum}>{stats.registered}</div>
                <div className={styles.statLabel}>Total Daftar</div>
              </button>
              <button className={`${styles.statCard} ${filter === "assessed" ? styles.statCardActive : ""}`} onClick={() => setFilter("assessed")}>
                <div className={styles.statNum}>{stats.assessed}</div>
                <div className={styles.statLabel}>Assessment Selesai</div>
              </button>
              <button className={`${styles.statCard} ${filter === "surveyed" ? styles.statCardActive : ""}`} onClick={() => setFilter("surveyed")}>
                <div className={styles.statNum}>{stats.surveyed}</div>
                <div className={styles.statLabel}>Survei Diisi</div>
              </button>
              <button className={`${styles.statCard} ${filter === "certified" ? styles.statCardActive : ""}`} onClick={() => setFilter("certified")}>
                <div className={styles.statNum}>{stats.certified}</div>
                <div className={styles.statLabel}>Klaim Sertifikat</div>
              </button>
            </div>

            {/* Table */}
            <div className={styles.tableContainer}>
              <div className={styles.tableHeader}>
                <span className={styles.tableCount}>
                  Menampilkan <strong>{filteredParticipants.length}</strong> peserta
                </span>
              </div>
              {filteredParticipants.length === 0 ? (
                <div className={styles.emptyState}>
                  <p>Belum ada peserta yang memenuhi filter ini.</p>
                </div>
              ) : (
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Nama Lengkap</th>
                      <th>Email</th>
                      <th>Nomor WA</th>
                      <th style={{ textAlign: "center" }}>Profil</th>
                      <th style={{ textAlign: "center" }}>Assessment</th>
                      <th style={{ textAlign: "center" }}>Survei</th>
                      <th style={{ textAlign: "center" }}>Sertifikat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredParticipants.map((p, i) => (
                      <tr key={p.uid}>
                        <td className={styles.noCell}>{i + 1}</td>
                        <td className={styles.nameCell}>{p.namaLengkap}</td>
                        <td className={styles.emailCell}>{p.email}</td>
                        <td>{p.nomorWA}</td>
                        <td style={{ textAlign: "center" }}><StatusIcon value={p.profileCompleted} /></td>
                        <td style={{ textAlign: "center" }}><StatusIcon value={p.assessmentPassed} /></td>
                        <td style={{ textAlign: "center" }}><StatusIcon value={p.surveySubmitted} /></td>
                        <td style={{ textAlign: "center" }}><StatusIcon value={p.certificateClaimed} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>
    </ProtectedRoute>
  );
}
