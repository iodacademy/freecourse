"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import styles from "./page.module.css";
import { AlertTriangle, Copy, Check, ChevronRight, LayoutDashboard } from "lucide-react";

interface PartnerCodeStat {
  id: string;
  code: string;
  partnerName: string;
  eventId: string;
  courseId: string;
  status: "active" | "disabled" | "closed" | "draft";
  quota: number;
  createdAt: any;
  dashboardToken?: string;
  stats: {
    registered: number;
    inProgress: number;
    certified: number;
  };
}

export default function AdminPartnerCodesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [codes, setCodes] = useState<PartnerCodeStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const getToken = useCallback(async () => {
    if (!user) return "";
    try { return await (user as any).getIdToken(); } catch { return ""; }
  }, [user]);

  const fetchCodes = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const token = await getToken();
      const res = await fetch("/api/partner-codes", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Gagal memuat data");
      }
      const data = await res.json();
      setCodes(data);
    } catch (e: any) {
      setError(e.message || "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => { fetchCodes(); }, [fetchCodes]);

  const copyLink = (codeStr: string) => {
    const link = `${window.location.origin}/partner/${codeStr.toLowerCase()}`;
    navigator.clipboard.writeText(link);
    setCopied(codeStr);
    setTimeout(() => setCopied(null), 2000);
  };

  const copyDashboard = (pc: PartnerCodeStat) => {
    if (!pc.dashboardToken) return;
    const link = `${window.location.origin}/mitra/${pc.dashboardToken}`;
    navigator.clipboard.writeText(link);
    setCopied(`dash-${pc.id}`);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <ProtectedRoute requireAdmin>
      <div className={styles.page}>
        <header className={styles.header}>
          <div>
            <h1 className={styles.title}>Tracking Mitra (B2B)</h1>
            <p className={styles.subtitle}>Pantau metrik pendaftaran dan progres belajar mahasiswa/karyawan mitra.</p>
          </div>
        </header>

        {error && (
          <div className={styles.errorBanner}>
            <AlertTriangle size={16} /> {error}
            <button onClick={() => setError("")} className={styles.errorClose}>×</button>
          </div>
        )}

        {loading ? (
          <div className={styles.loadingWrap}>
            <div className={styles.spinner} />
            <p>Memuat data tracking mitra...</p>
          </div>
        ) : codes.length === 0 ? (
          <div className={styles.emptyState}>
            <h3>Belum Ada Event B2B</h3>
            <p>Buat event baru dengan tipe Channel Kemitraan (B2B) untuk melihat tracking di sini.</p>
          </div>
        ) : (
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Event / Mitra</th>
                  <th>Kode Mitra</th>
                  <th>Link Pendaftaran</th>
                  <th>Dashboard Mitra</th>
                  <th style={{ textAlign: "center" }}>Total Daftar</th>
                  <th style={{ textAlign: "center" }}>Dalam Proses</th>
                  <th style={{ textAlign: "center" }}>Selesai</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {codes.map((pc) => {
                  const isActive = pc.status === "active";
                  const partnerLink = `/partner/${pc.code.toLowerCase()}`;
                  return (
                    <tr 
                      key={pc.id} 
                      className={`${styles.clickableRow} ${!isActive ? styles.inactiveRow : ""}`}
                      onClick={() => router.push(`/admin/partner-codes/${pc.id}`)}
                    >
                      <td className={styles.fw500}>{pc.partnerName}</td>
                      <td><code className={styles.codeBadge}>{pc.code}</code></td>
                      <td>
                        <div className={styles.linkCell}>
                          <span className={styles.linkText}>{partnerLink}</span>
                          <button
                            className={`${styles.copyBtn} ${copied === pc.code ? styles.copyBtnDone : ""}`}
                            onClick={(e) => { e.stopPropagation(); copyLink(pc.code); }}
                            title="Salin Link"
                          >
                            {copied === pc.code ? <><Check size={11} /> Tersalin</> : <><Copy size={11} /> Salin</>}
                          </button>
                        </div>
                      </td>
                      <td>
                        {pc.dashboardToken ? (
                          <div className={styles.linkCell}>
                            <a
                              className={styles.linkText}
                              href={`/mitra/${pc.dashboardToken}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              title="Buka dashboard mitra"
                              style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
                            >
                              <LayoutDashboard size={12} /> Buka
                            </a>
                            <button
                              className={`${styles.copyBtn} ${copied === `dash-${pc.id}` ? styles.copyBtnDone : ""}`}
                              onClick={(e) => { e.stopPropagation(); copyDashboard(pc); }}
                              title="Salin link dashboard mitra"
                            >
                              {copied === `dash-${pc.id}` ? <><Check size={11} /> Tersalin</> : <><Copy size={11} /> Salin</>}
                            </button>
                          </div>
                        ) : (
                          <span style={{ color: "#94a3b8", fontSize: 12 }}>—</span>
                        )}
                      </td>
                      <td style={{ textAlign: "center" }}><strong>{pc.stats.registered}</strong></td>
                      <td style={{ textAlign: "center" }}><strong>{pc.stats.inProgress}</strong></td>
                      <td style={{ textAlign: "center" }}><strong>{pc.stats.certified}</strong></td>
                      <td>
                        {isActive ? (
                          <span className={`${styles.statusBadge} ${styles.active}`}>Aktif</span>
                        ) : (
                          <span className={`${styles.statusBadge} ${styles.inactive}`}>
                            {pc.status === "closed" ? "Selesai" : pc.status === "draft" ? "Draft" : "Nonaktif"}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
