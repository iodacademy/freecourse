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
 * - requireAdmin: hanya admin yang boleh akses
 * - requireProfile: redirect ke /profile jika profil belum lengkap
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

    // Belum login → ke login page
    if (!user) {
      router.push("/login");
      return;
    }

    // Butuh admin tapi bukan admin → redirect ke home
    if (requireAdmin && profile?.role !== "admin") {
      router.push("/");
      return;
    }

    // Butuh profil lengkap tapi belum lengkap → ke profile page
    if (requireProfile && profile && !profile.profileCompleted) {
      router.push("/profile");
      return;
    }
  }, [user, profile, loading, requireAdmin, requireProfile, router]);

  // Loading
  if (loading) {
    return (
      <div className="loading-overlay" style={{ minHeight: "60vh" }}>
        <div className="spinner spinner-lg" />
        <p>Memuat...</p>
      </div>
    );
  }

  // Belum login atau bukan admin (saat requireAdmin)
  if (!user) return null;
  if (requireAdmin && profile?.role !== "admin") return null;
  if (requireProfile && profile && !profile.profileCompleted) return null;

  return <>{children}</>;
}
