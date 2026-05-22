"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import styles from "./page.module.css";

export default function AdminLoginPage() {
  const router = useRouter();
  const { loginAsAdmin, profile, loading } = useAuth();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Kalau sudah login sebagai admin, redirect
  if (!loading && profile?.role === "admin") {
    router.push("/admin");
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      setError("Masukkan kode akses");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      await loginAsAdmin(code.trim());
      router.push("/admin");
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || "Kode akses salah");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.loginPage}>
      <div className={styles.loginCard}>
        <div className={styles.logo}>
          <div className={styles.logoIcon}>ioda</div>
          <h1 className={styles.title}>Admin Panel</h1>
          <p className={styles.subtitle}>Masukkan kode akses untuk melanjutkan</p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.inputGroup}>
            <label htmlFor="admin-code" className={styles.label}>Kode Akses</label>
            <input
              id="admin-code"
              type="password"
              className={styles.input}
              placeholder="Masukkan kode akses..."
              value={code}
              onChange={(e) => { setCode(e.target.value); setError(""); }}
              autoFocus
              disabled={submitting}
            />
          </div>

          {error && (
            <div className={styles.error}>
              ⚠️ {error}
            </div>
          )}

          <button
            type="submit"
            className={styles.submitBtn}
            disabled={submitting || !code.trim()}
          >
            {submitting ? (
              <>
                <span className={styles.spinner} />
                Memverifikasi...
              </>
            ) : (
              "Masuk ke Admin Panel"
            )}
          </button>
        </form>

        <div className={styles.footer}>
          <a href="/" className={styles.backLink}>← Kembali ke halaman utama</a>
        </div>
      </div>
    </div>
  );
}
