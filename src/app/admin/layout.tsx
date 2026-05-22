import AdminSidebar from "@/components/AdminSidebar";
import AdminMobileNav from "@/components/AdminMobileNav";
import styles from "./layout.module.css";

export const metadata = {
  title: "Admin — Free Course IODA Academy",
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={styles.adminLayout}>
      <AdminSidebar />
      <AdminMobileNav />
      <main className={styles.mainContent}>{children}</main>
    </div>
  );
}
