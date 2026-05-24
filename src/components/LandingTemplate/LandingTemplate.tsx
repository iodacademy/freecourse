"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import styles from "./LandingTemplate.module.css";
import { Star, GraduationCap, Handshake, Calendar, ChevronRight } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

export type LandingType = "workshop" | "beasiswa" | "kemitraan" | "umum";

interface StageConfig {
  label: string;
  title: string;
  sub: string;
  subHtml?: string;  // opsional: HTML dengan link embed
}

export interface WorkshopData {
  title: string;
  date: string;         // ISO: "2026-06-15"
  dayLabel?: string;    // Manual: "Sabtu"
  time: string;         // Manual: "09.00-12.00 WIB"
  platform: string;
  meetingLink?: string;
  waGroupLink?: string;
  speakerName: string;
  speakerTitle: string;
  speakerPhoto?: string;
}

interface LandingTemplateProps {
  type: LandingType;
  eventId: string;
  partnerCode?: string;   // Kode mitra singkat (untuk channel kemitraan)
  heroTitle?: React.ReactNode;
  heroSubtitle?: string;
  workshopData?: WorkshopData;
}

// ─── Stage Configs ────────────────────────────────────────────────────────────

const STAGES: Record<LandingType, StageConfig[]> = {
  beasiswa: [
    {
      label: "Tahap 1",
      title: "Daftar & Isi Data Diri",
      sub: "Buat akun Google dan lengkapi data dirimu — cepat, mudah, gratis.",
    },
    {
      label: "Tahap 2",
      title: "Selesaikan Modul Financial Literacy",
      sub: "Tonton video eksklusif, kerjakan post-test & isi survei penyelesaian.",
    },
    {
      label: "Tahap 3",
      title: "Klaim Sertifikat",
      sub: "Sertifikat resmi Plan Indonesia × DBS Foundation langsung di tanganmu.",
    },
    {
      label: "Tahap 4",
      title: "Klaim Beasiswa",
      sub: "Gunakan kode redeem yang kamu terima untuk masuk ke Portal Belajar Ioda Academy.",
      subHtml: 'Gunakan kode redeem yang kamu terima untuk masuk ke <a href="https://app.iodacademy.id/portal-belajar" target="_blank" rel="noopener noreferrer" style="color:inherit;font-weight:600;text-decoration:underline;" onclick="event.stopPropagation()">Portal Belajar Ioda Academy</a>.',
    },
  ],
  workshop: [
    {
      label: "Tahap 1",
      title: "Daftar & Isi Data Diri",
      sub: "Buat akun Google dan lengkapi data dirimu — cepat, mudah, gratis.",
    },
    {
      label: "Tahap 2",
      title: "Ikut Webinar Workshop",
      sub: "Hadiri sesi live bersama fasilitator kami via Zoom — interaktif & informatif.",
    },
    {
      label: "Tahap 3",
      title: "Selesaikan Modul Financial Literacy",
      sub: "Tonton video eksklusif, kerjakan post-test & isi survei penyelesaian.",
    },
    {
      label: "Tahap 4",
      title: "Klaim Sertifikat",
      sub: "Sertifikat resmi Plan Indonesia × DBS Foundation langsung di tanganmu.",
    },
  ],
  kemitraan: [
    {
      label: "Tahap 1",
      title: "Daftar & Isi Kode Mitra",
      sub: "Daftar akun dan masukkan kode mitra dari kampus atau institusimu.",
    },
    {
      label: "Tahap 2",
      title: "Lengkapi Data Diri",
      sub: "Isi informasi dirimu agar kami bisa memvalidasi keanggotaanmu.",
    },
    {
      label: "Tahap 3",
      title: "Selesaikan Modul Financial Literacy",
      sub: "Tonton video eksklusif, kerjakan post-test & isi survei penyelesaian.",
    },
    {
      label: "Tahap 4",
      title: "Klaim Sertifikat",
      sub: "Sertifikat resmi Plan Indonesia × DBS Foundation langsung di tanganmu.",
    },
  ],
  umum: [
    {
      label: "Tahap 1",
      title: "Daftar & Isi Data Diri",
      sub: "Buat akun Google dan lengkapi data dirimu — cepat, mudah, gratis.",
    },
    {
      label: "Tahap 2",
      title: "Selesaikan Modul Financial Literacy",
      sub: "Tonton video eksklusif, kerjakan post-test & isi survei penyelesaian.",
    },
    {
      label: "Tahap 3",
      title: "Klaim Sertifikat",
      sub: "Sertifikat resmi Plan Indonesia × DBS Foundation langsung di tanganmu.",
    },
  ],
};

