"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { useLearnLoading } from "@/contexts/LearnLoadingContext";
import { GraduationCap, Trophy, Loader2, AlertCircle } from "lucide-react";

interface EnrollmentData {
  id: string;
  courseId: string;
  channelSource?: string;
  certificateClaimed: boolean;
  certificateId?: string;
  certificateClaimedAt?: any;
  certificateDriveUrl?: string;
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
  const [driveUrl, setDriveUrl] = useState("");
  const [reclaimOpen, setReclaimOpen] = useState(false);
  const [reclaimStep, setReclaimStep] = useState(0);
  const [reclaimError, setReclaimError] = useState("");

  // Konfirmasi nama sebelum klaim
  const [certName, setCertName] = useState("");

  // Fetch enrollment & course steps
  useEffect(() => {
    if (!user) return;

    async function load() {
      try {
        const idToken = await user!.getIdToken();

        // 1. Get enrollments
        // Parallel fetch: enrollment + course data
        const [enrollRes, courseRes] = await Promise.all([
          fetch("/api/enrollments", {
            headers: { Authorization: `Bearer ${idToken}` },
          }),
          fetch("/api/courses/main", {
            headers: { Authorization: `Bearer ${idToken}` },
          }),
        ]);

        if (!enrollRes.ok) throw new Error("Gagal memuat enrollment");
        const enrollments: EnrollmentData[] = await enrollRes.json();
        const main = enrollments.find((e) => e.courseId === "course-main");
        if (!main) {
          router.push("/learn");
          return;
        }

        // Belum klaim → tidak boleh akses halaman ini
        if (!main.certificateClaimed || !main.certificateId) {
          router.push("/learn");
          return;
        }

        setEnrollment(main);
        setCertId(main.certificateId);
        if (main.certificateDriveUrl) setDriveUrl(main.certificateDriveUrl);

        if (courseRes.ok) {
          const courseData = await courseRes.json();
          setCourseSteps(courseData.steps || []);
          setCourseName(
            courseData.course?.mainCertTitle || 
            courseData.course?.title || 
            "Kursus Literasi Finansial"
          );
        }
      } catch (e) {
        console.error("[CertificatePage]", e);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [user, router]);

  // Pre-fill certName dari profil
  useEffect(() => {
    if (profile && !certName) {
      setCertName(
        profile.profileData?.namaLengkap || profile.displayName || ""
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  // Hitung berapa step yang sudah selesai
  const completedSteps = courseSteps.filter((step) => {
    const prog = enrollment?.stepProgress?.[step.id];
    if (!prog) return false;
    return prog.videoWatched || prog.assessmentResult || prog.surveyResult || prog.completed;
  }).length;

  const totalSteps = courseSteps.length;
  const isAllCompleted = totalSteps > 0 && completedSteps >= totalSteps;
  const isClaimed = enrollment?.certificateClaimed && !!certId;

  async function handleClaim() {
    if (!user || !enrollment) return;
    if (!certName.trim()) {
      setClaimError("Nama tidak boleh kosong.");
      return;
    }
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
        body: JSON.stringify({ customName: certName.trim() }),
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

  // ── Klaim Ulang ──
  async function handleReclaim() {
    if (!user || !enrollment) return;
    setReclaimOpen(true);
    setReclaimStep(0);
    setReclaimError("");

    try {
      await new Promise(r => setTimeout(r, 500));
      setReclaimStep(1);

      const idToken = await user.getIdToken();
      const res = await fetch(`/api/enrollments/${enrollment.id}/claim-cert`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ customName: certName.trim() || undefined, reclaim: true }),
      });
      const data = await res.json();

      if (!res.ok) {
        setReclaimStep(-1);
        setReclaimError(data.error || "Gagal generate ulang sertifikat");
        return;
      }

      setCertId(data.certId);
      if (data.driveUrl) setDriveUrl(data.driveUrl);
      setEnrollment((prev: any) => prev ? { ...prev, certificateId: data.certId, certificateDriveUrl: data.driveUrl || prev.certificateDriveUrl } : prev);

      setReclaimStep(2);
      await new Promise(r => setTimeout(r, 1500));
      setReclaimOpen(false);
    } catch {
      setReclaimStep(-1);
      setReclaimError("Terjadi kesalahan. Coba lagi.");
    }
  }

  // Calculate days remaining
  function getDaysRemaining(): number | null {
    const claimedAt = enrollment?.certificateClaimedAt;
    if (!claimedAt) return null;
    const claimedDate = typeof claimedAt === 'object' && claimedAt._seconds
      ? new Date(claimedAt._seconds * 1000)
      : new Date(claimedAt);
    if (isNaN(claimedDate.getTime())) return null;
    const expiresAt = new Date(claimedDate.getTime() + 5 * 24 * 60 * 60 * 1000);
    const remaining = Math.ceil((expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
    return remaining;
  }

  const daysRemaining = getDaysRemaining();

  const userName =
    profile?.profileData?.namaLengkap || profile?.displayName || "Peserta";

  const today = new Date().toLocaleDateString("id-ID", {
    day: "numeric", month: "long", year: "numeric",
  });

  // Beritahu layout bahwa konten siap
  const { signalReady } = useLearnLoading();
  useEffect(() => {
    if (!loading) signalReady();
  }, [loading, signalReady]);

  if (loading) return null;

  return (
    <>
      <div className="cert-wrapper">
        <div className="cert-content">

          {/* ── BELUM SELESAI SEMUA MODUL ── */}
          {!isAllCompleted && !isClaimed && (
            <div className="cert-incomplete">
              <span className="cert-incomplete-icon">
                <GraduationCap size={36} style={{ color: "var(--color-primary)" }} />
              </span>
              <h2>Belum Bisa Klaim Sertifikat</h2>
              <p>
                Kamu perlu menyelesaikan semua materi terlebih dahulu. Saat ini
                sudah{" "}
                <strong>
                  {completedSteps} dari {totalSteps}
                </strong>{" "}
                langkah selesai.
              </p>
              <div className="cert-progress-lg">
                <div
                  className="cert-progress-fill"
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

          {/* ── SEMUA SELESAI: KLAIM SERTIFIKAT ── */}
          {(isAllCompleted || (totalSteps === 0 && !loading)) && !isClaimed && (
            <div className="cert-claim">
              <div className="cert-claim-header">
                <h1>Selamat, {userName}!</h1>
                <p>
                  Kamu telah menyelesaikan seluruh materi modul <strong>{courseName}</strong>.
                  Klik tombol di bawah untuk mengklaim sertifikatmu.
                </p>
              </div>

              {claimError && (
                <div className="cert-error">
                  <AlertCircle size={14} />{claimError}
                </div>
              )}

              <button
                className="cert-claim-btn"
                disabled={claiming}
                onClick={handleClaim}
                style={{ marginTop: 16 }}
              >
                {claiming ? <Loader2 size={18} className="animate-spin" /> : <GraduationCap size={18} />}
                {claiming ? "Memproses..." : "Klaim Sertifikat"}
              </button>
            </div>
          )}

          {/* ── SUDAH DIKLAIM ── */}
          {isClaimed && (
            <div className="cert-success">
              <div className="cert-confetti">🎉</div>
              <h1 className="cert-success-title">Sertifikat Berhasil Diklaim!</h1>
              <p className="cert-success-sub">
                Sertifikat digital kamu sudah tercatat. ID sertifikat bisa digunakan untuk verifikasi.
              </p>

              {/* Certificate Preview */}
              <div className="cert-preview">
                <div className="cert-preview-img-wrap">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/images/certificate-template.png" alt="Sertifikat" className="cert-preview-img" />
                  <div className="cert-preview-name">{userName}</div>
                </div>
              </div>

              {/* Cert Info */}
              <div className="cert-info">
                <div className="cert-info-row">
                  <span className="cert-info-label">Verifikasi</span>
                  <span className="cert-info-value">
                    <a
                      href={`/verify/${certId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "var(--color-primary)", fontWeight: 600, textDecoration: "underline" }}
                    >
                      Cek Keaslian Sertifikat
                    </a>
                  </span>
                </div>
                {driveUrl && (
                  <div className="cert-info-row">
                    <span className="cert-info-label">File Sertifikat</span>
                    <span className="cert-info-value">
                      <a href={driveUrl} target="_blank" rel="noopener noreferrer" className="cert-drive-link">
                        📄 Buka di Google Drive
                      </a>
                    </span>
                  </div>
                )}
                <div className="cert-info-row">
                  <span className="cert-info-label">Nama</span>
                  <span className="cert-info-value">{userName}</span>
                </div>
                <div className="cert-info-row">
                  <span className="cert-info-label">Program</span>
                  <span className="cert-info-value">Modul Financial Literacy and Job Readiness</span>
                </div>
                <div className="cert-info-row">
                  <span className="cert-info-label">Penyelenggara</span>
                  <span className="cert-info-value">DBS Foundation & Plan Indonesia</span>
                </div>
              </div>

              {/* 5-day notice */}
              <div className="cert-expiry-notice">
                <div>
                  <p className="cert-expiry-text">
                    File sertifikat disimpan di server selama <strong>5 hari</strong>.
                    {daysRemaining !== null && daysRemaining > 0 && (
                      <> Sisa: <strong>{daysRemaining} hari</strong>.</>
                    )}
                    {daysRemaining !== null && daysRemaining <= 0 && (
                      <> File sudah dihapus otomatis.</>
                    )}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="cert-actions">
                {daysRemaining !== null && daysRemaining <= 0 && (
                  <button
                    className="cert-reclaim-btn"
                    onClick={handleReclaim}
                    disabled={claiming}
                  >
                    Klaim Ulang Sertifikat
                  </button>
                )}

                {/* Tombol Beasiswa Bonus */}
                {enrollment?.channelSource === "beasiswa" && !enrollment?.bonusCourseRedeemCode && (
                  <button
                    className="btn btn-secondary w-full"
                    onClick={() => router.push("/learn/bonus")}
                  >
                    🎁 Pilih Kursus Tambahan Gratis!
                  </button>
                )}

                {enrollment?.channelSource === "beasiswa" && enrollment?.bonusCourseRedeemCode && (
                  <div style={{
                    background: "var(--color-bg-accent)", border: "1px solid rgba(204,0,0,0.15)",
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
      {/* ── Reclaim Modal ── */}
      {reclaimOpen && (
        <div className="ccm-overlay">
          <div className="ccm-modal">
            {reclaimStep >= 0 ? (
              <>
                <div className="ccm-icon">
                  {reclaimStep < 2 ? (
                    <div className="ccm-spinner" />
                  ) : (
                    <div className="ccm-check">✓</div>
                  )}
                </div>
                <h3 className="ccm-title">
                  {reclaimStep === 0 && "Menghapus file lama..."}
                  {reclaimStep === 1 && "Membuat sertifikat baru..."}
                  {reclaimStep === 2 && "Sertifikat baru berhasil dibuat! 🎉"}
                </h3>
                <div className="ccm-steps">
                  <div className={`ccm-step ${reclaimStep >= 0 ? 'ccm-step--done' : ''}`}>
                    <span className="ccm-dot">{reclaimStep > 0 ? '✓' : '⏳'}</span>
                    Menghapus file sertifikat lama
                  </div>
                  <div className={`ccm-step ${reclaimStep >= 1 ? (reclaimStep > 1 ? 'ccm-step--done' : 'ccm-step--active') : ''}`}>
                    <span className="ccm-dot">{reclaimStep > 1 ? '✓' : reclaimStep === 1 ? '⏳' : '○'}</span>
                    Generate sertifikat baru
                  </div>
                  <div className={`ccm-step ${reclaimStep >= 2 ? 'ccm-step--done' : ''}`}>
                    <span className="ccm-dot">{reclaimStep >= 2 ? '✓' : '○'}</span>
                    Selesai
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="ccm-icon">
                  <div className="ccm-error-icon">✕</div>
                </div>
                <h3 className="ccm-title" style={{ color: 'var(--color-primary)' }}>Gagal Membuat Ulang</h3>
                <p className="ccm-error-msg">{reclaimError}</p>
                <button className="ccm-retry-btn" onClick={() => setReclaimOpen(false)}>Tutup</button>
              </>
            )}
          </div>
        </div>
      )}

    </>
  );
}
