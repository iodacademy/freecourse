"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import styles from "./page.module.css";
import { AlertTriangle, Copy, Check, ChevronRight } from "lucide-react";

interface PartnerCodeStat {
  id: string;
  code: string;
  partnerName: string;
  eventId: string;
  courseId: string;
  status: "active" | "disabled" | "closed" | "draft";
  quota: number;
  createdAt: any;
  stats: {
    registered: number;
    assessed: number;
    surveyed: number;
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
            <div className={styles.emptyIcon}>
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--color-gray-400)" }}>
                <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
                <line x1="7" y1="7" x2="7.01" y2="7"></line>
              </svg>
            </div>
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
                  <th style={{ textAlign: "center" }}>Daftar</th>
                  <th style={{ textAlign: "center" }}>Assessment</th>
                  <th style={{ textAlign: "center" }}>Survei</th>
                  <th style={{ textAlign: "center" }}>Sertifikat</th>
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
                      <td style={{ textAlign: "center" }}><strong>{pc.stats.registered}</strong></td>
                      <td style={{ textAlign: "center" }}><strong>{pc.stats.assessed}</strong></td>
                      <td style={{ textAlign: "center" }}><strong>{pc.stats.surveyed}</strong></td>
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
