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
  waGroupLink?: string;
  beasiswaType?: string;
  eventId?: string;
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
  const [editNameOpen, setEditNameOpen] = useState(false);
  const [editNameInput, setEditNameInput] = useState("");
  const [editNameSaving, setEditNameSaving] = useState(false);
  const [editNameError, setEditNameError] = useState("");

  // Konfirmasi nama sebelum klaim
  const [certName, setCertName] = useState("");

  // Modal pilih kategori kursus (khusus kemitraan)
  const [catModalOpen, setCatModalOpen] = useState(false);

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

        // Auto-sync beasiswaType dan generate redeem code jika missing
        if (main.channelSource === "beasiswa" && main.eventId && (!main.beasiswaType || !main.bonusCourseRedeemCode)) {
          try {
            const reclaimRes = await fetch(`/api/enrollments/${main.id}/claim-cert`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
              body: JSON.stringify({ reclaim: true })
            });
            if (reclaimRes.ok) {
              const freshRes = await fetch("/api/enrollments", { headers: { Authorization: `Bearer ${idToken}` }});
              const freshData = await freshRes.json();
              const freshMain = freshData.find((e: any) => e.courseId === "course-main");
              if (freshMain) {
                setEnrollment(freshMain);
                Object.assign(main, freshMain); // update current reference just in case
              }
            }
          } catch (err) {
            console.error("Auto-sync claim-cert failed", err);
          }
        }

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
    const digitsOnly = certName.replace(/\D/g, "");
    if (digitsOnly.length >= 8 || (certName.match(/[a-zA-ZÀ-ɏ]/g) || []).length < 2) {
      setClaimError("Nama tidak valid. Isi nama lengkap sesuai KTP (huruf), bukan NIK/nomor.");
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
        prev ? { 
          ...prev, 
          certificateClaimed: true, 
          certificateId: data.certId,
          bonusCourseRedeemCode: data.redeemCode || prev.bonusCourseRedeemCode,
          waGroupLink: data.waGroupLink || prev.waGroupLink,
          beasiswaType: data.beasiswaType || prev.beasiswaType
        } : prev
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

  // ── Edit Nama ──
  async function handleEditName() {
    if (!user || !enrollment || !editNameInput.trim()) return;
    // Tolak nama berisi NIK/angka sebelum kirim ke server (cocok dgn validasi backend).
    const digitsOnly = editNameInput.replace(/\D/g, "");
    if (digitsOnly.length >= 8 || (editNameInput.match(/[a-zA-ZÀ-ɏ]/g) || []).length < 2) {
      setEditNameError("Nama tidak valid. Isi nama lengkap sesuai KTP (huruf), bukan NIK/nomor.");
      return;
    }
    setEditNameSaving(true);
    setEditNameError("");
    try {
      const idToken = await user.getIdToken();
      const res = await fetch(`/api/enrollments/${enrollment.id}/claim-cert`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ customName: editNameInput.trim(), reclaim: true }),
      });
      const data = await res.json();
      if (!res.ok) { setEditNameError(data.error || "Gagal menyimpan"); return; }
      setCertId(data.certId);
      if (data.driveUrl) setDriveUrl(data.driveUrl);
      setCertName(editNameInput.trim());
      setEnrollment((prev: any) => prev ? { 
        ...prev, 
        certificateId: data.certId, 
        certificateDriveUrl: data.driveUrl || prev.certificateDriveUrl,
        bonusCourseRedeemCode: data.redeemCode || prev.bonusCourseRedeemCode,
        waGroupLink: data.waGroupLink || prev.waGroupLink,
        beasiswaType: data.beasiswaType || prev.beasiswaType
      } : prev);
      setEditNameOpen(false);
      setEditNameInput("");
    } catch {
      setEditNameError("Terjadi kesalahan. Coba lagi.");
    } finally {
      setEditNameSaving(false);
    }
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
      setEnrollment((prev: any) => prev ? { 
        ...prev, 
        certificateId: data.certId, 
        certificateDriveUrl: data.driveUrl || prev.certificateDriveUrl,
        bonusCourseRedeemCode: data.redeemCode || prev.bonusCourseRedeemCode,
        waGroupLink: data.waGroupLink || prev.waGroupLink,
        beasiswaType: data.beasiswaType || prev.beasiswaType
      } : prev);

      setReclaimStep(2);
      await new Promise(r => setTimeout(r, 1500));
      setReclaimOpen(false);
    } catch {
      setReclaimStep(-1);
      setReclaimError("Terjadi kesalahan. Coba lagi.");
    }
  }



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

              {/* Kotak konfirmasi nama — nama INI yang akan tercetak di sertifikat */}
              <div style={{ marginTop: 20, textAlign: "left" }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                  Nama untuk Sertifikat
                </label>
                <input
                  type="text"
                  value={certName}
                  onChange={(e) => { setCertName(e.target.value); if (claimError) setClaimError(""); }}
                  placeholder="Nama lengkap sesuai KTP"
                  disabled={claiming}
                  style={{
                    width: "100%", padding: "10px 14px", borderRadius: 10,
                    border: "1.5px solid #ddd", fontSize: 15, outline: "none", boxSizing: "border-box",
                  }}
                />
                <p style={{ fontSize: 12, color: "#888", marginTop: 6, lineHeight: 1.5 }}>
                  Pastikan nama sudah benar — nama ini akan tercetak di sertifikat dan sulit diubah massal nanti.
                </p>
              </div>

              {claimError && (
                <div className="cert-error" style={{ marginTop: 12 }}>
                  <AlertCircle size={14} />{claimError}
                </div>
              )}

              <button
                className="cert-claim-btn"
                disabled={claiming || !certName.trim()}
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

              {/* Certificate Preview — click to download PDF */}
              <div className="cert-preview" style={{ cursor: driveUrl ? "pointer" : "default" }} onClick={async () => {
                if (!driveUrl) return;
                // Check if file still exists by trying to fetch it
                try {
                  // Convert /view to /export?format=pdf for direct download
                  const fileId = driveUrl.match(/\/d\/([^/]+)/)?.[1];
                  if (fileId) {
                    const downloadLink = `https://drive.google.com/uc?export=download&id=${fileId}`;
                    window.open(downloadLink, "_blank");
                  } else {
                    window.open(driveUrl, "_blank");
                  }
                } catch {
                  alert("File sertifikat sudah tidak tersedia. Silahkan klaim ulang sertifikat kamu.");
                }
              }}>
                <div className="cert-preview-img-wrap">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/images/certificate-template.png" alt="Sertifikat" className="cert-preview-img" />
                  <div className="cert-preview-name">{userName}</div>
                  {driveUrl && (
                    <div className="cert-download-overlay">
                      <span>📥 Klik untuk Download PDF</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Cert Info */}
              <div className="cert-info">
                <div className="cert-info-row">
                  <span className="cert-info-label">Verifikasi</span>
                  <span className="cert-info-value" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <a
                      href={`/verify/${certId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "var(--color-primary)", fontWeight: 600, textDecoration: "underline" }}
                    >
                      Cek Keaslian
                    </a>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const url = `${window.location.origin}/verify/${certId}`;
                        navigator.clipboard.writeText(url);
                        setCopiedId(true);
                        setTimeout(() => setCopiedId(false), 2000);
                      }}
                      style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: copiedId ? "#15803d" : "var(--color-primary)", fontWeight: 600 }}
                    >
                      {copiedId ? "✓ Tersalin" : "📋 Copy Link"}
                    </button>
                  </span>
                </div>
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


              {/* Actions */}
              <div className="cert-actions">
                {/* Edit Nama — selalu tampil */}
                <button
                  className="cert-edit-name-btn"
                  onClick={() => { setEditNameInput(userName); setEditNameOpen(true); setEditNameError(""); }}
                >
                  ✏️ Ubah Nama di Sertifikat
                </button>

                {/* Tombol Review Materi */}
                <button
                  className="cert-edit-name-btn"
                  style={{ marginTop: 10, background: "transparent", color: "var(--color-primary)", border: "1.5px solid var(--color-primary)" }}
                  onClick={() => router.push("/learn/1")}
                >
                  📖 Review Materi
                </button>

                {/* Tombol Pilih Benefit — untuk SEMUA jalur yang punya enrollment
                    dan belum memilih benefit apa pun (redeem code / beasiswaType). */}
                {!!enrollment?.channelSource && !enrollment?.beasiswaType && !enrollment?.bonusCourseRedeemCode && (
                  <button
                    className="btn btn-secondary w-full"
                    onClick={() => setCatModalOpen(true)}
                  >
                    🎁 Pilih Benefit Gratis!
                  </button>
                )}

                {/* Sudah pilih benefit dengan redeem code (vl/bootcamp) */}
                {!!enrollment?.channelSource && enrollment?.beasiswaType !== "wpb" && enrollment?.beasiswaType !== "bootcamp" && enrollment?.beasiswaType !== "workshop" && enrollment?.bonusCourseRedeemCode && (
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

                {/* WPB / Bootcamp — kode redeem + grup WA */}
                {(enrollment?.beasiswaType === "wpb" || enrollment?.beasiswaType === "bootcamp") && enrollment?.bonusCourseRedeemCode && (
                  <div style={{
                    background: "#f0fdf4", border: "1px solid #16a34a",
                    borderRadius: 8, padding: "16px", fontSize: 14, textAlign: "left", display: "flex", flexDirection: "column", gap: 12
                  }}>
                    <h3 style={{ margin: 0, color: "#166534", fontSize: 16 }}>Akses {enrollment.beasiswaType === "wpb" ? "WPB" : "Bootcamp"} Kamu! 🎉</h3>
                    <div>
                      <div style={{ fontWeight: 600, marginBottom: 4, color: "#166534" }}>Kode Redeem:</div>
                      <code style={{ fontSize: 20, fontWeight: 800, color: "#15803d", letterSpacing: 1 }}>
                        {enrollment.bonusCourseRedeemCode}
                      </code>
                    </div>
                    {enrollment.waGroupLink && (
                      <a
                        href={enrollment.waGroupLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: "inline-block", background: "#25D366", color: "#fff",
                          padding: "10px 16px", borderRadius: 8, fontWeight: 600, textAlign: "center", textDecoration: "none"
                        }}
                      >
                        📱 Bergabung ke Grup WhatsApp
                      </a>
                    )}
                  </div>
                )}

                {/* Benefit lain (Workshop / Review CV / Downloadable) sudah dipilih */}
                {(enrollment?.beasiswaType === "workshop" || enrollment?.beasiswaType === "review_cv" || enrollment?.beasiswaType === "downloadable") && (
                  <div style={{
                    background: "#f0fdf4", border: "1px solid #16a34a",
                    borderRadius: 8, padding: "16px", fontSize: 14, textAlign: "left", display: "flex", flexDirection: "column", gap: 10
                  }}>
                    <h3 style={{ margin: 0, color: "#166534", fontSize: 16 }}>
                      {enrollment.beasiswaType === "workshop" && "Kamu terdaftar di Workshop! 🎉"}
                      {enrollment.beasiswaType === "review_cv" && "CV kamu sudah dikirim! ✅"}
                      {enrollment.beasiswaType === "downloadable" && "Benefit kamu sudah aktif! 🎁"}
                    </h3>
                    <p style={{ margin: 0, color: "#166534" }}>
                      {enrollment.beasiswaType === "workshop" && "Detail & link sudah dikirim ke email kamu."}
                      {enrollment.beasiswaType === "review_cv" && "Tim kami akan mereview CV kamu. Pantau email untuk hasilnya."}
                      {enrollment.beasiswaType === "downloadable" && "Buka /learn/bonus untuk mengunduh kembali."}
                    </p>
                    {enrollment.beasiswaType === "workshop" && enrollment.waGroupLink && (
                      <a
                        href={enrollment.waGroupLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: "inline-block", background: "#25D366", color: "#fff",
                          padding: "10px 16px", borderRadius: 8, fontWeight: 600, textAlign: "center", textDecoration: "none"
                        }}
                      >
                        📱 Bergabung ke Grup WhatsApp
                      </a>
                    )}
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

      {/* ✏️ Edit Nama Modal */}
      {editNameOpen && (
        <div className="ccm-overlay" onClick={() => !editNameSaving && setEditNameOpen(false)}>
          <div className="ccm-modal" onClick={e => e.stopPropagation()}>
            <h3 className="ccm-title">✏️ Ubah Nama di Sertifikat</h3>
            <p style={{ fontSize: 13, color: "#666", marginBottom: 16, lineHeight: 1.5 }}>
              Nama ini akan tercetak di sertifikat kamu. Pastikan sesuai KTP.
            </p>
            <input
              type="text"
              value={editNameInput}
              onChange={e => setEditNameInput(e.target.value)}
              placeholder="Nama lengkap sesuai KTP"
              disabled={editNameSaving}
              style={{
                width: "100%", padding: "10px 14px", borderRadius: 10,
                border: "1.5px solid #ddd", fontSize: 15, marginBottom: 12,
                outline: "none", boxSizing: "border-box",
              }}
            />
            {editNameError && <p style={{ color: "var(--color-primary)", fontSize: 13, marginBottom: 8 }}>{editNameError}</p>}
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setEditNameOpen(false)}
                disabled={editNameSaving}
                style={{ flex: 1, padding: "10px", borderRadius: 10, border: "1.5px solid #ddd", background: "none", cursor: "pointer", fontSize: 14 }}
              >
                Batal
              </button>
              <button
                onClick={handleEditName}
                disabled={editNameSaving || !editNameInput.trim()}
                className="cert-reclaim-btn"
                style={{ flex: 2 }}
              >
                {editNameSaving ? "⏳ Menyimpan..." : "✅ Simpan & Generate Ulang"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🎓 Pilih Kategori Bonus Modal (Kemitraan) */}
      {catModalOpen && (
        <div className="ccm-overlay" onClick={() => setCatModalOpen(false)}>
          <div className="ccm-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 500, width: '90%', padding: 24 }}>
            <h3 className="ccm-title" style={{ textAlign: "left", marginBottom: 8, fontSize: 20 }}>Pilih Kategori Kursus</h3>
            <p style={{ fontSize: 14, color: "#666", marginBottom: 20, lineHeight: 1.5, textAlign: "left" }}>
              Kamu bebas memilih salah satu program berikut. Pilihlah dengan bijak karena program hanya dapat dipilih 1 kali.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { cat: "workshop", emoji: "🎤", title: "Workshop", desc: "Ikuti workshop online bersama mentor. Detail & link dikirim ke email kamu." },
                { cat: "bootcamp", emoji: "🚀", title: "Specialized Bootcamp", desc: "Pelatihan intensif dengan mentor. Dapatkan sertifikat kompetensi resmi dari ioda academy." },
                { cat: "vl", emoji: "🎥", title: "Video Learning", desc: "Akses modul video rekaman yang bisa kamu pelajari kapan saja secara mandiri." },
                { cat: "lainnya", emoji: "🎁", title: "Bonus Lainnya", desc: "Review CV, e-book, template, dan konten bermanfaat lainnya." },
              ].map((opt) => (
                <button
                  key={opt.cat}
                  onClick={() => router.push(`/learn/bonus?cat=${opt.cat}`)}
                  style={{
                    display: "flex", flexDirection: "column", alignItems: "flex-start", textAlign: "left",
                    padding: 16, borderRadius: 12, border: "1.5px solid #e5e7eb", background: "#fff", cursor: "pointer", transition: "all 0.2s"
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.borderColor = "var(--color-primary)")}
                  onMouseOut={(e) => (e.currentTarget.style.borderColor = "#e5e7eb")}
                >
                  <strong style={{ fontSize: 16, color: "#111", marginBottom: 4 }}>{opt.emoji} {opt.title}</strong>
                  <span style={{ fontSize: 13, color: "#555", lineHeight: 1.4 }}>{opt.desc}</span>
                </button>
              ))}
            </div>

            <button
              onClick={() => setCatModalOpen(false)}
              style={{ width: "100%", padding: "12px", borderRadius: 10, background: "#f3f4f6", border: "none", color: "#444", fontWeight: 600, marginTop: 20, cursor: "pointer" }}
            >
              Batal
            </button>
          </div>
        </div>
      )}


    </>
  );
}
