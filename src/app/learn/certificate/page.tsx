"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import styles from "./page.module.css";
import { ClipboardList, GraduationCap } from "lucide-react";

export default function CertificatePage() {
  const { profile } = useAuth();
  const router = useRouter();

  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [certId] = useState("CERT-2026-" + Math.random().toString(36).substring(2, 8).toUpperCase());

  // Data dummy — nanti dari Firestore
  const courseName = "Kursus Literasi Finansial";
  const completedSteps = 10;
  const totalSteps = 10;
  const isAllCompleted = completedSteps >= totalSteps;

  async function handleClaim() {
    setClaiming(true);
    // Simulasi proses generate sertifikat (Google Slides API via GAS)
    await new Promise((resolve) => setTimeout(resolve, 2500));
    setClaimed(true);
    setClaiming(false);
    // Nanti: panggil GAS endpoint untuk generate sertifikat
  }

  return (
    <ProtectedRoute>
      <div className={styles.wrapper}>
        <div className={`container ${styles.content}`}>
          {!isAllCompleted ? (
            /* Belum selesai semua — tampilkan progress */
            <div className={styles.incompleteCard}>
              <div className={styles.iconCircle}>
                <span className={styles.incompleteIcon}><ClipboardList size={32} style={{ color: 'var(--color-primary)' }} /></span>
              </div>
              <h2>Belum Bisa Klaim Sertifikat</h2>
              <p>
                Kamu perlu menyelesaikan semua materi terlebih dahulu.
                Saat ini kamu sudah menyelesaikan{" "}
                <strong>{completedSteps} dari {totalSteps}</strong> langkah.
              </p>
              <div className={styles.progressBarLg}>
                <div
                  className={styles.progressFillLg}
                  style={{ width: `${(completedSteps / totalSteps) * 100}%` }}
                />
              </div>
              <Link href="/learn" className="btn btn-primary">
                Lanjutkan Belajar
              </Link>
            </div>
          ) : !claimed ? (
            /* Semua selesai — siap klaim */
            <div className={styles.claimCard}>
              <div className={styles.claimHeader}>
                <span className={styles.trophyIcon}>🏆</span>
                <h1>Selamat, {profile?.displayName || "Peserta"}!</h1>
                <p>
                  Kamu telah menyelesaikan seluruh materi{" "}
                  <strong>{courseName}</strong>. Klaim sertifikat kamu sekarang!
                </p>
              </div>

              {/* Preview Sertifikat */}
              <div className={styles.certPreview}>
                <div className={styles.certCard}>
                  <div className={styles.certBorder}>
                    <div className={styles.certInner}>
                      <span className={styles.certLogo}>IODA Academy</span>
                      <p className={styles.certLabel}>SERTIFIKAT</p>
                      <h2 className={styles.certName}>
                        {profile?.profileData?.namaLengkap || profile?.displayName || "Nama Peserta"}
                      </h2>
                      <p className={styles.certDesc}>
                        Telah berhasil menyelesaikan kursus
                      </p>
                      <p className={styles.certCourse}>{courseName}</p>
                      <div className={styles.certMeta}>
                        <span>ID: {certId}</span>
                        <span>{new Date().toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <button
                className="btn btn-primary btn-lg w-full"
                onClick={handleClaim}
                disabled={claiming}
              >
                {claiming ? (
                  <>
                    <div className="spinner spinner-sm" />
                    Membuat Sertifikat...
                  </>
                ) : (
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}><GraduationCap size={20} /> Klaim Sertifikat Sekarang</span>
                )}
              </button>

              {claiming && (
                <p className={styles.claimNote}>
                  Sedang membuat sertifikat di Google Slides... Mohon tunggu.
                </p>
              )}
            </div>
          ) : (
            /* Sertifikat berhasil diklaim */
            <div className={styles.successCard}>
              <div className={styles.confetti}>🎉</div>
              <h1 className={styles.successTitle}>Sertifikat Berhasil Diklaim!</h1>
              <p className={styles.successSubtitle}>
                Sertifikat digital kamu sudah dikirim ke email{" "}
                <strong>{profile?.email}</strong>
              </p>

              {/* Cert Info */}
              <div className={styles.certInfo}>
                <div className={styles.certInfoRow}>
                  <span className={styles.certInfoLabel}>ID Sertifikat</span>
                  <span className={styles.certInfoValue}>{certId}</span>
                </div>
                <div className={styles.certInfoRow}>
                  <span className={styles.certInfoLabel}>Nama</span>
                  <span className={styles.certInfoValue}>
                    {profile?.profileData?.namaLengkap || profile?.displayName}
                  </span>
                </div>
                <div className={styles.certInfoRow}>
                  <span className={styles.certInfoLabel}>Kursus</span>
                  <span className={styles.certInfoValue}>{courseName}</span>
                </div>
                <div className={styles.certInfoRow}>
                  <span className={styles.certInfoLabel}>Tanggal</span>
                  <span className={styles.certInfoValue}>
                    {new Date().toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </span>
                </div>
                <div className={styles.certInfoRow}>
                  <span className={styles.certInfoLabel}>Verifikasi</span>
                  <span className={styles.certInfoValue}>
                    <Link href={`/verify/${certId}`} className={styles.verifyLink}>
                      freecourse.iodacademy.id/verify/{certId}
                    </Link>
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className={styles.successActions}>
                <a href="#" className="btn btn-primary btn-lg w-full">
                  📥 Download Sertifikat (PDF)
                </a>
                <button
                  className="btn btn-secondary w-full"
                  onClick={() => router.push("/learn/bonus")}
                >
                  📚 Pilih Kursus Tambahan (Gratis!)
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
