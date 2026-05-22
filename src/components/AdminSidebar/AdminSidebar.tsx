"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./AdminSidebar.module.css";

const menuItems = [
  { href: "/admin", label: "Beranda", icon: "🏠" },
  { href: "/admin/events", label: "Event / Channel", icon: "📅" },
  { href: "/admin/courses", label: "Kursus & Materi", icon: "📖" },
  { href: "/admin/certificates", label: "Sertifikat", icon: "🎓" },
  { href: "/admin/bonus-courses", label: "Kursus Tambahan", icon: "📚" },
  { href: "/admin/students", label: "Siswa & Laporan", icon: "👥" },
  { href: "/admin/partner-codes", label: "Kode Mitra", icon: "🏷️" },
  { href: "/admin/settings", label: "Pengaturan", icon: "⚙️" },
];

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className={styles.sidebar}>
      <div className={styles.header}>
        <Link href="/admin" className={styles.logo}>
          <div className={styles.logoIcon}>ioda</div>
          <span className={styles.logoLabel}>Admin Panel</span>
        </Link>
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
    </aside>
  );
}
