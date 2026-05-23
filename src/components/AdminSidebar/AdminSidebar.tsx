"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, Calendar, BookOpen, GraduationCap, Library, Users, Tag, Settings, LogOut } from "lucide-react";
import styles from "./AdminSidebar.module.css";
import { useAuth } from "@/contexts/AuthContext";

const menuItems = [
  { href: "/admin", label: "Beranda", icon: <Home size={18} /> },
  { href: "/admin/events", label: "Event / Channel", icon: <Calendar size={18} /> },
  { href: "/admin/courses", label: "Modul Financial Literacy", icon: <BookOpen size={18} /> },
  { href: "/admin/certificates", label: "Sertifikat", icon: <GraduationCap size={18} /> },
  { href: "/admin/bonus-courses", label: "Kursus Tambahan", icon: <Library size={18} /> },
  { href: "/admin/students", label: "Siswa & Laporan", icon: <Users size={18} /> },
  { href: "/admin/partner-codes", label: "Tracking Mitra", icon: <Tag size={18} /> },
  { href: "/admin/settings", label: "Pengaturan", icon: <Settings size={18} /> },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
      router.push("/");
    } catch (e) {
      console.error("Logout error", e);
    }
  };

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
        <button onClick={handleLogout} className={styles.logoutBtn}>
          <LogOut size={16} /> Logout Admin
        </button>
      </div>
    </aside>
  );
}
