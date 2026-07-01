"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, Calendar, BookOpen, GraduationCap, Library, Users, Tag, Settings, LogOut, BarChart3, ChevronLeft, ChevronRight } from "lucide-react";
import styles from "./AdminSidebar.module.css";
import { useAuth } from "@/contexts/AuthContext";

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

export default function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { logout, profile } = useAuth();
  
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Load saved state from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("adminSidebarCollapsed");
    if (saved === "true") setIsCollapsed(true);
  }, []);

  // Sync state to CSS variable for layout margin
  useEffect(() => {
    document.documentElement.style.setProperty(
      "--current-sidebar-width",
      isCollapsed ? "68px" : "var(--sidebar-width)"
    );
  }, [isCollapsed]);

  const handleToggle = () => {
    const nextState = !isCollapsed;
    setIsCollapsed(nextState);
    localStorage.setItem("adminSidebarCollapsed", String(nextState));
  };

  const handleLogout = async () => {
    try {
      await logout();
      router.push("/");
    } catch (e) {
      console.error("Logout error", e);
    }
  };

  return (
    <aside className={`${styles.sidebar} ${isCollapsed ? styles.collapsed : ""}`}>
      <div className={styles.header}>
        {!isCollapsed && (
          <Link href="/admin" className={styles.logo}>
            <div className={styles.logoIcon}>ioda</div>
            <span className={styles.logoLabel}>Admin Panel</span>
          </Link>
        )}
        <button onClick={handleToggle} className={styles.toggleBtn} aria-label="Toggle Sidebar">
          {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      <nav className={styles.nav}>
        {menuItems
          .filter((item) => {
            const role = profile?.role?.toLowerCase() || "";
            if (role.includes("public")) {
              const hiddenLabels = ["Modul Financial Literacy", "Benefit", "Pengaturan"];
              if (hiddenLabels.includes(item.label)) return false;
            }
            return true;
          })
          .map((item) => {
          const isActive =
            item.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.menuItem} ${isActive ? styles.active : ""}`}
              title={isCollapsed ? item.label : undefined}
            >
              <span className={styles.icon}>{item.icon}</span>
              <span className={styles.label}>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className={styles.footer}>
        <button onClick={handleLogout} className={styles.logoutBtn} title={isCollapsed ? "Logout Admin" : undefined}>
          <LogOut size={16} /> <span className={styles.logoutLabel}>Logout Admin</span>
        </button>
      </div>
    </aside>
  );
}
