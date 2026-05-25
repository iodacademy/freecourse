"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { LearnLoadingProvider, useLearnLoading } from "@/contexts/LearnLoadingContext";
import Header from "@/components/Header";

/**
 * Inner layout — bisa consume context yang di-provide oleh LearnLoadingProvider.
 */
function LearnLayoutInner({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const { contentReady } = useLearnLoading();

  // ── Auth guard (redirect jika tidak berhak) ──
  useEffect(() => {
    if (loading) return;
    if (!user) { router.push("/login"); return; }
    if (profile?.role === "admin") { router.push("/admin"); return; }
    if (profile && !profile.profileCompleted) { router.push("/profile"); return; }
  }, [loading, user, profile, router]);

  // Overlay ditampilkan selama:
  // - Auth masih loading, ATAU
  // - Belum ada user, ATAU
  // - Halaman konten belum signalReady()
  const showOverlay = loading || !user || !contentReady;

  return (
    <div className="ll-container">
      {/* Header selalu tampil */}
      <Header />

      <div className="ll-layout" style={{ position: "relative" }}>
        {/* Children SELALU dirender di belakang overlay → data bisa load di latar belakang */}
        {!loading && user && children}

        {/* ═══ SATU-SATUNYA LOADING OVERLAY ═══ */}
        {showOverlay && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 15,
              background: "var(--color-gray-50, #FAFAFA)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 16,
            }}
          >
            <div className="spinner spinner-lg" />
            <p style={{ color: "var(--color-gray-500)", fontWeight: 600, marginBottom: 0 }}>
              Mengarahkan ke materi...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Public layout — menyediakan LearnLoadingProvider.
 */
export default function LearnLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <LearnLoadingProvider>
      <LearnLayoutInner>{children}</LearnLayoutInner>
    </LearnLoadingProvider>
  );
}
