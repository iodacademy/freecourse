"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import Image from "next/image";
import styles from "./layout.module.css";
import ProtectedRoute from "@/components/ProtectedRoute";
import ProfileDrawer from "@/components/ProfileDrawer";

export default function LearnLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile, logout } = useAuth();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogoutConfirm = async () => {
    setLoggingOut(true);
    await logout();
    router.push("/login");
  };

  return (
    <ProtectedRoute>
      <div className={styles.container}>
        {/* ── TOP BAR ── */}
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
            {/* Profile Button */}
            <button className={styles.profBtn} onClick={() => setDrawerOpen(true)}>
              {profile?.photoURL ? (
                <Image src={profile.photoURL} alt="Avatar" width={30} height={30} className={styles.profAv} />
              ) : (
                <div className={styles.profAvInitial}>
                  {profile?.displayName?.split(" ").slice(0,2).map(w => w[0]).join("").toUpperCase() || "U"}
                </div>
              )}
              <span className={styles.profNm}>{profile?.displayName?.split(" ")[0] || "User"}</span>
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
          </div>
        </header>

        {/* ── MAIN LAYOUT ── */}
        <div className={styles.layout}>
          {children}
        </div>
      </div>

      {/* ── PROFILE DRAWER ── */}
      <ProfileDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        displayName={profile?.displayName || undefined}
        email={profile?.email || undefined}
        photoURL={profile?.photoURL || undefined}
      />

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
              <button
                className={styles.mConfirm}
                onClick={handleLogoutConfirm}
                disabled={loggingOut}
              >
                {loggingOut ? "Keluar..." : "Ya, Logout"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ProtectedRoute>
  );
}
