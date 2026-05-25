"use client";

import { useState, useEffect, useCallback } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import styles from "./page.module.css";
import {
  Trash2, Search, X, ChevronLeft, ChevronRight,
  Download, Award, Loader2, ExternalLink
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

interface CertRecordFull extends CertRecord {
  enrollmentId?: string;
  driveUrl?: string | null;
}

export default function AdminCertificatesPage() {
  const { user } = useAuth();
  const [certs, setCerts] = useState<CertRecordFull[]>([]);
  const [loading, setLoading] = useState(true);
  const [revokeTarget, setRevokeTarget] = useState<CertRecordFull | null>(null);
  const [revoking, setRevoking] = useState(false);

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

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    setRevoking(true);
    try {
      const token = await getToken();
      const res = await fetch("/api/certificates/revoke", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ enrollmentId: revokeTarget.enrollmentId || revokeTarget.id }),
      });
      if (res.ok) {
        setRevokeTarget(null);
        fetchCerts(null, activeSearch);
      } else {
        const d = await res.json();
        alert(d.error || "Gagal menghapus sertifikat");
      }
    } catch {
      alert("Terjadi kesalahan. Coba lagi.");
    } finally {
      setRevoking(false);
    }
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
                <th>Channel</th>
                <th>Tanggal Klaim</th>
                <th>File PDF</th>
                <th className={styles.actionsCell}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {!loading && filteredCerts.map((cert) => (
                <tr key={cert.id}>
                  <td>
                    <code className={styles.codeBadge}>{cert.certId}</code>
                  </td>
                  <td>
                    <div className={styles.fw500}>{cert.userName}</div>
                    <div className={styles.textSm}>{cert.email}</div>
                  </td>
                  <td>
                    <span className={styles.channelBadge}>{cert.channelSource || "—"}</span>
                  </td>
                  <td>{cert.claimedAt ? new Date(cert.claimedAt).toLocaleDateString("id-ID") : "—"}</td>
                  <td>
                    {(cert as any).driveUrl ? (
                      <a href={(cert as any).driveUrl} target="_blank" rel="noopener noreferrer"
                        style={{ color: "var(--color-primary)", display: "inline-flex", alignItems: "center", gap: 4, fontSize: 13 }}>
                        <ExternalLink size={13} /> Lihat PDF
                      </a>
                    ) : (
                      <span style={{ color: "#aaa", fontSize: 13 }}>Tidak ada</span>
                    )}
                  </td>
                  <td className={styles.actionsCell}>
                    <button
                      className={styles.iconBtn}
                      title="Hapus Sertifikat"
                      style={{ color: "#dc2626" }}
                      onClick={() => setRevokeTarget(cert)}
                    >
                      <Trash2 size={16} />
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

      {/* Confirm Revoke Modal */}
      {revokeTarget && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999
        }} onClick={() => !revoking && setRevokeTarget(null)}>
          <div style={{
            background: "white", borderRadius: 16, padding: 28, maxWidth: 400, width: "90%",
            boxShadow: "0 8px 32px rgba(0,0,0,0.18)"
          }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 32, textAlign: "center", marginBottom: 12 }}>🗑️</div>
            <h3 style={{ margin: "0 0 8px", textAlign: "center", fontSize: 17 }}>Hapus Sertifikat?</h3>
            <p style={{ color: "#666", fontSize: 13, textAlign: "center", marginBottom: 20, lineHeight: 1.6 }}>
              Sertifikat <strong>{revokeTarget.certId}</strong> milik <strong>{revokeTarget.userName}</strong> akan dihapus.
              <br />Peserta dapat klaim ulang dengan ID dan tanggal baru.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setRevokeTarget(null)}
                disabled={revoking}
                style={{ flex: 1, padding: "10px", borderRadius: 10, border: "1.5px solid #ddd", background: "none", cursor: "pointer" }}
              >
                Batal
              </button>
              <button
                onClick={handleRevoke}
                disabled={revoking}
                style={{ flex: 1, padding: "10px", borderRadius: 10, border: "none", background: "#dc2626", color: "white", fontWeight: 700, cursor: "pointer" }}
              >
                {revoking ? "⏳ Menghapus..." : "🗑️ Ya, Hapus"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ProtectedRoute>
  );
}
