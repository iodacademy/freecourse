"use client";

import { usePathname } from "next/navigation";
import AdminSidebar from "@/components/AdminSidebar";
import AdminMobileNav from "@/components/AdminMobileNav";
import ProtectedRoute from "@/components/ProtectedRoute";
import styles from "./layout.module.css";

export default function AdminLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // Jika sedang di halaman login, jangan tampilkan sidebar dan jangan di-protect
  if (pathname === "/admin/login") {
    return <main>{children}</main>;
  }

  // Untuk halaman admin lainnya, wajibkan login admin dan tampilkan sidebar
  return (
    <ProtectedRoute requireAdmin>
      <div className={styles.adminLayout}>
        <AdminSidebar />
        <AdminMobileNav />
        <main className={styles.mainContent}>{children}</main>
      </div>
    </ProtectedRoute>
  );
}
