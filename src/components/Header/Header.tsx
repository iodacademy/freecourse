"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Bell } from "lucide-react";
import styles from "./Header.module.css";
import ProfileDrawer from "@/components/ProfileDrawer";
import WorkshopBanner from "@/components/WorkshopBanner/WorkshopBanner";

export default function Header() {
  const { user, profile, logout, loading } = useAuth();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [workshopPopupOpen, setWorkshopPopupOpen] = useState(false);
  const [workshopData, setWorkshopData] = useState<any>(null);
  const [workshopEventId, setWorkshopEventId] = useState<string | null>(null);

  const isLoggedIn = !!user;

  // Fetch enrollment untuk cek apakah user workshop, lalu ambil data event-nya
  useEffect(() => {
    if (!user) {
      setWorkshopData(null);
      setWorkshopEventId(null);
      return;
    }

    const fetchWorkshopStatus = async () => {
      try {
        const idToken = await user.getIdToken();
        const headers = { Authorization: `Bearer ${idToken}` };

        // 1. Ambil semua enrollment user
        const eRes = await fetch("/api/enrollments", { headers, cache: "no-store" });
        if (!eRes.ok) return;
        const enrollments: any[] = await eRes.json();

        // 2. Cari enrollment dengan channelSource === "workshop" yang punya eventId
        const wsEnrollment = enrollments.find(
          (e) => e.channelSource === "workshop" && e.eventId
        );
        if (!wsEnrollment) return;

        const eventId = wsEnrollment.eventId;

        // 3. Ambil data event (public, tidak perlu auth)
        const evRes = await fetch(`/api/events/public/${eventId}`);
        if (!evRes.ok) return;
        const evData = await evRes.json();

        if (evData.workshopData) {
          setWorkshopData(evData.workshopData);
          setWorkshopEventId(eventId);
        }
      } catch {
        // Tidak fatal — bell tidak muncul kalau gagal
      }
    };

    fetchWorkshopStatus();
  }, [user]);

  const isWorkshopUser = !!workshopData && !!workshopEventId;

  const handleLogoutConfirm = async () => {
    setLoggingOut(true);
    await logout();
    router.push("/login");
  };

  return (
    <>
      <header className={styles.topbar}>
        <div className={styles.topbarLogo}>
          <div className={styles.topbarLogoMark}>
            <svg viewBox="0 0 32 32" fill="white">
              <path d="M4 8h24v3H4zM4 14.5h16v3H4zM4 21h20v3H4z"/>
            </svg>
          </div>
          <h1>Modul Financial Literacy</h1>
        </div>
        <div className={styles.topbarRight}>
          {loading ? (
            // Skeleton saat auth loading — cegah flash "login" → "profil"
            <div style={{
              width: 100, height: 32, background: "rgba(255,255,255,0.15)",
              borderRadius: 8, animation: "pulse 1.5s ease-in-out infinite"
            }} />
          ) : isLoggedIn ? (
            <>
              {/* Bell Notification — hanya untuk workshop user */}
              {isWorkshopUser && (
                <button
                  className={styles.bellBtn}
                  onClick={() => setWorkshopPopupOpen(true)}
                  title="Info Workshop"
                >
                  <Bell size={17} />
                  <span className={styles.bellDot} />
                </button>
              )}

              {/* Profile Button */}
              <button className={styles.profBtn} onClick={() => setDrawerOpen(true)}>
                {profile?.photoURL || user?.photoURL ? (
                  <Image src={profile?.photoURL || user?.photoURL || ""} alt="Avatar" width={30} height={30} className={styles.profAv} />
                ) : (
                  <div className={styles.profAvInitial}>
                    {(profile?.displayName || user?.displayName || "")?.split(" ").slice(0,2).map((w: string) => w[0]).join("").toUpperCase() || "U"}
                  </div>
                )}
                <span className={styles.profNm}>{(profile?.displayName || user?.displayName || "")?.split(" ")[0] || "User"}</span>
                <svg className={styles.profChev} viewBox="0 0 24 24" fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </button>

              {/* Logout Button */}
              <button className={styles.logoutBtn} onClick={() => setLogoutModalOpen(true)}>
                <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                  <polyline points="16 17 21 12 16 7"></polyline>
                  <line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
                <span>Keluar</span>
              </button>
            </>
          ) : (
            <Link href="/login" className={styles.loginBtn}>
              Masuk / Login
            </Link>
          )}
        </div>
      </header>

      {/* ── PROFILE DRAWER ── */}
      {isLoggedIn && (
        <ProfileDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
        />
      )}

      {/* ── WORKSHOP POPUP (dari bell) ── */}
      {isWorkshopUser && workshopPopupOpen && (
        <WorkshopBanner
          workshopData={workshopData}
          eventId={workshopEventId}
          forceOpen={true}
          onClose={() => setWorkshopPopupOpen(false)}
        />
      )}

      {/* ── LOGOUT MODAL ── */}
      {logoutModalOpen && (
        <div className={styles.modalBg} onClick={() => setLogoutModalOpen(false)}>
          <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalIco}>
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
            </div>
            <div className={styles.modalTitle}>Keluar dari Akun?</div>
            <div className={styles.modalDesc}>
              Sesi belajar kamu akan disimpan otomatis. Kamu bisa melanjutkan kapan saja setelah login kembali.
            </div>
            <div className={styles.modalBtns}>
              <button className={styles.mCancel} onClick={() => setLogoutModalOpen(false)}>Batal</button>
              <button className={styles.mConfirm} onClick={handleLogoutConfirm} disabled={loggingOut}>
                {loggingOut ? "Keluar..." : "Ya, Keluar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
