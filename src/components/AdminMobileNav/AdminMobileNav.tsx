"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calendar, BookOpen, GraduationCap, Library, Users, Tag, Settings, Menu, X, BarChart3 } from "lucide-react";
import styles from "./AdminMobileNav.module.css";

const menuItems = [
  { href: "/admin", label: "Dashboard", icon: <BarChart3 size={18} /> },
  { href: "/admin/events", label: "Event / Channel", icon: <Calendar size={18} /> },
  { href: "/admin/courses", label: "Modul Financial Literacy", icon: <BookOpen size={18} /> },
  { href: "/admin/certificates", label: "Sertifikat", icon: <GraduationCap size={18} /> },
  { href: "/admin/bonus-courses", label: "Benefit", icon: <Library size={18} /> },
  { href: "/admin/students", label: "Siswa & Laporan", icon: <Users size={18} /> },
  { href: "/admin/partner-codes", label: "Tracking Mitra", icon: <Tag size={18} /> },
  { href: "/admin/settings", label: "Pengaturan", icon: <Settings size={18} /> },
];

export default function AdminMobileNav() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  // Close the sheet when route changes
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Prevent scrolling when sheet is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  return (
    <div className={styles.container}>
      {/* Top Header */}
      <div className={styles.topBar}>
        <Link href="/admin" className={styles.logo}>
          <div className={styles.logoIcon}>ioda</div>
          <span className={styles.logoLabel}>Admin</span>
        </Link>
        <button 
          className={styles.burgerBtn} 
          onClick={() => setIsOpen(true)}
          aria-label="Buka Menu"
        >
          <Menu size={24} />
        </button>
      </div>

      {/* Backdrop */}
      <div 
        className={`${styles.backdrop} ${isOpen ? styles.backdropOpen : ""}`} 
        onClick={() => setIsOpen(false)}
      />

      {/* Bottom Sheet */}
      <div className={`${styles.bottomSheet} ${isOpen ? styles.bottomSheetOpen : ""}`}>
        <div className={styles.sheetHeader}>
          <h2 className={styles.sheetTitle}>Menu Admin</h2>
          <button 
            className={styles.closeBtn} 
            onClick={() => setIsOpen(false)}
            aria-label="Tutup Menu"
          >
            <X size={24} />
          </button>
        </div>

        <nav className={styles.nav}>
          {menuItems.map((item) => {
            const isActive =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.menuItem} ${isActive ? styles.active : ""}`}
              >
                <span className={styles.icon}>{item.icon}</span>
                <span className={styles.label}>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className={styles.footer}>
          <Link href="/" className={styles.backLink}>
            ← Kembali ke Siswa
          </Link>
        </div>
      </div>
    </div>
  );
}
