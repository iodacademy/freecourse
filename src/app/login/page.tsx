"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import GoogleButton from "@/components/GoogleButton";
import styles from "./page.module.css";
import { Suspense } from "react";

function LoginContent() {
  const { user, profile, loading, error, loginWithGoogle } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect");

  // Jika sudah login → redirect sesuai kondisi
  useEffect(() => {
    if (loading) return;

    if (user && profile) {
      // Kalau ada redirect URL, pakai itu
      if (redirectTo) {
        router.push(redirectTo);
        return;
      }
      // Default redirect
      if (profile.role === "admin") {
        router.push("/admin");
      } else if (!profile.profileCompleted) {
        router.push("/profile");
      } else {
        router.push("/learn");
      }
    }
  }, [user, profile, loading, router, redirectTo]);

  // Loading state
  if (loading) {
    return (
      <div className={styles.wrapper}>
        <div className="loading-overlay">
          <div className="spinner spinner-lg" />
          <p>Memuat...</p>
        </div>
      </div>
    );
  }

  // Sudah login dan profile ada → tampilkan loading sementara redirect
  if (user && profile && !error) {
    return (
      <div className={styles.wrapper}>
        <div className="loading-overlay">
          <div className="spinner spinner-lg" />
          <p>Mengarahkan ke halaman...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h1 className={styles.title}>
            Modul Financial Literacy
          </h1>
          <p className={styles.subtitle}>
            Masuk untuk mulai belajar literasi finansial gratis
          </p>
        </div>

        {error && (
          <div className="alert alert-error">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

          <div className={styles.actions}>
            <GoogleButton onClick={loginWithGoogle} />
          </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className={styles.wrapper}>
        <div className="loading-overlay">
          <div className="spinner spinner-lg" />
          <p>Memuat...</p>
        </div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
