"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Calendar, Clock, Monitor, ExternalLink, MessageCircle } from "lucide-react";
import Image from "next/image";
import { WorkshopData } from "@/components/LandingTemplate/LandingTemplate";
import styles from "./WorkshopBanner.module.css";

interface WorkshopBannerProps {
  workshopData: WorkshopData;
  eventId: string;
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

export default function WorkshopBanner({ workshopData, eventId, forceOpen, onClose }: WorkshopBannerProps) {
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    // Mode forceOpen: selalu tampil (dari tombol notifikasi)
    if (forceOpen) {
      setVisible(true);
      return;
    }
    // Mode auto: cek apakah sudah lewat atau sudah di-dismiss
    if (workshopData.date && isEventPassed(workshopData.date)) return;
    const dismissed = sessionStorage.getItem(DISMISS_KEY(eventId));
    if (dismissed) return;
    const t = setTimeout(() => setVisible(true), 400);
    return () => clearTimeout(t);
  }, [workshopData.date, eventId, forceOpen]);

  const handleDismiss = useCallback(() => {
    setClosing(true);
    setTimeout(() => {
      if (!forceOpen) {
        sessionStorage.setItem(DISMISS_KEY(eventId), "1");
      }
      setVisible(false);
      setClosing(false);
      onClose?.();
    }, 280);
  }, [eventId, forceOpen, onClose]);

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) handleDismiss();
  };

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
            {/* Badge */}
            <div className={styles.badge}>
              <Calendar size={11} />
              UPCOMING WORKSHOP
            </div>

            {/* Judul besar */}
            <h2 className={styles.title}>{workshopData.title || "Judul Workshop Akan Tampil Di Sini"}</h2>

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

            {/* CTA Buttons */}
            <div className={styles.ctaRow}>
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
      </div>
    </div>
  );
}
