"use client";

import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import styles from "./Header.module.css";

export default function Header() {
  const { user, profile, logout } = useAuth();

  const isLoggedIn = !!user;
  const userName = profile?.displayName || user?.displayName || "";
  const userPhoto = profile?.photoURL || user?.photoURL || "";

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href="/" className={styles.logo}>
          <div className={styles.logoIcon}>
            <span>ioda</span>
          </div>
          <span className={styles.logoText}>
            <span className={styles.logoBold}>free</span>course
          </span>
        </Link>

        <nav className={styles.nav}>
          {isLoggedIn ? (
            <div className={styles.userMenu}>
              <Link href="/profile" className={styles.profileLink}>
                <div className={styles.avatar}>
                  {userPhoto ? (
                    <img src={userPhoto} alt={userName} />
                  ) : (
                    <span>{userName?.charAt(0).toUpperCase() || "U"}</span>
                  )}
                </div>
                <span className={styles.userName}>{userName}</span>
              </Link>
              <button
                className={`btn btn-ghost btn-sm ${styles.logoutBtn}`}
                onClick={logout}
              >
                Keluar
              </button>
            </div>
          ) : (
            <Link href="/login" className="btn btn-primary btn-sm">
              Masuk
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
