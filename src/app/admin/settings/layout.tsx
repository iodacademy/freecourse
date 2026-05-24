"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import styles from "./layout.module.css";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AdminSettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const tabs = [
    { label: "Form Builder", href: "/admin/settings/forms" },
    { label: "Sertifikat", href: "/admin/settings/certificates" },
    { label: "Administrator", href: "/admin/settings/administrators" },
  ];

  return (
    <ProtectedRoute requireAdmin>
      <div className={styles.page}>
        <header className={styles.header}>
          <div>
            <h1 className={styles.title}>Pengaturan Sistem</h1>
            <p className={styles.subtitle}>Konfigurasi administrasi dan integrasi Google Apps Script.</p>
          </div>
        </header>

        {/* ── TABS NAVIGATION ── */}
        <div className={styles.tabsContainer}>
          <div className={styles.tabsList}>
            {tabs.map((tab) => {
              // Exact match or sub-route match (e.g. /admin/settings/forms/123)
              const isActive = pathname.startsWith(tab.href);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`${styles.tab} ${isActive ? styles.activeTab : ""}`}
                >
                  {tab.label}
                </Link>
              );
            })}
          </div>
        </div>

        <div className={styles.content}>
          {children}
        </div>
      </div>
    </ProtectedRoute>
  );
}
