"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Calendar, Clock, Monitor, ExternalLink, MessageCircle, Award, Loader2, CheckCircle } from "lucide-react";
import Image from "next/image";
import { useAuth } from "@/contexts/AuthContext";
import { WorkshopData } from "@/components/LandingTemplate/LandingTemplate";
import styles from "./WorkshopBanner.module.css";

interface WorkshopBannerProps {
  workshopData: WorkshopData;
  eventId: string;
  enrollmentId?: string;
  /** Jika true, popup langsung tampil (dipanggil manual dari tombol notifikasi) */
  forceOpen?: boolean;
  onClose?: () => void;
}

/** Format ISO date ke "15 Juni 2026" */
function formatDateID(iso: string): string {
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString("id-ID", {
      day: "numeric", month: "long", year: "numeric",
    });
  } catch {
    return iso;
  }
}

/** Cek apakah tanggal workshop sudah lewat */
function isEventPassed(isoDate: string): boolean {
  try {
    const eventDate = new Date(isoDate + "T23:59:59");
    return eventDate < new Date();
  } catch {
    return false;
  }
}

const DISMISS_KEY = (id: string) => `wsBannerDismissed_${id}`;

export default function WorkshopBanner({ workshopData, eventId, enrollmentId, forceOpen, onClose }: WorkshopBannerProps) {
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimError, setClaimError] = useState("");
  const [claimSuccess, setClaimSuccess] = useState(false);
  const [claimedCertId, setClaimedCertId] = useState<string | null>(null);

  // Tentukan mode: "upcoming" atau "claim"
  const isPassed = workshopData.date ? isEventPassed(workshopData.date) : false;

  useEffect(() => {
    if (forceOpen) {
      setVisible(true);
      return;
    }
    if (isPassed) {
      // Mode klaim: selalu tampil jika belum diklaim
      const dismissed = sessionStorage.getItem(DISMISS_KEY(eventId + "_claim"));
      if (!dismissed) {
        const t = setTimeout(() => setVisible(true), 400);
        return () => clearTimeout(t);
      }
      return;
    }
    // Mode upcoming: cek apakah sudah di-dismiss
    const dismissed = sessionStorage.getItem(DISMISS_KEY(eventId));
    if (dismissed) return;
    const t = setTimeout(() => setVisible(true), 400);
    return () => clearTimeout(t);
  }, [workshopData.date, eventId, forceOpen, isPassed]);

  const handleDismiss = useCallback(() => {
    setClosing(true);
    setTimeout(() => {
      if (!forceOpen) {
        // Simpan dismiss key berbeda untuk mode upcoming vs mode klaim
        const key = isPassed ? DISMISS_KEY(eventId + "_claim") : DISMISS_KEY(eventId);
        sessionStorage.setItem(key, "1");
      }
      setVisible(false);
      setClosing(false);
      onClose?.();
    }, 280);
  }, [eventId, forceOpen, onClose, isPassed]);

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) handleDismiss();
  };

  const handleClaimWorkshopCert = useCallback(async () => {
    if (!user || !enrollmentId) return;
    setIsClaiming(true);
    setClaimError("");

    try {
      const idToken = await user.getIdToken();
      const res = await fetch(`/api/enrollments/${enrollmentId}/claim-workshop-cert`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
      });

      const data = await res.json();

      if (!res.ok) {
        setClaimError(data.error || "Gagal mengklaim sertifikat. Coba lagi.");
        return;
      }

      setClaimSuccess(true);
      setClaimedCertId(data.certId);

      // Jika GAS mengembalikan link download langsung
      if (data.downloadUrl) {
        window.open(data.downloadUrl, "_blank");
      }
    } catch {
      setClaimError("Terjadi kesalahan. Periksa koneksi internet dan coba lagi.");
    } finally {
      setIsClaiming(false);
    }
  }, [user, enrollmentId]);

  if (!visible) return null;

  const dateDisplay = workshopData.date ? formatDateID(workshopData.date) : "";
  const hasSpeaker = !!workshopData.speakerName;

  return (
    <div
      className={`${styles.overlay} ${closing ? styles.overlayOut : ""}`}
      onClick={handleOverlayClick}
    >
      <div className={`${styles.modal} ${closing ? styles.modalOut : ""}`}>

        {/* Tombol close pojok kanan atas */}
        <button className={styles.closeBtn} onClick={handleDismiss} title="Tutup">
          <X size={18} />
        </button>

        {/* Layout 2 kolom: Info (kiri) + Polaroid Photo (kanan) */}
        <div className={styles.layout}>

          {/* ── KIRI: Info Workshop ── */}
          <div className={styles.leftCol}>
            {/* Badge — berbeda tergantung mode */}
            <div className={styles.badge} style={isPassed ? { background: "#e8f5e9", color: "#2e7d32" } : {}}>
              {isPassed ? (
                <><Award size={11} />KLAIM SERTIFIKAT KEHADIRAN</>
              ) : (
                <><Calendar size={11} />UPCOMING WORKSHOP</>
              )}
            </div>

            {/* Judul besar */}
            <h2 className={styles.title}>
              {isPassed ? "Workshop Selesai! 🎓" : (workshopData.title || "Judul Workshop Akan Tampil Di Sini")}
            </h2>
            {isPassed && workshopData.title && (
              <p style={{ fontSize: 13, color: "var(--color-gray-500)", margin: "0 0 8px 0" }}>
                {workshopData.title}
              </p>
            )}

            {/* Meta info list */}
            <div className={styles.metaList}>
              {dateDisplay && (
                <div className={styles.metaRow}>
                  <div className={styles.metaIconWrap}>
                    <Calendar size={15} />
                  </div>
                  <div>
                    <div className={styles.metaLabel}>TANGGAL</div>
                    <div className={styles.metaValue}>{dateDisplay}</div>
                  </div>
                </div>
              )}
              {(workshopData.dayLabel || workshopData.time) && (
                <div className={styles.metaRow}>
                  <div className={styles.metaIconWrap}>
                    <Clock size={15} />
                  </div>
                  <div>
                    <div className={styles.metaLabel}>HARI &amp; JAM</div>
                    <div className={styles.metaValue}>
                      {[workshopData.dayLabel, workshopData.time].filter(Boolean).join(" - ")}
                    </div>
                  </div>
                </div>
              )}
              {workshopData.platform && (
                <div className={styles.metaRow}>
                  <div className={styles.metaIconWrap}>
                    <Monitor size={15} />
                  </div>
                  <div>
                    <div className={styles.metaLabel}>PLATFORM</div>
                    <div className={styles.metaValue}>{workshopData.platform}</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── KANAN: Polaroid Photo ── */}
          {hasSpeaker && (
            <div className={styles.rightCol}>
              <div className={styles.polaroid}>
                {/* Red tape di atas */}
                <div className={styles.tape} />

                {/* Foto pemateri */}
                <div className={styles.photoWrap}>
                  {workshopData.speakerPhoto ? (
                    <Image
                      src={workshopData.speakerPhoto}
                      alt={workshopData.speakerName!}
                      fill
                      className={styles.photo}
                      unoptimized
                    />
                  ) : (
                    <div className={styles.photoPlaceholder}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                        <circle cx="12" cy="7" r="4"/>
                      </svg>
                    </div>
                  )}
                </div>

                {/* Nama & jabatan di bawah foto (gaya polaroid caption) */}
                <div className={styles.polaroidCaption}>
                  <div className={styles.speakerLabel}>PEMATERI</div>
                  <div className={styles.speakerName}>{workshopData.speakerName}</div>
                  {workshopData.speakerTitle && (
                    <div className={styles.speakerTitle}>{workshopData.speakerTitle}</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── CTA Buttons — di luar layout agar full width & simetris ── */}
        <div className={styles.ctaRow}>
          {isPassed ? (
            // ── Mode Klaim ──
            <>
              {claimSuccess ? (
                <div style={{
                  display: "flex", alignItems: "center", gap: 8,
                  background: "#e8f5e9", border: "1px solid #a5d6a7",
                  borderRadius: 8, padding: "10px 14px", fontSize: 13,
                  color: "#2e7d32", fontWeight: 600,
                }}>
                  <CheckCircle size={16} />
                  Sertifikat berhasil diklaim!
                  {claimedCertId && (
                    <a
                      href={`/verify/${claimedCertId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ marginLeft: 4, color: "#1b5e20", fontSize: 12, textDecoration: "underline" }}
                    >
                      Lihat <ExternalLink size={10} style={{ verticalAlign: "middle" }} />
                    </a>
                  )}
                </div>
              ) : (
                <>
                  {claimError && (
                    <div style={{
                      fontSize: 12, color: "#c62828", background: "#ffebee",
                      border: "1px solid #ef9a9a", borderRadius: 6, padding: "8px 12px",
                      marginBottom: 6, width: "100%",
                    }}>
                      {claimError}
                    </div>
                  )}
                  <button
                    className={styles.ctaBtnPrimary}
                    onClick={handleClaimWorkshopCert}
                    disabled={isClaiming || !enrollmentId}
                    style={{ opacity: (isClaiming || !enrollmentId) ? 0.7 : 1, cursor: (isClaiming || !enrollmentId) ? "not-allowed" : "pointer" }}
                  >
                    {isClaiming ? (
                      <><Loader2 size={14} className="animate-spin" />Memproses...</>
                    ) : (
                      <><Award size={14} />Klaim Sertifikat Kehadiran</>
                    )}
                  </button>
                </>
              )}
              {workshopData.waGroupLink && (
                <a
                  href={workshopData.waGroupLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.ctaBtnWa}
                >
                  <MessageCircle size={14} />
                  Grup WhatsApp
                </a>
              )}
            </>
          ) : (
            // ── Mode Upcoming ──
            <>
              {workshopData.meetingLink && (
                <a
                  href={workshopData.meetingLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.ctaBtnPrimary}
                >
                  <ExternalLink size={14} />
                  Gabung Meeting
                </a>
              )}
              {workshopData.waGroupLink && (
                <a
                  href={workshopData.waGroupLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.ctaBtnWa}
                >
                  <MessageCircle size={14} />
                  Grup WhatsApp
                </a>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
