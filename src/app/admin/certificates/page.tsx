"use client";

import { useState, useEffect, useCallback } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import styles from "./page.module.css";
import {
  Eye, XCircle, CheckCircle, Search, X, ChevronLeft, ChevronRight,
  Download, Award, Loader2
} from "lucide-react";

interface CertRecord {
  id: string;
  certId: string;
  userName: string;
  email: string;
  courseName: string;
  claimedAt: string | null;
  isValid: boolean;
  channelSource?: string | null;
  partnerCode?: string | null;
}

export default function AdminCertificatesPage() {
  const { user } = useAuth();
  const [certs, setCerts] = useState<CertRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Search
  const [searchInput, setSearchInput] = useState("");
  const [activeSearch, setActiveSearch] = useState("");

  // Pagination
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasNext, setHasNext] = useState(false);
  const [page, setPage] = useState(1);
  const [cursors, setCursors] = useState<string[]>([]);

  const getToken = useCallback(async () => {
    if (!user) return "";
    try { return await (user as any).getIdToken(); } catch { return ""; }
  }, [user]);

  const fetchCerts = useCallback(async (after?: string | null, search?: string) => {
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      const params = new URLSearchParams({ limit: "50" });
      if (after) params.set("after", after);
      if (search) params.set("search", search);

      const res = await fetch(`/api/certificates?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setCerts(data);
          setHasNext(false);
          setNextCursor(null);
        } else {
          setCerts(data.certs || []);
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

  useEffect(() => { fetchCerts(); }, [fetchCerts]);

  // Filter lokal
  const filteredCerts = certs.filter(c => {
    if (!activeSearch) return true;
    const q = activeSearch.toLowerCase();
    return (
      c.userName.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      c.certId.toLowerCase().includes(q)
    );
  });

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    const q = searchInput.trim();
    setActiveSearch(q);
    if (q) {
      const found = certs.some(c =>
        c.userName.toLowerCase().includes(q.toLowerCase()) ||
        c.email.toLowerCase().includes(q.toLowerCase()) ||
        c.certId.toLowerCase().includes(q.toLowerCase())
      );
      if (!found) { setCursors([]); setPage(1); fetchCerts(null, q); }
    } else {
      setCursors([]); setPage(1); fetchCerts(null, "");
    }
  };

  const handleClearSearch = () => {
    setSearchInput(""); setActiveSearch("");
    setCursors([]); setPage(1); fetchCerts(null, "");
  };

  const handleNext = () => {
    if (!hasNext || !nextCursor) return;
    setCursors(prev => [...prev, nextCursor]);
    setPage(p => p + 1);
    fetchCerts(nextCursor, activeSearch);
  };

  const handlePrev = () => {
    if (page <= 1) return;
    const newCursors = [...cursors];
    newCursors.pop();
    const prevCursor = newCursors[newCursors.length - 1] || null;
    setCursors(newCursors);
    setPage(p => p - 1);
    fetchCerts(prevCursor, activeSearch);
  };

  return (
    <ProtectedRoute requireAdmin>
      <div className={styles.page}>
        <header className={styles.header}>
          <div>
            <h1 className={styles.title}>Kelola Sertifikat</h1>
            <p className={styles.subtitle}>Daftar sertifikat yang telah diterbitkan.</p>
          </div>
          <button className="btn btn-primary" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <Download size={15} /> Export Data
          </button>
        </header>

        {/* Search Bar */}
        <div className={styles.searchBarWrap}>
          <div className={styles.searchWrap}>
            <Search size={15} className={styles.searchIcon} />
            <input
              className={styles.searchInput}
              type="text"
              placeholder="Cari nama, email, ID sertifikat... (Enter)"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={handleSearch}
            />
            {(searchInput || activeSearch) && (
              <button className={styles.searchClear} onClick={handleClearSearch}>
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>ID Sertifikat</th>
                <th>Nama Peserta</th>
                <th>Kursus</th>
                <th>Tanggal Klaim</th>
                <th>Status</th>
                <th className={styles.actionsCell}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {!loading && filteredCerts.map((cert) => (
                <tr key={cert.id} className={!cert.isValid ? styles.invalidRow : ""}>
                  <td>
                    <code className={styles.codeBadge}>{cert.certId}</code>
                  </td>
                  <td>
                    <div className={styles.fw500}>{cert.userName}</div>
                    <div className={styles.textSm}>{cert.email}</div>
                  </td>
                  <td>{cert.courseName}</td>
                  <td>{cert.claimedAt ? new Date(cert.claimedAt).toLocaleDateString("id-ID") : "—"}</td>
                  <td>
                    {cert.isValid ? (
                      <span className={`${styles.statusBadge} ${styles.valid}`}>Valid</span>
                    ) : (
                      <span className={`${styles.statusBadge} ${styles.invalid}`}>Dicabut</span>
                    )}
                  </td>
                  <td className={styles.actionsCell}>
                    <button className={styles.iconBtn} title="Lihat"><Eye size={16} /></button>
                    <button className={styles.iconBtn} title={cert.isValid ? "Cabut Sertifikat" : "Pulihkan"}>
                      {cert.isValid ? <XCircle size={16} /> : <CheckCircle size={16} />}
                    </button>
                  </td>
                </tr>
              ))}
              {loading && (
                <tr>
                  <td colSpan={6} className={styles.emptyState}>
                    <Loader2 size={20} style={{ animation: "spin 1s linear infinite", marginRight: 8, verticalAlign: "middle" }} />
                    Memuat data sertifikat...
                  </td>
                </tr>
              )}
              {!loading && filteredCerts.length === 0 && (
                <tr>
                  <td colSpan={6} className={styles.emptyState}>
                    <Award size={28} style={{ opacity: 0.3, display: "block", margin: "0 auto 8px" }} />
                    {activeSearch ? `Tidak ada sertifikat untuk "${activeSearch}".` : "Belum ada sertifikat yang diterbitkan."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className={styles.pagination}>
          <span className={styles.paginationInfo}>
            Halaman {page} &bull; Menampilkan {filteredCerts.length} sertifikat
            {activeSearch && <> (pencarian: <strong>{activeSearch}</strong>)</>}
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
      </div>
    </ProtectedRoute>
  );
}
