"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Calendar, Clock, Monitor, MessageCircle, Award, Loader2, CheckCircle } from "lucide-react";
import Image from "next/image";
import { useAuth } from "@/contexts/AuthContext";
import { WorkshopData } from "@/components/LandingTemplate/LandingTemplate";

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
  const [claimModalOpen, setClaimModalOpen] = useState(false);
  const [claimStep, setClaimStep] = useState(0);
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
    setClaimModalOpen(true);
    setClaimStep(0);
    setClaimError("");
    setIsClaiming(true);

    const newWindow = window.open('about:blank', '_blank');

    try {
      await new Promise(r => setTimeout(r, 600));
      setClaimStep(1);

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
        if (newWindow) newWindow.close();
        setClaimStep(-1);
        setClaimError(data.error || "Gagal mengklaim sertifikat. Coba lagi.");
        return;
      }

      setClaimStep(2);
      setClaimSuccess(true);
      setClaimedCertId(data.certId);

      if (data.downloadUrl && newWindow) {
        newWindow.location.href = data.downloadUrl;
      } else if (newWindow) {
        newWindow.close();
      }

      // Auto close modal after success
      await new Promise(r => setTimeout(r, 1500));
      setClaimModalOpen(false);
    } catch {
      if (newWindow) newWindow.close();
      setClaimStep(-1);
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
      className={`wb-overlay ${closing ? "wb-overlay--out" : ""}`}
      onClick={handleOverlayClick}
    >
      <div className={`wb-modal ${closing ? "wb-modal--out" : ""}`}>

        {/* Tombol close pojok kanan atas */}
        <button className="wb-close-btn" onClick={handleDismiss} title="Tutup">
          <X size={18} />
        </button>

        {/* Layout 2 kolom: Info (kiri) + Polaroid Photo (kanan) */}
        <div className="wb-layout">

          {/* ── KIRI: Info Workshop ── */}
          <div className="wb-left">
            {/* Badge — berbeda tergantung mode */}
            <div className="wb-badge" style={isPassed ? { background: "#e8f5e9", color: "#2e7d32" } : {}}>
              {isPassed ? (
                <><Award size={11} />KLAIM SERTIFIKAT KEHADIRAN</>
              ) : (
                <><Calendar size={11} />UPCOMING WORKSHOP</>
              )}
            </div>

            {/* Judul besar */}
            <h2 className="wb-title">
              {isPassed ? "Workshop Selesai! 🎓" : (workshopData.title || "Judul Workshop Akan Tampil Di Sini")}
            </h2>
            {isPassed && workshopData.title && (
              <p style={{ fontSize: 13, color: "var(--color-gray-500)", margin: "0 0 8px 0" }}>
                {workshopData.title}
              </p>
            )}

            {/* Meta info list */}
            <div className="wb-meta-list">
              {dateDisplay && (
                <div className="wb-meta-row">
                  <div className="wb-meta-icon-wrap">
                    <Calendar size={15} />
                  </div>
                  <div>
                    <div className="wb-meta-label">TANGGAL</div>
                    <div className="wb-meta-value">{dateDisplay}</div>
                  </div>
                </div>
              )}
              {(workshopData.dayLabel || workshopData.time) && (
                <div className="wb-meta-row">
                  <div className="wb-meta-icon-wrap">
                    <Clock size={15} />
                  </div>
                  <div>
                    <div className="wb-meta-label">HARI &amp; JAM</div>
                    <div className="wb-meta-value">
                      {[workshopData.dayLabel, workshopData.time].filter(Boolean).join(" - ")}
                    </div>
                  </div>
                </div>
              )}
              {workshopData.platform && (
                <div className="wb-meta-row">
                  <div className="wb-meta-icon-wrap">
                    <Monitor size={15} />
                  </div>
                  <div>
                    <div className="wb-meta-label">PLATFORM</div>
                    <div className="wb-meta-value">{workshopData.platform}</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── KANAN: Polaroid Photo ── */}
          {hasSpeaker && (
            <div className="wb-right">
              <div className="wb-polaroid">
                {/* Red tape di atas */}
                <div className="wb-tape" />

                {/* Foto pemateri */}
                <div className="wb-photo-wrap">
                  {workshopData.speakerPhoto ? (
                    <Image
                      src={workshopData.speakerPhoto}
                      alt={workshopData.speakerName!}
                      fill
                      className="wb-photo"
                      unoptimized
                    />
                  ) : (
                    <div className="wb-photo-placeholder">
                      <svg viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                        <circle cx="12" cy="7" r="4"/>
                      </svg>
                    </div>
                  )}
                </div>

                {/* Nama & jabatan di bawah foto (gaya polaroid caption) */}
                <div className="wb-polaroid-caption">
                  <div className="wb-speaker-label">PEMATERI</div>
                  <div className="wb-speaker-name">{workshopData.speakerName}</div>
                  {workshopData.speakerTitle && (
                    <div className="wb-speaker-title">{workshopData.speakerTitle}</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── CTA Buttons — di luar layout agar full width & simetris ── */}
        <div className="wb-cta-row">
          {isPassed ? (
            // ── Mode Klaim ──
            <>
              {claimSuccess ? (
                <div style={{
                  display: "flex", alignItems: "center", gap: 8,
                  background: "#e8f5e9", border: "1px solid #a5d6a7",
                  borderRadius: 8, padding: "10px 14px", fontSize: 13,
                  color: "#2e7d32", fontWeight: 600, width: "100%",
                }}>
                  <CheckCircle size={16} />
                  Sertifikat berhasil diklaim!
                  {claimedCertId && (
                    <span style={{ marginLeft: 4, fontSize: 11, opacity: 0.8 }}>
                      ID: {claimedCertId}
                    </span>
                  )}
                </div>
              ) : (
                <button
                  className="wb-cta-primary"
                  onClick={handleClaimWorkshopCert}
                  disabled={isClaiming || !enrollmentId}
                >
                  <Award size={14} />Klaim Sertifikat Kehadiran
                </button>
              )}
              {workshopData.waGroupLink && (
                <a
                  href={workshopData.waGroupLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="wb-cta-wa"
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
                  className="wb-cta-primary"
                >
                  Gabung Meeting
                </a>
              )}
              {workshopData.waGroupLink && (
                <a
                  href={workshopData.waGroupLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="wb-cta-wa"
                >
                  <MessageCircle size={14} />
                  Grup WhatsApp
                </a>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Claim Modal ── */}
      {claimModalOpen && (
        <div className="ccm-overlay" style={{ zIndex: 10001 }}>
          <div className="ccm-modal">
            {claimStep >= 0 ? (
              <>
                <div className="ccm-icon">
                  {claimStep < 2 ? (
                    <div className="ccm-spinner" />
                  ) : (
                    <div className="ccm-check">✓</div>
                  )}
                </div>
                <h3 className="ccm-title">
                  {claimStep === 0 && "Memproses..."}
                  {claimStep === 1 && "Membuat sertifikat kehadiran..."}
                  {claimStep === 2 && "Sertifikat berhasil! 🎉"}
                </h3>
                <div className="ccm-steps">
                  <div className={`ccm-step ${claimStep >= 0 ? 'ccm-step--done' : ''}`}>
                    <span className="ccm-dot">{claimStep > 0 ? '✓' : '⏳'}</span>
                    Verifikasi kehadiran
                  </div>
                  <div className={`ccm-step ${claimStep >= 1 ? (claimStep > 1 ? 'ccm-step--done' : 'ccm-step--active') : ''}`}>
                    <span className="ccm-dot">{claimStep > 1 ? '✓' : claimStep === 1 ? '⏳' : '○'}</span>
                    Generate sertifikat kehadiran
                  </div>
                  <div className={`ccm-step ${claimStep >= 2 ? 'ccm-step--done' : ''}`}>
                    <span className="ccm-dot">{claimStep >= 2 ? '✓' : '○'}</span>
                    Selesai
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="ccm-icon">
                  <div className="ccm-error-icon">✕</div>
                </div>
                <h3 className="ccm-title" style={{ color: 'var(--color-primary)' }}>Gagal</h3>
                <p className="ccm-error-msg">{claimError}</p>
                <button className="ccm-retry-btn" onClick={() => setClaimModalOpen(false)}>Tutup</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