const EYEBROW: Record<LandingType, string> = {
  beasiswa: "🌟 PROGRAM BEASISWA",
  workshop: "🎓 WORKSHOP GRATIS",
  kemitraan: "🤝 MITRA KAMPUS / INSTITUSI",
  umum: "🌟 PROGRAM LITERASI FINANSIAL",
};

// ─── Chevron Icon ─────────────────────────────────────────────────────────────
// (Using lucide-react ChevronRight instead)

const LockIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

// ─── Step Connector (hook shape, like reference image) ───────────────────
// SVG has negative margins (-55px) top and bottom.
// With height 160px, y=0 is exactly 55px from the bottom of the upper card,
// and y=160 is exactly 55px from the top of the lower card.
// This perfectly aligns the path with the vertical middle of the cards.
//
// Cards are 60% wide in an 820px container:
//   left-card : left=0,   right=492
//   right-card: left=328, right=820
//
// bowLeft (even stages: left→right):
//   exits LEFT side (x=0, y=0), hooks far LEFT (x=-160), arrives LEFT side of right card (x=328, y=160)
// bowRight (odd stages: right→left):
//   exits RIGHT side (x=820, y=0), hooks far RIGHT (x=980), arrives RIGHT side of left card (x=492, y=160)
const StepConnector = ({ bowLeft }: { bowLeft: boolean }) => {
  const path = bowLeft
    ? "M 0,0 C -180,0 -160,160 328,160"     // exits left, loops to arrive at left edge of right card
    : "M 820,0 C 1000,0 980,160 492,160";   // exits right, loops to arrive at right edge of left card

  // Arrowhead — small filled triangle at the arrival point
  const arrowPts = bowLeft
    ? "328,160 314,153 314,167"   // pointing RIGHT → at x=328
    : "492,160 506,153 506,167";  // pointing LEFT ← at x=492

  return (
    <svg
      className={styles.stepConnectorSvg}
      viewBox="0 0 820 160"
      preserveAspectRatio="none"
      style={{ overflow: "visible" }}
      aria-hidden="true"
    >
      <path
        d={path}
        fill="none"
        stroke="#CC0000"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="9 7"
        opacity="0.5"
        vectorEffect="non-scaling-stroke"
      />
      <polygon
        points={arrowPts}
        fill="#CC0000"
        opacity="0.55"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function LandingTemplate({ type, eventId, partnerCode, heroTitle, heroSubtitle, workshopData }: LandingTemplateProps) {
  const router = useRouter();
  const { user, profile, loading, loginWithGoogle } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);

  // Kalau user sudah login & profil lengkap → langsung ke /learn
  // Redirect logic
  useEffect(() => {
    if (!loading && user && profile) {
      if (profile.role === "admin") {
        router.push("/admin");
      } else if (profile.profileCompleted) {
        router.push("/learn");
      }
    }
  }, [loading, user, profile, router]);

  const stages = STAGES[type];
  const eyebrow = EYEBROW[type];

  const defaultTitle =
    type === "workshop" ? "Selamat! Kamu Terpilih untuk Workshop Gratis 🎓" :
      type === "beasiswa" ? "Belajar Skill Baru, Gratis!! 🌟" :
        type === "kemitraan" ? "Selamat Datang, Kaum Muda! 🤝" :
          "Selamat Datang di Program YouRise! 🌟";

  const defaultSubtitle: Record<LandingType, string> = {
    beasiswa: "Selesaikan modul Literasi Finansial dan dapatkan sertifikatnya untuk klaim Beasiswa Kelas Online dari Ioda Academy.",
    workshop: "Ikuti program ini dan dapatkan akses ke modul <strong>Literasi Finansial</strong> secara <strong>Gratis</strong>. Terbatas untuk 100.000 kaum muda Indonesia!",
    kemitraan: "Ikuti program ini dan dapatkan akses ke modul <strong>Literasi Finansial</strong> secara <strong>Gratis</strong>. Terbatas untuk 100.000 kaum muda Indonesia!",
    umum: "Ikuti program ini dan dapatkan akses ke modul <strong>Literasi Finansial</strong> secara <strong>Gratis</strong>. Terbatas untuk 100.000 kaum muda Indonesia!",
  };

  const getStepStatus = (index: number) => {
    let activeIdx = 0;
    if (user) {
      // Sudah login → Tahap 1 (Daftar) otomatis selesai
      activeIdx = 1;
      
      if (profile?.profileCompleted) {
        // Profil sudah lengkap
        if (type === "beasiswa" || type === "umum") activeIdx = 1; // Tahap 2: Selesaikan Modul
        else if (type === "kemitraan") activeIdx = 2; // Tahap 3: Selesaikan Modul
        else if (type === "workshop") activeIdx = 1; // Tahap 2: Ikut Webinar
      }
    }
    
    if (index < activeIdx) return "done";
    if (index === activeIdx) return "active";
    return "locked";
  };

  const handleAction = () => {
    // Build target URL → selalu /profile dengan query params
    const params = new URLSearchParams();
    params.set("type", type);
    if (eventId) params.set("eventId", eventId);
    const queryString = params.toString();
    const targetUrl = `/profile${queryString ? `?${queryString}` : ""}`;

    if (!user) {
      // Belum login → ke login, setelah SSO langsung ke /profile
      router.push(`/login?redirect=${encodeURIComponent(targetUrl)}`);
    } else if (!profile?.profileCompleted) {
      // Sudah login tapi profil belum lengkap → ke /profile
      router.push(targetUrl);
    } else {
      // Profil sudah lengkap → langsung ke /learn
      router.push("/learn");
    }
  };

  const handleDaftarClick = () => {
    if (user && profile?.profileCompleted) {
      router.push("/learn");
    } else if (!user) {
      setShowModal(true);
    } else {
      handleAction();
    }
  };

  const handleLanjut = async () => {
    // Build target URL berdasarkan konteks landing page ini
    const params = new URLSearchParams();
    params.set("type", type);
    // Untuk kemitraan: kirim partnerCode (kode mitra pendek) di URL — bukan eventId
    if (type === "kemitraan" && partnerCode) {
      params.set("partnerCode", partnerCode.toUpperCase());
    } else if (eventId && type !== "kemitraan") {
      params.set("eventId", eventId);
    }
    const targetUrl = `/profile?${params.toString()}`;

    // Simpan konteks ke sessionStorage agar profile page dan auth bisa membacanya
    if (typeof window !== "undefined") {
      // channelSource = nama channel sesuai landing page yang dibuka
      const sourceMap: Record<string, string> = {
        umum:      "umum",
        beasiswa:  "beasiswa",
        kemitraan: "kemitraan",
        workshop:  "workshop",
      };
      sessionStorage.setItem("channelSource", sourceMap[type] || "umum");

      if (type === "kemitraan") {
        // Kemitraan: HAPUS partnerCode & eventId lama agar tidak mencemari form
        // partnerCode wajib diisi manual oleh user dari institusi mereka
        sessionStorage.removeItem("partnerCode");
        sessionStorage.removeItem("eventId");
      } else if (eventId) {
        sessionStorage.setItem("eventId", eventId);
      }
    }

    setShowModal(false);

    if (!user) {
      // Belum login → langsung popup Google SSO tanpa ke halaman /login
      setLoginLoading(true);
      try {
        await loginWithGoogle();
        // loginWithGoogle berhasil → onAuthStateChanged akan update `user`
        // useEffect redirect akan otomatis membawa ke /profile jika belum complete
        // Tapi jika profil sudah ada (returning user), kita perlu redirect manual
        router.push(targetUrl);
      } catch (e) {
        console.error("Login error", e);
      } finally {
        setLoginLoading(false);
      }
    } else if (!profile?.profileCompleted) {
      // Sudah login, profil belum lengkap
      router.push(targetUrl);
    } else {
      // Profil sudah lengkap
      router.push("/learn");
    }
  };

  return (
    <div className={styles.page}>
      {/* ─── Background Doodles ─── */}
      <div className={styles.doodles} aria-hidden="true">
        <svg style={{ top: "56px", left: "24px", width: "44px", height: "44px" }} viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="1.8" strokeLinecap="round">
          <path d="M12 2v20M2 12h20M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4" />
        </svg>
        <svg style={{ top: "120px", right: "40px", width: "28px", height: "28px" }} viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="10" />
        </svg>
        <svg style={{ bottom: "200px", left: "80px", width: "60px", height: "20px" }} viewBox="0 0 80 24">
          <circle cx="6" cy="12" r="3" fill="var(--color-primary)" opacity="0.5" />
          <circle cx="20" cy="6" r="2.5" fill="#000" opacity="0.3" />
          <circle cx="36" cy="16" r="3.5" fill="var(--color-primary)" opacity="0.4" />
          <circle cx="54" cy="8" r="2.5" fill="#000" opacity="0.25" />
          <circle cx="70" cy="14" r="3" fill="var(--color-primary)" opacity="0.35" />
        </svg>
      </div>

      {/* ─── Top Bar ─── */}
      <header className={styles.topbar}>
        <div className={styles.topbarLogos}>
          <Image src="/logos/plan-international.png" alt="Plan Indonesia" width={100} height={40} style={{ objectFit: "contain" }} />
          <span className={styles.logoSep}>×</span>
          <Image src="/logos/dbs-foundation.png" alt="DBS Foundation" width={80} height={36} style={{ objectFit: "contain" }} />
        </div>
        <div className={styles.topbarRight}>
          <div className={styles.topbarBadge}>{eyebrow}</div>
          {(!user || !profile?.profileCompleted) && (
            <button onClick={() => router.push("/login")} className={styles.loginBtn}>
              Masuk
            </button>
          )}
        </div>
      </header>

      <main>
        {/* ─── Hero ─── */}
        <section className={styles.hero}>
          {type === "workshop" ? (
            <div className={styles.workshopBanner}>
              <div className={styles.wbLeft}>
                <div className={styles.wbBadge}><span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Calendar size={16} /> WORKSHOP EKSKLUSIF</span></div>
                <h2 className={styles.wbTitle}>{workshopData?.title || "Judul Workshop Akan Tampil Di Sini"}</h2>
                <div className={styles.wbInfoList}>
                  <div className={styles.wbInfoItem}>
                    <div className={styles.wbIcon}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                    </div>
                    <div>
                      <div className={styles.wbInfoLabel}>TANGGAL</div>
                      <div className={styles.wbInfoVal}>
                        {workshopData?.date
                          ? (() => {
                              const formatted = new Date(workshopData.date + "T00:00:00").toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
                              return formatted;
                            })()
                          : "15 Juni 2026"
                        }
                      </div>
                    </div>
                  </div>
                  <div className={styles.wbInfoItem}>
                    <div className={styles.wbIcon}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                    </div>
                    <div>
                      <div className={styles.wbInfoLabel}>JAM</div>
                      <div className={styles.wbInfoVal}>{workshopData?.time || "09.00-12.00 WIB"}</div>
                    </div>
                  </div>
                  <div className={styles.wbInfoItem}>
                    <div className={styles.wbIcon}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
                    </div>
                    <div>
                      <div className={styles.wbInfoLabel}>PLATFORM</div>
                      <div className={styles.wbInfoVal}>{workshopData?.platform || "Zoom Online"}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className={styles.wbRight}>
                <div className={styles.speakerCard}>
                  <div className={styles.speakerTape}></div>
                  <div className={styles.speakerImgWrapper}>
                    {workshopData?.speakerPhoto ? (
                      <img src={workshopData.speakerPhoto} alt={workshopData.speakerName || "Pemateri"} className={styles.speakerImg} />
                    ) : (
                      <div className={styles.speakerPlaceholder}>
                        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" /></svg>
                      </div>
                    )}
                  </div>
                  <div className={styles.speakerDetails}>
                    <div className={styles.speakerLabel}>PEMATERI</div>
                    <div className={styles.speakerName}>{workshopData?.speakerName || "Nama Pemateri"}</div>
                    <div className={styles.speakerTitle}>{workshopData?.speakerTitle || "Jabatan / Title Pemateri"}</div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              <h1 className={styles.heroTitle}>
                {heroTitle ? heroTitle : defaultTitle}
              </h1>
              <p className={styles.heroSub} dangerouslySetInnerHTML={{ __html: heroSubtitle || defaultSubtitle[type] }} />
            </>
          )}

          {type === "workshop" ? (
            <p className={styles.workshopCallout}>
              Ikuti workshop secara <strong className={styles.calloutHighlight}>Gratis</strong> dan dapatkan <strong className={styles.calloutHighlight}>Sertifikat</strong> resmi!!!
            </p>
          ) : (
            <div className={styles.topicChips}>
              {(
                type === "beasiswa"
                  ? ["Digital Marketing", "Legal", "Human Resource", "Sales & Business Development", "Product Management", "Finance & Accounting", "Topik Menarik Lainnya"]
                  : ["💰 Pengelolaan Keuangan", "📈 Perencanaan Masa Depan", "💼 Kesiapan Kerja", "🏦 Literasi Perbankan", "📊 Investasi Dasar"]
              ).map((chip) => (
                <span key={chip} className={styles.chip}>{chip}</span>
              ))}
            </div>
          )}

        </section>

        {/* ─── Stages ─── */}
        <section className={styles.stagesWrap}>
          <h2 className={styles.stagesHeading}>Alur Program</h2>
          <div className={styles.stagesList}>
            {stages.map((stage, i) => {
              const status = getStepStatus(i);
              const isEven = i % 2 === 0;
              const isLast = i === stages.length - 1;
              const isInteractive = status === "active" || status === "done";
              
              let ctaText = "Terkunci";
              let Icon: any = LockIcon;
              if (status === "done") { 
                ctaText = "Selesai"; 
                Icon = () => <span style={{fontSize: "14px", fontWeight: "bold"}}>✓</span>; 
              } else if (status === "active") { 
                ctaText = i === 0 ? "Mulai" : "Lanjut"; 
                Icon = ChevronRight; 
              }

              return (
                <div key={i} className={styles.stageRow}>

                  {/* ── Card ── */}
                  <div
                    className={`${styles.stage} ${status === "active" ? styles.stageActive : status === "done" ? styles.stageDone : styles.stageLocked} ${isEven ? styles.stageLeft : styles.stageRight}`}
                    onClick={isInteractive ? handleDaftarClick : undefined}
                    role={isInteractive ? "button" : undefined}
                    tabIndex={isInteractive ? 0 : undefined}
                    onKeyDown={isInteractive ? (e) => e.key === "Enter" && handleDaftarClick() : undefined}
                    aria-label={`${stage.title} (${status})`}
                  >
                    <div className={styles.stageNum}>{status === "done" ? "✓" : i + 1}</div>
                    <div className={styles.stageBody}>
                      <div className={styles.stageLabel}>{stage.label}</div>
                      <div className={styles.stageTitle}>{stage.title}</div>
                      <div className={styles.stageSub}>
                        {stage.subHtml
                          ? <span dangerouslySetInnerHTML={{ __html: stage.subHtml }} onClick={e => e.stopPropagation()} />
                          : stage.sub
                        }
                      </div>
                    </div>
                    <span className={styles.stageCta}>
                      {ctaText}
                      <Icon />
                    </span>
                  </div>

                  {/* ── Connector to next stage ── */}
                  {!isLast && <StepConnector bowLeft={isEven} />}
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {/* ─── WhatsApp FAB ─── */}
      <a
        className={styles.waFab}
        href="https://wa.me/6281234567890?text=Halo%20Admin%20IODA%2C%20saya%20ingin%20bertanya%20tentang%20program%20ini."
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Hubungi Admin via WhatsApp"
      >
        <svg width="20" height="20" viewBox="0 0 32 32" fill="currentColor">
          <path d="M16 3C8.8 3 3 8.8 3 16c0 2.3.6 4.5 1.7 6.4L3 29l6.8-1.7c1.8 1 3.9 1.6 6.2 1.6 7.2 0 13-5.8 13-13S23.2 3 16 3zm0 23.6c-2 0-3.9-.5-5.5-1.5l-.4-.2-4 1 1-3.9-.3-.4A10.5 10.5 0 0 1 5.5 16c0-5.8 4.7-10.5 10.5-10.5S26.5 10.2 26.5 16 21.8 26.6 16 26.6z" />
        </svg>
        Hubungi Admin
      </a>

      {/* ─── Modal Pop-up Info Program ─── */}
      {showModal && (
        <div className={styles.modalBackdrop} onClick={() => setShowModal(false)} aria-modal="true" role="dialog">
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            {/* Logo */}
            <div className={styles.modalLogos}>
              <Image src="/logos/plan-international.png" alt="Plan Indonesia" width={110} height={44} style={{ objectFit: "contain" }} />
              <span className={styles.modalLogoSep}>×</span>
              <Image src="/logos/dbs-foundation.png" alt="DBS Foundation" width={90} height={38} style={{ objectFit: "contain" }} />
            </div>

            {/* Title */}
            <h2 className={styles.modalTitle}>Program YouRise</h2>
            <p className={styles.modalDesc}>
              Selamat datang di program literasi finansial <strong>YouRise</strong>. Program ini merupakan hasil kerja sama antara <strong>Plan Indonesia</strong> dengan <strong>DBS Foundation</strong> melalui program YouRise (<em>Youth be Ready, Inclusive, Skilled, Empowered</em>) — sebuah inisiatif yang menargetkan <strong>100.000 kaum muda</strong> usia 18–29 tahun di Jakarta, Medan, dan Surabaya.
            </p>
            <p className={styles.modalDesc} style={{ marginTop: "8px" }}>
              Modul Literasi Finansial yang akan kamu akses dirancang untuk membekali kaum muda Indonesia dengan pemahaman finansial yang kuat — mulai dari pengelolaan keuangan pribadi, kesiapan kerja, hingga perencanaan masa depan.
            </p>

            {/* Benefits */}
            <div className={styles.modalBenefits}>
              <div className={styles.modalBenefit}>
                <span className={styles.modalBenefitIcon}>✦</span>
                <span>100% gratis untuk semua peserta</span>
              </div>
              <div className={styles.modalBenefit}>
                <span className={styles.modalBenefitIcon}>✦</span>
                <span>Modul dirancang oleh ahli literasi keuangan</span>
              </div>
              <div className={styles.modalBenefit}>
                <span className={styles.modalBenefitIcon}>✦</span>
                <span>Sertifikat penyelesaian dari Plan Indonesia & DBS Foundation</span>
              </div>
            </div>

            {/* Actions */}
            <div className={styles.modalActions}>
              <button className={styles.modalBtnSecondary} onClick={() => setShowModal(false)}>
                Kembali
              </button>
              <button
                className={styles.modalBtnPrimary}
                onClick={handleLanjut}
                disabled={loginLoading}
              >
                {loginLoading ? (
                  <>Membuka Google... <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /></>
                ) : (
                  <>Lanjut — Daftar Sekarang <ChevronRight /></>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
