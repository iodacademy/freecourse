"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, Search, CheckCircle2, RefreshCw } from "lucide-react";

interface SearchResult {
  leadId: string;
  nama: string;
  maskedEmail: string;
}

interface MetaVerifyGateProps {
  /** Dipanggil setelah verifikasi sukses; menerima userData (alamat_email, nama_lengkap, dll) */
  onVerified: (userData: any) => void;
}

/**
 * Gerbang verifikasi peserta Meta Instant Form.
 * Peserta mengetik sebagian email/nama → cari di `leads` → pilih → verifikasi.
 * Privasi: hasil email disamarkan, minimal 3 huruf, hasil dibatasi.
 */
export default function MetaVerifyGate({ onVerified }: MetaVerifyGateProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<SearchResult | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [searched, setSearched] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pencarian dengan jeda (debounce) supaya tidak memanggil API tiap ketukan
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const q = query.trim();
    if (q.length < 3) {
      setResults([]);
      setSearched(false);
      return;
    }

    debounceRef.current = setTimeout(() => {
      runSearch(q);
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  async function runSearch(q: string) {
    setSearching(true);
    setErrorMsg("");
    try {
      const res = await fetch(`/api/public/meta/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(Array.isArray(data.results) ? data.results : []);
      setSearched(true);
    } catch {
      setErrorMsg("Terjadi gangguan jaringan. Coba lagi sebentar.");
    } finally {
      setSearching(false);
    }
  }

  async function handleVerify() {
    if (!selected) return;
    setVerifying(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/public/meta/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: selected.leadId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(
          data.message ||
            "Verifikasi gagal. Coba lagi atau cari ulang data Anda."
        );
        return;
      }
      onVerified(data.userData);
    } catch {
      setErrorMsg("Terjadi gangguan jaringan. Silakan coba lagi.");
    } finally {
      setVerifying(false);
    }
  }

  const showEmptyHelp = searched && !searching && results.length === 0;

  return (
    <div className="pf-card" style={{ marginBottom: 24 }}>
      <div className="pf-card__head">
        <h2>Verifikasi Data Anda</h2>
        <p>
          Cari data Anda menggunakan <strong>email</strong> atau{" "}
          <strong>nama</strong> yang Anda isi saat mendaftar lewat iklan kami.
        </p>
      </div>

      <div className="pf-card__body">
        <div className="pf-field-group">
          <label className="pf-label">Email atau Nama</label>
          <div style={{ position: "relative" }}>
            <Search
              size={18}
              style={{
                position: "absolute",
                left: 12,
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--color-gray-500)",
              }}
            />
            <input
              type="text"
              className="pf-input"
              style={{ paddingLeft: 38 }}
              placeholder="Ketik email atau nama Anda..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelected(null);
              }}
              autoComplete="off"
            />
          </div>
          <div className="pf-field-note">
            Ketik minimal 3 huruf. Data ditampilkan sebagian demi keamanan privasi.
          </div>
        </div>

        {/* Status mencari */}
        {searching && (
          <div className="flex items-center gap-2" style={{ color: "var(--color-gray-500)", padding: "8px 0" }}>
            <Loader2 className="animate-spin" size={18} /> Mencari data...
          </div>
        )}

        {/* Daftar hasil */}
        {!searching && results.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
            {results.map((r) => {
              const isSel = selected?.leadId === r.leadId;
              return (
                <button
                  key={r.leadId}
                  type="button"
                  onClick={() => setSelected(r)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    textAlign: "left",
                    border: isSel
                      ? "2px solid var(--color-primary)"
                      : "1.5px solid #e5e7eb",
                    background: isSel ? "#F8FAFC" : "#fff",
                    borderRadius: 12,
                    padding: "12px 16px",
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, color: "#111", fontSize: "0.95rem" }}>
                      {r.nama}
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "#666" }}>{r.maskedEmail}</div>
                  </div>
                  {isSel && <CheckCircle2 size={20} style={{ color: "var(--color-primary)" }} />}
                </button>
              );
            })}
          </div>
        )}

        {/* Tidak ketemu */}
        {showEmptyHelp && (
          <div
            style={{
              marginTop: 12,
              background: "var(--color-bg-soft)",
              borderRadius: 12,
              padding: "16px",
              textAlign: "center",
            }}
          >
            <p style={{ margin: "0 0 12px", color: "#444", fontSize: "0.9rem" }}>
              Data belum ditemukan. Jika baru saja mendaftar, tunggu beberapa saat
              lalu coba lagi.
            </p>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => runSearch(query.trim())}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <RefreshCw size={16} /> Coba Lagi
            </button>
          </div>
        )}

        {/* Pesan error */}
        {errorMsg && (
          <div
            style={{
              marginTop: 12,
              background: "#FEE2E2",
              color: "#B91C1C",
              padding: "12px",
              borderRadius: 8,
              fontSize: "0.875rem",
              textAlign: "center",
            }}
          >
            {errorMsg}
          </div>
        )}

        {/* Tombol verifikasi */}
        {selected && (
          <button
            type="button"
            onClick={handleVerify}
            disabled={verifying}
            className="btn btn-primary w-full"
            style={{ marginTop: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
          >
            {verifying ? (
              <>
                <Loader2 className="animate-spin" size={18} /> Memverifikasi...
              </>
            ) : (
              <>Ini Saya, Lanjutkan</>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
