"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { ChevronRight, Calendar, Wallet, TrendingUp, Briefcase, BarChart3 } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

export type LandingType = "workshop" | "beasiswa" | "kemitraan" | "umum";

interface StageConfig {
  label: string;
  title: string;
  sub: string;
  subHtml?: string;
  meta?: string;
}

export interface WorkshopData {
  title: string;
  date: string;
  dayLabel?: string;
  time: string;
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
  partnerCode?: string;
  heroTitle?: React.ReactNode;
  heroSubtitle?: string;
  workshopData?: WorkshopData;
}

// ─── Stage Configs ────────────────────────────────────────────────────────────

const STAGES: Record<LandingType, StageConfig[]> = {
  beasiswa: [
    { label: "Tahap 1", title: "Daftar & Isi Data Diri", sub: "Buat akun Google dan lengkapi data dirimu — cepat, mudah, gratis.", meta: "~2 menit" },
    { label: "Tahap 2", title: "Selesaikan Modul Financial Literacy", sub: "Tonton video eksklusif, kerjakan post-test & isi survei penyelesaian.", meta: "~15 menit" },
    { label: "Tahap 3", title: "Klaim Sertifikat", sub: "Sertifikat resmi Plan Indonesia × DBS Foundation langsung di tanganmu.", meta: "~10 menit" },
    {
      label: "Tahap 4", title: "Klaim Beasiswa",
      sub: "Gunakan kode redeem yang kamu terima untuk masuk ke Portal Belajar Ioda Academy.",
      subHtml: 'Gunakan kode redeem yang kamu terima untuk masuk ke <a href="https://app.iodacademy.id/portal-belajar" target="_blank" rel="noopener noreferrer" style="color:inherit;font-weight:600;text-decoration:underline;" onclick="event.stopPropagation()">Portal Belajar Ioda Academy</a>.',
    },
  ],
  workshop: [
    { label: "Tahap 1", title: "Daftar & Isi Data Diri", sub: "Buat akun Google dan lengkapi data dirimu — cepat, mudah, gratis.", meta: "~2 menit" },
    { label: "Tahap 2", title: "Ikut Webinar Workshop", sub: "Hadiri sesi live bersama fasilitator kami via Zoom — interaktif & informatif.", meta: "~60 menit" },
    { label: "Tahap 3", title: "Selesaikan Modul Financial Literacy", sub: "Tonton video eksklusif, kerjakan post-test & isi survei penyelesaian.", meta: "~15 menit" },
    { label: "Tahap 4", title: "Klaim Sertifikat", sub: "Sertifikat resmi Plan Indonesia × DBS Foundation langsung di tanganmu.", meta: "~10 menit" },
  ],
  kemitraan: [
    { label: "Tahap 1", title: "Daftar & Isi Kode Mitra", sub: "Daftar akun dan masukkan kode mitra dari kampus atau institusimu.", meta: "~2 menit" },
    { label: "Tahap 2", title: "Lengkapi Data Diri", sub: "Isi informasi dirimu agar kami bisa memvalidasi keanggotaanmu.", meta: "~3 menit" },
    { label: "Tahap 3", title: "Selesaikan Modul Financial Literacy", sub: "Tonton video eksklusif, kerjakan post-test & isi survei penyelesaian.", meta: "~15 menit" },
    { label: "Tahap 4", title: "Klaim Sertifikat", sub: "Sertifikat resmi Plan Indonesia × DBS Foundation langsung di tanganmu.", meta: "~10 menit" },
  ],
  umum: [
    { label: "Tahap 1", title: "Lengkapi Data Diri", sub: "Persetujuan dan data diri singkat. Gak sampai 2 menit.", meta: "~2 menit" },
    { label: "Tahap 2", title: "Tonton Video dan Uji Pemahaman", sub: "Tonton video literasi dan jawab 3 soal singkat.", meta: "~15 menit" },
    { label: "Tahap 3", title: "Download Sertifikat", sub: "Materi soft skill, kasih feedback, lalu klaim sertifikat.", meta: "~10 menit" },
  ],
};

