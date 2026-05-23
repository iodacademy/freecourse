"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import styles from "./page.module.css";
import { GraduationCap, Trophy, Loader2, AlertCircle, ExternalLink } from "lucide-react";

interface EnrollmentData {
  id: string;
  courseId: string;
  channelSource?: string;
  certificateClaimed: boolean;
  certificateId?: string;
  certificateClaimedAt?: string;
  bonusCourseRedeemCode?: string;
  stepProgress?: Record<string, any>;
  currentStep?: number;
}

interface CourseStep {
  id: string;
  title: string;
  order: number;
  hasAssessment?: boolean;
  hasSurvey?: boolean;
}

export default function CertificatePage() {
  const { user, profile } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [enrollment, setEnrollment] = useState<EnrollmentData | null>(null);
  const [courseSteps, setCourseSteps] = useState<CourseStep[]>([]);
  const [courseName, setCourseName] = useState("Kursus Literasi Finansial");
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState("");
  const [certId, setCertId] = useState("");
  const [copiedId, setCopiedId] = useState(false);

  // Fetch enrollment & course steps
  useEffect(() => {
    if (!user) return;

    async function load() {
      try {
        const idToken = await user!.getIdToken();

        // 1. Get enrollments
        const enrollRes = await fetch("/api/enrollments", {
          headers: { Authorization: `Bearer ${idToken}` },
          cache: "no-store",
        });
        if (!enrollRes.ok) throw new Error("Gagal memuat enrollment");
        const enrollments: EnrollmentData[] = await enrollRes.json();
        const main = enrollments.find((e) => e.courseId === "course-main");
        if (!main) {
          router.push("/learn");
          return;
        }
        setEnrollment(main);

        // Jika sudah diklaim sebelumnya, langsung set certId
        if (main.certificateClaimed && main.certificateId) {
          setCertId(main.certificateId);
        }

        // 2. Get course steps
        const courseRes = await fetch("/api/courses/main", {
          headers: { Authorization: `Bearer ${idToken}` },
          cache: "no-store",
        });
        if (courseRes.ok) {
          const courseData = await courseRes.json();
          setCourseSteps(courseData.steps || []);
          setCourseName(courseData.title || "Kursus Literasi Finansial");
        }
      } catch (e) {
        console.error("[CertificatePage]", e);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [user, router]);

  // Hitung berapa step yang sudah selesai
  const completedSteps = courseSteps.filter((step) => {
    const prog = enrollment?.stepProgress?.[step.id];
    if (!prog) return false;
    // Dianggap selesai jika video ditonton (videoWatched) atau ada assessmentResult/surveyResult
    return prog.videoWatched || prog.assessmentResult || prog.surveyResult || prog.completed;
  }).length;

  const totalSteps = courseSteps.length;
  const isAllCompleted = totalSteps > 0 && completedSteps >= totalSteps;
  const isClaimed = enrollment?.certificateClaimed && !!certId;

  async function handleClaim() {
    if (!user || !enrollment) return;
    setClaiming(true);
    setClaimError("");

    try {
      const idToken = await user.getIdToken();
      const res = await fetch(`/api/enrollments/${enrollment.id}/claim-cert`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({}),
      });

      const data = await res.json();

      if (!res.ok) {
        setClaimError(data.error || "Gagal mengklaim sertifikat. Coba lagi.");
        return;
      }

      setCertId(data.certId);
      setEnrollment((prev) =>
        prev ? { ...prev, certificateClaimed: true, certificateId: data.certId } : prev
      );
    } catch {
      setClaimError("Terjadi kesalahan. Periksa koneksi dan coba lagi.");
    } finally {
      setClaiming(false);
    }
  }

  function copyId() {
    navigator.clipboard.writeText(certId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  }

  const userName =
    profile?.profileData?.namaLengkap || profile?.displayName || "Peserta";

  if (loading) {
    return (
      <ProtectedRoute>
        <div className={styles.wrapper}>
          <div className={`container ${styles.content}`}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, paddingTop: 64 }}>
              <Loader2 size={40} className="animate-spin" style={{ color: "var(--color-primary)" }} />
              <p style={{ color: "var(--color-gray-500)" }}>Memuat data sertifikat...</p>
            </div>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className={styles.wrapper}>
        <div className={`container ${styles.content}`}>

          {/* ── BELUM SELESAI SEMUA MODUL ── */}
          {!isAllCompleted && !isClaimed && (
            <div className={styles.incompleteCard}>
              <div className={styles.iconCircle}>
                <span className={styles.incompleteIcon}>
                  <GraduationCap size={36} style={{ color: "var(--color-primary)" }} />
                </span>
              </div>
              <h2>Belum Bisa Klaim Sertifikat</h2>
              <p>
                Kamu perlu menyelesaikan semua materi terlebih dahulu. Saat ini
                sudah{" "}
                <strong>
                  {completedSteps} dari {totalSteps}
                </strong>{" "}
                langkah selesai.
              </p>
              <div className={styles.progressBarLg}>
                <div
                  className={styles.progressFillLg}
                  style={{
                    width: `${totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0}%`,
                  }}
                />
              </div>
              <Link href="/learn" className="btn btn-primary">
                Lanjutkan Belajar
              </Link>
            </div>
          )}

          {/* ── SEMUA SELESAI, BELUM KLAIM ── */}
          {(isAllCompleted || (totalSteps === 0 && !loading)) && !isClaimed && (
            <div className={styles.claimCard}>
              <div className={styles.claimHeader}>
                <Trophy size={56} style={{ color: "var(--color-primary)", marginBottom: 16 }} />
                <h1>Selamat, {userName}!</h1>
                <p>
                  Kamu telah menyelesaikan seluruh materi{" "}
                  <strong>{courseName}</strong>. Klaim sertifikat resmimu sekarang!
                </p>
              </div>

              {/* Preview Sertifikat */}
              <div className={styles.certPreview}>
                <div className={styles.certCard}>
                  <div className={styles.certBorder}>
                    <div className={styles.certInner}>
                      <span className={styles.certLogo}>IODA Academy × Plan Indonesia</span>
                      <p className={styles.certLabel}>SERTIFIKAT PENYELESAIAN</p>
                      <h2 className={styles.certName}>{userName}</h2>
                      <p className={styles.certDesc}>Telah berhasil menyelesaikan kursus</p>
                      <p className={styles.certCourse}>{courseName}</p>
                      <div className={styles.certMeta}>
                        <span>Menunggu ID...</span>
                        <span>
                          {new Date().toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {claimError && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 8,
                  background: "#fff0f0", border: "1px solid #ffcccc",
                  borderRadius: 8, padding: "12px 16px", marginBottom: 16,
                  color: "var(--color-primary)", fontSize: 14,
                }}>
                  <AlertCircle size={16} />
                  {claimError}
                </div>
              )}

              <button
                className="btn btn-primary btn-lg w-full"
                onClick={handleClaim}
                disabled={claiming}
              >
                {claiming ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Membuat Sertifikat...
                  </>
                ) : (
                  <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                    <GraduationCap size={20} />
                    Klaim Sertifikat Sekarang
                  </span>
                )}
              </button>

              {claiming && (
                <p className={styles.claimNote}>
                  Sedang membuat sertifikat... Mohon jangan tutup halaman ini.
                </p>
              )}
            </div>
          )}

          {/* ── SUDAH DIKLAIM ── */}
          {isClaimed && (
            <div className={styles.successCard}>
              <div className={styles.confetti}>🎉</div>
              <h1 className={styles.successTitle}>Sertifikat Berhasil Diklaim!</h1>
              <p className={styles.successSubtitle}>
                Sertifikat digital kamu sudah tercatat. ID sertifikat bisa digunakan untuk verifikasi.
              </p>

              {/* Cert Info */}
              <div className={styles.certInfo}>
                <div className={styles.certInfoRow}>
                  <span className={styles.certInfoLabel}>ID Sertifikat</span>
                  <span className={styles.certInfoValue} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    {certId}
                    <button
                      onClick={copyId}
                      style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "var(--color-primary)" }}
                    >
                      {copiedId ? "✓ Tersalin" : "Salin"}
                    </button>
                  </span>
                </div>
                <div className={styles.certInfoRow}>
                  <span className={styles.certInfoLabel}>Nama</span>
                  <span className={styles.certInfoValue}>{userName}</span>
                </div>
                <div className={styles.certInfoRow}>
                  <span className={styles.certInfoLabel}>Kursus</span>
                  <span className={styles.certInfoValue}>{courseName}</span>
                </div>
                <div className={styles.certInfoRow}>
                  <span className={styles.certInfoLabel}>Verifikasi</span>
                  <span className={styles.certInfoValue}>
                    <Link href={`/verify/${certId}`} className={styles.verifyLink} target="_blank">
                      Cek Sertifikat <ExternalLink size={10} style={{ verticalAlign: "middle" }} />
                    </Link>
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className={styles.successActions}>
                <Link href={`/verify/${certId}`} className="btn btn-primary btn-lg w-full" target="_blank">
                  <ExternalLink size={16} />
                  Lihat & Verifikasi Sertifikat
                </Link>

                {/* Tombol Beasiswa Bonus — hanya untuk channel beasiswa dan belum pernah redeem */}
                {enrollment?.channelSource === "beasiswa" && !enrollment?.bonusCourseRedeemCode && (
                  <button
                    className="btn btn-secondary w-full"
                    onClick={() => router.push("/learn/bonus")}
                  >
                    🎁 Pilih Kursus Tambahan Gratis!
                  </button>
                )}

                {/* Kalau sudah pernah redeem, tampilkan kodenya */}
                {enrollment?.channelSource === "beasiswa" && enrollment?.bonusCourseRedeemCode && (
                  <div style={{
                    background: "var(--color-primary-50)", border: "1px solid var(--color-primary-200)",
                    borderRadius: 8, padding: "12px 16px", fontSize: 14, textAlign: "left",
                  }}>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>Kode Kursus Tambahan Kamu:</div>
                    <code style={{ fontSize: 18, fontWeight: 800, color: "var(--color-primary)", letterSpacing: 1 }}>
                      {enrollment.bonusCourseRedeemCode}
                    </code>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    </ProtectedRoute>
  );
}
