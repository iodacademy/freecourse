"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  requireProfile?: boolean;
}

/**
 * Komponen pembungkus untuk halaman yang butuh login.
 * - requireAdmin: hanya admin yang boleh akses (redirect ke /admin/login)
 * - requireProfile: redirect ke /profile jika profil belum lengkap
 *   Termasuk saat profile masih null (belum selesai di-fetch dari Firestore).
 */
export default function ProtectedRoute({
  children,
  requireAdmin = false,
  requireProfile = true,
}: ProtectedRouteProps) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const role = profile?.role?.toLowerCase() || "";
    const isAdminType = role === "admin" || role.includes("public");

    if (requireAdmin) {
      // Admin pages: redirect ke /admin/login jika belum login atau bukan admin
      if (!user || !isAdminType) {
        router.push("/admin/login");
        return;
      }
    } else {
      // Student pages: redirect ke /login jika belum login
      if (!user) {
        router.push("/login");
        return;
      }

      // Blokir Admin: Admin tidak boleh masuk ke halaman siswa
      if (isAdminType) {
        router.push("/admin");
        return;
      }

      // Butuh profil lengkap:
      // - profile === null → belum selesai load, anggap belum lengkap
      // - profile.profileCompleted === false → belum diisi
      if (requireProfile && (!profile || !profile.profileCompleted)) {
        router.push("/profile");
        return;
      }
    }
  }, [user, profile, loading, requireAdmin, requireProfile, router]);

  // Saat auth masih dicek, render null (transparan) — tidak perlu spinner sendiri
  // karena auth context sudah sangat cepat dan halaman /learn punya loading-nya sendiri
  if (loading) return null;

  const role = profile?.role?.toLowerCase() || "";
  const isAdminType = role === "admin" || role.includes("public");

  // Guard checks (render-time block — mencegah flash konten)
  if (requireAdmin) {
    if (!user || !isAdminType) return null;
  } else {
    if (!user) return null;
    if (requireProfile && (!profile || !profile.profileCompleted)) return null;
  }

  return <>{children}</>;
}
