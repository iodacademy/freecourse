"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { GraduationCap, Award, CheckCircle, Loader2, Lock } from "lucide-react";

function getInitials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0] || "").join("").toUpperCase();
}

function getAge(ttlStr: string): string {
  if (!ttlStr) return "—";
  const d = new Date(ttlStr + "T00:00:00");
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  if (today.getMonth() < d.getMonth() || (today.getMonth() === d.getMonth() && today.getDate() < d.getDate())) age--;
  const formatted = d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  return `${formatted} (${age} tahun)`;
}

interface EnrollmentInfo {
  id: string;
  courseId: string;
  channelSource?: string;
  certificateClaimed: boolean;
  certificateId?: string;
  certificateDriveUrl?: string;
  workshopCertificateClaimed?: boolean;
  workshopCertificateId?: string;
  workshopCertificateDriveUrl?: string;
  currentStep?: number;
  totalSteps?: number;
  status?: "enrolled" | "in_progress" | "completed" | "certified";
}

interface ProfileDrawerProps {
  open: boolean;
  onClose: () => void;
}

export default function ProfileDrawer({ open, onClose }: ProfileDrawerProps) {
  const router = useRouter();
  const { user, profile } = useAuth();

  const [enrollment, setEnrollment] = useState<EnrollmentInfo | null>(null);
  const [totalSteps, setTotalSteps] = useState(0);
  const [claimingMain, setClaimingMain] = useState(false);
  const [mainClaimError, setMainClaimError] = useState("");
  const [claimingWorkshop, setClaimingWorkshop] = useState(false);
  const [workshopClaimError, setWorkshopClaimError] = useState("");
  const [workshopClaimed, setWorkshopClaimed] = useState(false);

  // Close on Escape
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // Lock body scroll when open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  // Fetch enrollment data saat drawer dibuka
  useEffect(() => {
    if (!open || !user) return;

    async function loadEnrollment() {
      try {
        const idToken = await user!.getIdToken();
        const [enrollRes, courseRes] = await Promise.all([
          fetch("/api/enrollments", { headers: { Authorization: `Bearer ${idToken}` }, cache: "no-store" }),
          fetch("/api/courses/main", { headers: { Authorization: `Bearer ${idToken}` }, cache: "no-store" }),
        ]);

        if (enrollRes.ok) {
          const enrollments: EnrollmentInfo[] = await enrollRes.json();
          const main = enrollments.find((e) => e.courseId === "course-main");
          if (main) {
            setEnrollment(main);
            setWorkshopClaimed(!!main.workshopCertificateClaimed);
          }
        }

        if (courseRes.ok) {
          const courseData = await courseRes.json();
          setTotalSteps((courseData.steps || []).length);
        }
      } catch {
        // Tidak fatal jika gagal load
      }
    }

    loadEnrollment();
  }, [open, user]);

  const handleClaimMainCert = useCallback(async () => {
    if (!user || !enrollment) return;
    setClaimingMain(true);
    setMainClaimError("");

    const newWindow = window.open('', '_blank');
    if (newWindow) {
      newWindow.document.write(`
        <html>
          <head>
            <title>Memproses Sertifikat...</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
              body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background-color: #f8f9fa; flex-direction: column; text-align: center; color: #333; }
              .loader { border: 4px solid #e0e0e0; border-top: 4px solid #d32f2f; border-radius: 50%; width: 48px; height: 48px; animation: spin 1s linear infinite; margin-bottom: 20px; }
              @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
              h2 { margin: 0 0 10px 0; font-size: 20px; color: #212121; }
              p { margin: 0; color: #666; font-size: 14px; max-width: 300px; line-height: 1.5; }
            </style>
          </head>
          <body>
            <div class="loader"></div>
            <h2>Mohon Menunggu...</h2>
            <p>Sertifikat Anda sedang diproses dan akan segera terbuka.</p>
          </body>
        </html>
      `);
    }

    try {
      const idToken = await user.getIdToken();
      const res = await fetch(`/api/enrollments/${enrollment.id}/claim-cert`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ reclaim: true }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (newWindow) newWindow.close();
        setMainClaimError(data.error || "Gagal mengklaim ulang sertifikat.");
        return;
      }

      setEnrollment((prev) => prev ? {
        ...prev,
        certificateDriveUrl: data.driveUrl,
      } : prev);

      if (data.driveUrl && newWindow) {
        newWindow.location.href = data.driveUrl;
      } else if (newWindow) {
        newWindow.close();
      }
    } catch {
      if (newWindow) newWindow.close();
      setMainClaimError("Terjadi kesalahan. Periksa koneksi internet dan coba lagi.");
    } finally {
      setClaimingMain(false);
    }
  }, [user, enrollment]);

  const handleClaimWorkshopCert = useCallback(async (isReclaim = false) => {
    if (!user || !enrollment) return;
    setClaimingWorkshop(true);
    setWorkshopClaimError("");

    const newWindow = window.open('', '_blank');
    if (newWindow) {
      newWindow.document.write(`
        <html>
          <head>
            <title>Memproses Sertifikat...</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
              body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background-color: #f8f9fa; flex-direction: column; text-align: center; color: #333; }
              .loader { border: 4px solid #e0e0e0; border-top: 4px solid #d32f2f; border-radius: 50%; width: 48px; height: 48px; animation: spin 1s linear infinite; margin-bottom: 20px; }
              @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
              h2 { margin: 0 0 10px 0; font-size: 20px; color: #212121; }
              p { margin: 0; color: #666; font-size: 14px; max-width: 300px; line-height: 1.5; }
            </style>
          </head>
          <body>
            <div class="loader"></div>
            <h2>Mohon Menunggu...</h2>
            <p>Sertifikat Anda sedang diproses dan akan segera terbuka.</p>
          </body>
        </html>
      `);
    }

    try {
      const idToken = await user.getIdToken();
      const res = await fetch(`/api/enrollments/${enrollment.id}/claim-workshop-cert`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ reclaim: isReclaim }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (newWindow) newWindow.close();
        setWorkshopClaimError(data.error || "Gagal mengklaim sertifikat workshop.");
        return;
      }

      setWorkshopClaimed(true);
      setEnrollment((prev) => prev ? {
        ...prev,
        workshopCertificateClaimed: true,
        workshopCertificateId: data.certId,
        workshopCertificateDriveUrl: data.downloadUrl,
      } : prev);

      if (data.downloadUrl && newWindow) {
        newWindow.location.href = data.downloadUrl;
      } else if (newWindow) {
        newWindow.close();
      }
    } catch {
      if (newWindow) newWindow.close();
      setWorkshopClaimError("Terjadi kesalahan. Periksa koneksi internet dan coba lagi.");
    } finally {
      setClaimingWorkshop(false);
    }
  }, [user, enrollment]);

  // Extract data from Firestore profile or fallback to user
  const namaLengkap = profile?.profileData?.namaLengkap || profile?.displayName || user?.displayName || "Pengguna";
  const email = profile?.email || user?.email || "Tidak ada email";
  const photoURL = profile?.photoURL || user?.photoURL || null;
  const partnerCode = profile?.partnerCode || null;
  const channelSource = profile?.channelSource || null;
  const profileData = profile?.profileData || {};

  const jenisKelamin = profileData.jenis_kelamin || "—";
  const tanggalLahir = (Array.isArray(profileData.tanggal_lahir) ? profileData.tanggal_lahir[0] : profileData.tanggal_lahir) || "";
  const whatsapp = profileData.nomor_whatsapp || "—";
  const asalDaerah = typeof profileData.asal_daerah === "object" && profileData.asal_daerah !== null ? profileData.asal_daerah as { province?: string; city?: string } : null;
  const provinsi = asalDaerah?.province || (typeof profileData.asal_daerah === "string" ? profileData.asal_daerah : "—");
  const kota = asalDaerah?.city || "—";
  const disabilitas = profileData.disabilitas || "—";

  const initials = getInitials(namaLengkap);

  // Hitung status sertifikat utama
  const mainCertClaimed = enrollment?.certificateClaimed ?? false;
  const mainCertId = enrollment?.certificateId ?? null;
  const currentStep = enrollment?.currentStep ?? 1;
  const isAllStepsDone =
    enrollment?.status === "completed" ||
    enrollment?.status === "certified" ||
    (totalSteps > 0 && currentStep > totalSteps);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`pd-backdrop ${open ? "pd-backdrop--open" : ""}`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div className={`pd-drawer ${open ? "pd-drawer--open" : ""}`}>
        {/* Cover Banner */}
        <div className="pd-cover">
          <button className="pd-close-btn" onClick={onClose} aria-label="Tutup">
            <svg viewBox="0 0 24 24" fill="none" strokeWidth="2.5" stroke="white">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
          <div className="pd-av-wrap">
            {photoURL ? (
              <Image src={photoURL} alt="Avatar" width={80} height={80} style={{ borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
              <div className="pd-av-initials">{initials}</div>
            )}
            <div className="pd-av-online" />
          </div>
        </div>

        {/* Body */}
        <div className="pd-body">
          <div className="pd-prof-name">{namaLengkap}</div>

          {/* ── SERTIFIKAT SAYA ── tampil di bawah nama ── */}
          {enrollment && (
            <div className="pd-section" style={{ marginTop: 10, marginBottom: 4 }}>
              <div className="pd-section-title">SERTIFIKAT SAYA</div>

              {/* Tombol 1: Sertifikat Kursus Utama */}
              <div style={{ marginBottom: 10 }}>
                <div className="pd-info-lbl" style={{ marginBottom: 6 }}>Sertifikat Financial Literacy</div>
                {mainCertClaimed && mainCertId ? (
                  // Sudah diklaim
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{
                      display: "flex", alignItems: "center", gap: 6,
                      background: "#e8f5e9", border: "1px solid #a5d6a7",
                      borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#2e7d32", fontWeight: 600,
                    }}>
                      <CheckCircle size={14} />
                      Sertifikat sudah diklaim · {mainCertId}
                    </div>
                    {mainClaimError && (
                      <div style={{
                        fontSize: 11, color: "#c62828", background: "#ffebee",
                        border: "1px solid #ef9a9a", borderRadius: 6, padding: "6px 10px",
                      }}>
                        {mainClaimError}
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 8 }}>
                      {enrollment?.certificateDriveUrl && (
                        <button
                          style={{
                            flex: 1, display: "flex", alignItems: "center", gap: 6, justifyContent: "center",
                            fontSize: 13, fontWeight: 600, cursor: "pointer",
                            background: "var(--color-primary)", color: "white", border: "none",
                            borderRadius: 8, padding: "9px 12px", transition: "opacity 0.2s",
                          }}
                          onClick={() => window.open(enrollment.certificateDriveUrl, "_blank")}
                        >
                          <Award size={14} /> Unduh Ulang
                        </button>
                      )}
                      
                      <button
                        style={{
                          flex: 1, display: "flex", alignItems: "center", gap: 6, justifyContent: "center",
                          fontSize: 13, fontWeight: 600, cursor: claimingMain ? "not-allowed" : "pointer",
                          background: "#f8f9fa", color: "var(--color-primary)", border: "1px solid var(--color-primary)",
                          borderRadius: 8, padding: "9px 12px", opacity: claimingMain ? 0.7 : 1,
                          transition: "opacity 0.2s",
                        }}
                        onClick={handleClaimMainCert}
                        disabled={claimingMain}
                      >
                        {claimingMain ? (
                          <><Loader2 size={14} className="animate-spin" />Memproses...</>
                        ) : (
                          <><Award size={14} /> Klaim Ulang</>
                        )}
                      </button>
                    </div>
                  </div>
                ) : isAllStepsDone ? (
                  // Semua materi selesai, belum klaim
                  <button
                    className="btn btn-primary"
                    style={{ width: "100%", display: "flex", alignItems: "center", gap: 6, justifyContent: "center", fontSize: 13 }}
                    onClick={() => { onClose(); router.push("/learn/certificate"); }}
                  >
                    <GraduationCap size={14} />
                    Klaim Sertifikat Sekarang
                  </button>
                ) : (
                  // Belum selesai semua materi
                  <button
                    disabled
                    style={{
                      width: "100%", display: "flex", alignItems: "center", gap: 6, justifyContent: "center",
                      fontSize: 12, opacity: 1, cursor: "not-allowed",
                      background: "#9e9e9e", color: "white", border: "none",
                      borderRadius: 8, padding: "8px 12px", fontWeight: 500,
                    }}
                  >
                    <Lock size={12} />
                    Selesaikan semua materi terlebih dahulu
                  </button>
                )}
              </div>

              {/* Tombol 2: Sertifikat Workshop — hanya untuk channelSource=workshop */}
              {channelSource === "workshop" && (
                <div>
                  <div className="pd-info-lbl" style={{ marginBottom: 6 }}>Sertifikat Kehadiran Workshop</div>
                  {(workshopClaimed || enrollment?.workshopCertificateClaimed) ? (
                    // Sudah diklaim
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={{
                        display: "flex", alignItems: "center", gap: 6,
                        background: "#e8f5e9", border: "1px solid #a5d6a7",
                        borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#2e7d32", fontWeight: 600,
                      }}>
                        <CheckCircle size={14} />
                        Sertifikat workshop sudah diklaim
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        {enrollment?.workshopCertificateDriveUrl && (
                          <button
                            style={{
                              flex: 1, display: "flex", alignItems: "center", gap: 6, justifyContent: "center",
                              fontSize: 13, fontWeight: 600, cursor: "pointer",
                              background: "var(--color-primary)", color: "white", border: "none",
                              borderRadius: 8, padding: "9px 12px", transition: "opacity 0.2s",
                            }}
                            onClick={() => window.open(enrollment.workshopCertificateDriveUrl, "_blank")}
                          >
                            <Award size={14} /> Unduh Ulang
                          </button>
                        )}
                        
                        <button
                          style={{
                            flex: 1, display: "flex", alignItems: "center", gap: 6, justifyContent: "center",
                            fontSize: 13, fontWeight: 600, cursor: claimingWorkshop ? "not-allowed" : "pointer",
                            background: "#f8f9fa", color: "var(--color-primary)", border: "1px solid var(--color-primary)",
                            borderRadius: 8, padding: "9px 12px", opacity: claimingWorkshop ? 0.7 : 1,
                            transition: "opacity 0.2s",
                          }}
                          onClick={() => handleClaimWorkshopCert(true)}
                          disabled={claimingWorkshop}
                        >
                          {claimingWorkshop ? (
                            <><Loader2 size={14} className="animate-spin" />Memproses...</>
                          ) : (
                            <><Award size={14} /> Klaim Ulang</>
                          )}
                        </button>
                      </div>
                    </div>
                  ) : !mainCertClaimed ? (
                    // Sertifikat utama belum diklaim
                    <button
                      disabled
                      style={{
                        width: "100%", display: "flex", alignItems: "center", gap: 6, justifyContent: "center",
                        fontSize: 12, opacity: 1, cursor: "not-allowed",
                        background: "#9e9e9e", color: "white", border: "none",
                        borderRadius: 8, padding: "8px 12px", fontWeight: 500,
                      }}
                    >
                      <Lock size={12} />
                      Klaim sertifikat utama terlebih dahulu
                    </button>
                  ) : (
                    // Sertifikat utama sudah diklaim, belum klaim workshop
                    <>
                      {workshopClaimError && (
                        <div style={{
                          fontSize: 11, color: "#c62828", background: "#ffebee",
                          border: "1px solid #ef9a9a", borderRadius: 6, padding: "6px 10px",
                          marginBottom: 6,
                        }}>
                          {workshopClaimError}
                        </div>
                      )}
                      <button
                        style={{
                          width: "100%", display: "flex", alignItems: "center", gap: 6, justifyContent: "center",
                          fontSize: 13, fontWeight: 600, cursor: claimingWorkshop ? "not-allowed" : "pointer",
                          background: "var(--color-primary)", color: "white", border: "none",
                          borderRadius: 8, padding: "9px 12px", opacity: claimingWorkshop ? 0.7 : 1,
                          transition: "opacity 0.2s",
                        }}
                        onClick={() => handleClaimWorkshopCert(false)}
                        disabled={claimingWorkshop}
                      >
                        {claimingWorkshop ? (
                          <><Loader2 size={14} className="animate-spin" />Memproses...</>
                        ) : (
                          <><Award size={14} />Klaim Sertifikat Kehadiran</>
                        )}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Data Diri */}
          <div className="pd-section">
            <div className="pd-section-title">Data Diri</div>
            {[
              { icon: "user", label: "Nama Lengkap", val: namaLengkap },
              { icon: "gender", label: "Jenis Kelamin", val: jenisKelamin },
              { icon: "cal", label: "Tanggal Lahir", val: getAge(tanggalLahir) },
              { icon: "mail", label: "Email", val: email },
              { icon: "phone", label: "WhatsApp / Telepon", val: whatsapp },
            ].map(({ label, val }) => (
              <div key={label} className="pd-info-row">
                <div>
                  <div className="pd-info-lbl">{label}</div>
                  <div className="pd-info-val">{val || "—"}</div>
                </div>
              </div>
            ))}
            {partnerCode && (
              <div className="pd-info-row">
                <div>
                  <div className="pd-info-lbl">Kode Mitra</div>
                  <div className="pd-info-val" style={{ fontFamily: "monospace", fontWeight: "bold", background: "#f0f4f8", padding: "2px 6px", borderRadius: "4px", color: "#10507a" }}>{partnerCode}</div>
                </div>
              </div>
            )}
          </div>

          {/* Asal Daerah */}
          <div className="pd-section">
            <div className="pd-section-title">Asal Daerah</div>
            <div className="pd-info-row">
              <div>
                <div className="pd-info-lbl">Provinsi</div>
                <div className="pd-info-val">{provinsi}</div>
              </div>
            </div>
            <div className="pd-info-row">
              <div>
                <div className="pd-info-lbl">Kota / Kabupaten</div>
                <div className="pd-info-val">{kota}</div>
              </div>
            </div>
          </div>

          {/* Status Disabilitas */}
          <div className="pd-section">
            <div className="pd-section-title">Status Disabilitas</div>
            <div className="pd-info-row">
              <div>
                <div className="pd-info-lbl">Penyandang Disabilitas</div>
                <div style={{ marginTop: 4 }}>
                  {disabilitas === "Tidak" || disabilitas === "Bukan Penyandang Disabilitas" ? (
                    <span className="pd-badge-no">✓ Bukan Penyandang Disabilitas</span>
                  ) : disabilitas === "Ya" || disabilitas === "Penyandang Disabilitas" ? (
                    <>
                      <span className="pd-badge-yes">⚡ Penyandang Disabilitas</span>
                    </>
                  ) : <span>{disabilitas}</span>}
                </div>
              </div>
            </div>
          </div>




          <button
            className="pd-edit-btn"
            onClick={() => {
              onClose();
              router.push("/profile?edit=true");
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" stroke="currentColor" width="16" height="16">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            Edit Profil
          </button>
        </div>
      </div>
    </>
  );
}