// Topic icons for REDESIGN grid
const TOPIC_ICONS = [
  { name: "Pengelolaan Keuangan", Icon: Wallet },
  { name: "Perencanaan Masa Depan", Icon: TrendingUp },
  { name: "Kesiapan Kerja", Icon: Briefcase },
  { name: "Investasi Dasar", Icon: BarChart3 },
];

// Beasiswa topic chips (keep freecourse content)
const BEASISWA_CHIPS = [
  "Digital Marketing", "Legal", "Human Resource",
  "Sales & Business Development", "Product Management",
  "Finance & Accounting", "Topik Menarik Lainnya",
];

const WORKSHOP_CHIPS = [
  "💰 Pengelolaan Keuangan", "📈 Perencanaan Masa Depan",
  "💼 Kesiapan Kerja", "🏦 Literasi Perbankan", "📊 Investasi Dasar",
];


const ArrowRight = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
    <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
  </svg>
);

const WhatsAppIcon = () => (
  <svg width="20" height="20" viewBox="0 0 32 32" fill="currentColor">
    <path d="M16 3C8.8 3 3 8.8 3 16c0 2.3.6 4.5 1.7 6.4L3 29l6.8-1.7c1.8 1 3.9 1.6 6.2 1.6 7.2 0 13-5.8 13-13S23.2 3 16 3zm0 23.6c-2 0-3.9-.5-5.5-1.5l-.4-.2-4 1 1-3.9-.3-.4A10.5 10.5 0 0 1 5.5 16c0-5.8 4.7-10.5 10.5-10.5S26.5 10.2 26.5 16 21.8 26.6 16 26.6z" />
  </svg>
);

// ─── Main Component ───────────────────────────────────────────────────────────

