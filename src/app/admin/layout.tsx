import AdminLayoutClient from "./AdminLayoutClient";

export const metadata = {
  title: "Admin — Free Course IODA Academy",
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminLayoutClient>{children}</AdminLayoutClient>;
}
