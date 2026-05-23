"use client";

import styles from "./layout.module.css";
import ProtectedRoute from "@/components/ProtectedRoute";
import Header from "@/components/Header";

export default function LearnLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute>
      <div className={styles.container}>
        <Header />

        {/* ── MAIN LAYOUT ── */}
        <div className={styles.layout}>
          {children}
        </div>
      </div>
    </ProtectedRoute>
  );
}