export default function LandingTemplate({ type, eventId, partnerCode, heroTitle, heroSubtitle, workshopData }: LandingTemplateProps) {
  const router = useRouter();
  const { user, profile, loading, loginWithGoogle } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);

  // Redirect jika sudah login & profil lengkap
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
  const isWorkshop = type === "workshop";
  const isRedesignHero = !isWorkshop; // umum, beasiswa, kemitraan → REDESIGN hero

  // ─── Default copy ───
  const defaultTitle = isWorkshop
    ? "Selamat! Kamu Terpilih untuk Workshop Gratis 🎓"
    : "Belajar Literasi Finansial,\nTanpa Bayar Sepeserpun";

  const defaultSubtitle: Record<LandingType, string> = {
    beasiswa: "Selesaikan modul Literasi Finansial dan dapatkan sertifikatnya untuk klaim Beasiswa Kelas Online dari Ioda Academy.",
    workshop: "Ikuti program ini dan dapatkan akses ke modul <strong>Literasi Finansial</strong> secara <strong>Gratis</strong>. Terbatas untuk 100.000 kaum muda Indonesia!",
    kemitraan: "Ikuti program ini dan dapatkan akses ke modul <strong>Literasi Finansial</strong> secara <strong>Gratis</strong>. Terbatas untuk 100.000 kaum muda Indonesia!",
    umum: "Program literasi finansial <b>100% gratis</b> dari <b>Plan Indonesia × DBS Foundation</b> untuk <b>100.000 kaum muda</b> Indonesia usia 18 sampai 29 tahun. Dapat sertifikat resmi setelah lulus.",
  };

  // ─── Handler functions (unchanged from current) ───
  const handleLanjut = async () => {
    const params = new URLSearchParams();
    params.set("type", type);
    if (type === "kemitraan" && partnerCode) {
      params.set("partnerCode", partnerCode.toUpperCase());
    } else if (eventId && type !== "kemitraan") {
      params.set("eventId", eventId);
    }
    const targetUrl = `/profile?${params.toString()}`;

    if (typeof window !== "undefined") {
      const sourceMap: Record<string, string> = { umum: "umum", beasiswa: "beasiswa", kemitraan: "kemitraan", workshop: "workshop" };
      sessionStorage.setItem("channelSource", sourceMap[type] || "umum");
      if (type === "kemitraan") {
        sessionStorage.removeItem("partnerCode");
        sessionStorage.removeItem("eventId");
      } else if (eventId) {
        sessionStorage.setItem("eventId", eventId);
      }
    }

    setShowModal(false);

    if (!user) {
      setLoginLoading(true);
      try {
        await loginWithGoogle();
        router.push(targetUrl);
      } catch (e) {
        console.error("Login error", e);
      } finally {
        setLoginLoading(false);
      }
    } else if (!profile?.profileCompleted) {
      router.push(targetUrl);
    } else {
      router.push("/learn");
    }
  };

  const handleDaftarClick = () => {
    if (user && profile?.profileCompleted) {
      router.push("/learn");
    } else if (!user) {
      setShowModal(true);
    } else {
      handleLanjut();
    }
  };

  // ─── Render ───
  return (
    <div className="lp-page">

      {/* ─── Navbar (REDESIGN: 3 logos kiri + login kanan) ─── */}
      <nav className="lp-nav">
        <div className="lp-nav__brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/logo.png" alt="DBS Foundation × Plan International × IODA Academy" className="lp-nav__logo-combined" />
        </div>
        <div className="lp-nav__right">
          {(!user || !profile?.profileCompleted) && (
            <button onClick={() => router.push("/login")} className="lp-nav__login-btn">
              Masuk
            </button>
          )}
        </div>
      </nav>

      <main>
        {/* ─── Hero Section ─── */}
        {isRedesignHero ? (
          /* REDESIGN Hero: 2 kolom + collage (umum, beasiswa, kemitraan) */
          <section className="lp-hero">
            <div className="lp-hero__inner">
              <div>
                <div className="lp-hero__eyebrow">Program YouRise</div>
                <h1 className="lp-hero__title">
                  {heroTitle || (<>{defaultTitle.split("\n").map((line, i) => (<span key={i}>{line}{i === 0 && <br />}</span>))}</>)}
                </h1>
                <p className="lp-hero__sub" dangerouslySetInnerHTML={{ __html: heroSubtitle || defaultSubtitle[type] }} />
                <button type="button" className="lp-hero__cta" onClick={handleDaftarClick} disabled={loginLoading}>
                  {loginLoading ? "Membuka Google..." : "Ikut Program Sekarang!"} <ArrowRight />
                </button>
              </div>

              {/* Collage Cards */}
              <div className="lp-collage">
                <div className="lp-collage__card lp-collage__card--stat">
                  <div className="lp-collage__big-num">100.000</div>
                  <div className="lp-collage__big-lbl">Target Peserta</div>
                </div>
                <div className="lp-collage__card lp-collage__card--main">
                  {stages.slice(0, 3).map((s, i) => (
                    <div key={i} className="lp-stat-row">
                      <span className="lp-stat-row__icon">{i + 1}</span>
                      <span className="lp-stat-row__txt">
                        <b>{s.title}</b>
                        {s.meta && <span>{s.meta}</span>}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="lp-collage__card lp-collage__card--badge">
                  <div className="lp-collage__badge-txt">Untuk usia<br />18 sampai 29</div>
                  <div className="lp-collage__badge-sub">Daftar tanpa biaya</div>
                </div>
              </div>
            </div>
          </section>
        ) : (
          /* Workshop Hero: tetap freecourse layout */
          <section className="lp-hero--workshop">
            <div className="lp-workshop-banner">
              <div className="lp-workshop-banner__left">
                <div className="lp-workshop-banner__badge">
                  <span style={{ display: "flex", alignItems: "center", gap: "6px" }}><Calendar size={16} /> WORKSHOP EKSKLUSIF</span>
                </div>
                <h2 className="lp-workshop-banner__title">{workshopData?.title || "Judul Workshop Akan Tampil Di Sini"}</h2>
                <div className="lp-workshop-banner__info-list">
                  <div className="lp-workshop-banner__info-item">
                    <div className="lp-workshop-banner__info-icon">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                    </div>
                    <div>
                      <div className="lp-workshop-banner__info-label">TANGGAL</div>
                      <div className="lp-workshop-banner__info-val">
                        {workshopData?.date
                          ? new Date(workshopData.date + "T00:00:00").toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
                          : "15 Juni 2026"}
                      </div>
                    </div>
                  </div>
                  <div className="lp-workshop-banner__info-item">
                    <div className="lp-workshop-banner__info-icon">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                    </div>
                    <div>
                      <div className="lp-workshop-banner__info-label">JAM</div>
                      <div className="lp-workshop-banner__info-val">{workshopData?.time || "09.00-12.00 WIB"}</div>
                    </div>
                  </div>
                  <div className="lp-workshop-banner__info-item">
                    <div className="lp-workshop-banner__info-icon">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>
                    </div>
                    <div>
                      <div className="lp-workshop-banner__info-label">PLATFORM</div>
                      <div className="lp-workshop-banner__info-val">{workshopData?.platform || "Zoom Online"}</div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="lp-workshop-banner__right">
                <div className="lp-speaker-card">
                  <div className="lp-speaker-tape" />
                  <div className="lp-speaker-img-wrap">
                    {workshopData?.speakerPhoto ? (
                      <img src={workshopData.speakerPhoto} alt={workshopData.speakerName || "Pemateri"} className="lp-speaker-img" />
                    ) : (
                      <div className="lp-speaker-placeholder">
                        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" /></svg>
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="lp-speaker-label">PEMATERI</div>
                    <div className="lp-speaker-name">{workshopData?.speakerName || "Nama Pemateri"}</div>
                    <div className="lp-speaker-title">{workshopData?.speakerTitle || "Jabatan / Title Pemateri"}</div>
                  </div>
                </div>
              </div>
            </div>
            <p className="lp-workshop-callout">
              Ikuti workshop secara <strong className="lp-callout-highlight">Gratis</strong> dan dapatkan <strong className="lp-callout-highlight">Sertifikat</strong> resmi!!!
            </p>
            {/* Workshop topic chips */}
            <div className="lp-topic-chips">
              {WORKSHOP_CHIPS.map((chip) => (
                <span key={chip} className="lp-chip">{chip}</span>
              ))}
            </div>
            {/* Workshop CTA */}
            <div style={{ textAlign: "center", marginTop: "24px" }}>
              <button type="button" className="lp-hero__cta" onClick={handleDaftarClick} disabled={loginLoading}>
                {loginLoading ? "Membuka Google..." : "Daftar Sekarang!"} <ArrowRight />
              </button>
            </div>
          </section>
        )}

        {/* ─── Section: Topik Inti (REDESIGN grid untuk umum/kemitraan, chips untuk beasiswa) ─── */}
        {type !== "workshop" && (
          <section className="lp-section">
            {type === "beasiswa" ? (
              <>
                <div className="lp-section__eyebrow">Topik Pelatihan</div>
                <h2 className="lp-section__title">Yang Akan Kamu <b>Pelajari</b></h2>
                <div className="lp-topic-chips">
                  {BEASISWA_CHIPS.map((chip) => (
                    <span key={chip} className="lp-chip">{chip}</span>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="lp-section__eyebrow">4 Topik Inti</div>
                <h2 className="lp-section__title">Yang Akan Kamu <b>Pelajari</b></h2>
                <div className="lp-topics">
                  {TOPIC_ICONS.map((t) => (
                    <div key={t.name} className="lp-topic">
                      <div className="lp-topic__icon"><t.Icon size={22} /></div>
                      <div className="lp-topic__name">{t.name}</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        )}

        {/* ─── Section: Alur Program (REDESIGN horizontal cards) ─── */}
        <div className="lp-alur-wrap">
          <section className="lp-section">
            <div className="lp-section__eyebrow">{stages.length} Tahap</div>
            <h2 className="lp-section__title">Alur <b>Program</b></h2>
            <div className="lp-alur" style={{ "--lp-alur-cols": stages.length } as React.CSSProperties}>
              {stages.map((s, i) => (
                <div key={i} className="lp-alur__step">
                  <div className="lp-alur__num">{i + 1}</div>
                  <div className="lp-alur__eyebrow">{s.label}</div>
                  <h3 className="lp-alur__title">{s.title}</h3>
                  <p className="lp-alur__desc">
                    {s.subHtml
                      ? <span dangerouslySetInnerHTML={{ __html: s.subHtml }} />
                      : s.sub}
                  </p>
                  {s.meta && <span className="lp-alur__meta">⏱ {s.meta}</span>}
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>

      {/* ─── WhatsApp FAB ─── */}
      <a
        className="lp-wa-fab"
        href="https://wa.me/6281234567890?text=Halo%20Admin%20IODA%2C%20saya%20ingin%20bertanya%20tentang%20program%20ini."
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Hubungi Admin via WhatsApp"
      >
        <WhatsAppIcon />
        Hubungi Admin
      </a>

      {/* ─── Modal Pop-up Info Program ─── */}
      {showModal && (
        <div className="lp-modal-backdrop" onClick={() => setShowModal(false)} aria-modal="true" role="dialog">
          <div className="lp-modal" onClick={(e) => e.stopPropagation()}>
            <div className="lp-modal__logos">
              <Image src="/logos/plan-international.png" alt="Plan Indonesia" width={110} height={44} style={{ objectFit: "contain" }} />
              <span className="lp-modal__logo-sep">×</span>
              <Image src="/logos/dbs-foundation.png" alt="DBS Foundation" width={90} height={38} style={{ objectFit: "contain" }} />
            </div>
            <h2 className="lp-modal__title">Program YouRise</h2>
            <p className="lp-modal__desc">
              Selamat datang di program literasi finansial <strong>YouRise</strong>. Program ini merupakan hasil kerja sama antara <strong>Plan Indonesia</strong> dengan <strong>DBS Foundation</strong> melalui program YouRise (<em>Youth be Ready, Inclusive, Skilled, Empowered</em>) — sebuah inisiatif yang menargetkan <strong>100.000 kaum muda</strong> usia 18–29 tahun di Jakarta, Medan, dan Surabaya.
            </p>
            <p className="lp-modal__desc" style={{ marginTop: "8px" }}>
              Modul Literasi Finansial yang akan kamu akses dirancang untuk membekali kaum muda Indonesia dengan pemahaman finansial yang kuat — mulai dari pengelolaan keuangan pribadi, kesiapan kerja, hingga perencanaan masa depan.
            </p>
            <div className="lp-modal__benefits">
              <div className="lp-modal__benefit"><span className="lp-modal__benefit-icon">✦</span><span>100% gratis untuk semua peserta</span></div>
              <div className="lp-modal__benefit"><span className="lp-modal__benefit-icon">✦</span><span>Modul dirancang oleh ahli literasi keuangan</span></div>
              <div className="lp-modal__benefit"><span className="lp-modal__benefit-icon">✦</span><span>Sertifikat penyelesaian dari Plan Indonesia & DBS Foundation</span></div>
            </div>
            <div className="lp-modal__actions">
              <button className="lp-modal__btn-secondary" onClick={() => setShowModal(false)}>Kembali</button>
              <button className="lp-modal__btn-primary" onClick={handleLanjut} disabled={loginLoading}>
                {loginLoading ? (<>Membuka Google... <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /></>) : (<>Lanjut — Daftar Sekarang <ChevronRight /></>)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
