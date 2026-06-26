"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Download, Link2, Settings, RefreshCw } from "lucide-react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import DashboardView, { DashboardFilterState } from "@/components/dashboard/DashboardView";
import ExportModal, { ExportMode } from "@/components/dashboard/ExportModal";
import styles from "@/components/dashboard/dashboard.module.css";
import Link from "next/link";

function buildQuery(filters: DashboardFilterState): string {
  const sp = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v != null && v !== "") sp.set(k, String(v));
  });
  const s = sp.toString();
  return s ? `?${s}` : "";
}

function AdminDashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Filter dari URL
  const filters: DashboardFilterState = {
    channel: searchParams.get("channel"),
    gender: searchParams.get("gender"),
    disabilitas: searchParams.get("disabilitas"),
    region: searchParams.get("region"),
    topik: searchParams.get("topik"),
    usia: searchParams.get("usia"),
    dateFrom: searchParams.get("dateFrom"),
    dateTo: searchParams.get("dateTo"),
    source: searchParams.get("source"),
  };

  const fetchData = useCallback(async (bypassCache = false) => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const sp = new URLSearchParams(buildQuery(filters).replace(/^\?/, ""));
      if (bypassCache) sp.set("refresh", "1"); // paksa rebuild cache di server
      const qs = sp.toString() ? `?${sp.toString()}` : "";
      const res = await fetch(`/api/admin/dashboard/stats${qs}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const d = await res.json();
      setData(d);
    } catch (e: any) {
      setError(e?.message || "Gagal memuat data");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, searchParams.toString()]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function applyFilters(next: DashboardFilterState) {
    router.replace(`/admin${buildQuery(next)}`, { scroll: false });
  }

  async function handleRefresh() {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await fetchData(true); // bypass cache server → hapus & rebuild
    } finally {
      setRefreshing(false);
    }
  }

  async function handleExport(mode: ExportMode) {
    if (!user) throw new Error("Sesi tidak valid");
    const token = await user.getIdToken();
    const sp = new URLSearchParams(buildQuery(filters).replace(/^\?/, ""));
    if (mode !== "clean") sp.set("mode", mode);
    const qs = sp.toString() ? `?${sp.toString()}` : "";
    const res = await fetch(`/api/admin/dashboard/export-excel${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("Export gagal");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    // ambil filename dari header
    const disposition = res.headers.get("Content-Disposition") || "";
    const m = disposition.match(/filename="?([^"]+)"?/);
    a.download = m ? m[1] : "dashboard.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleCopyPublicLink() {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/admin/settings", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const settings = await res.json();
      if (!settings.publicDashboardEnabled || !settings.publicDashboardToken) {
        alert("Public dashboard belum aktif. Buka Pengaturan Dashboard untuk aktifkan.");
        return;
      }
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const url = `${origin}/dashboard-public/${settings.publicDashboardToken}`;
      await navigator.clipboard.writeText(url);
      alert("Link publik berhasil disalin: " + url);
    } catch (e: any) {
      alert("Gagal salin link: " + (e?.message || ""));
    }
  }

  const rightActions = (
    <>
      <button
        className={styles.actionBtn}
        onClick={handleRefresh}
        type="button"
        disabled={refreshing}
        title="Muat ulang data terbaru (hapus cache)"
      >
        <RefreshCw size={14} className={refreshing ? styles.spin : undefined} />
        {refreshing ? "Memuat…" : "Refresh Data"}
      </button>
      <button className={styles.actionBtn} onClick={() => setExportOpen(true)} type="button">
        <Download size={14} />
        Export Excel
      </button>
      <button className={styles.actionBtn} onClick={handleCopyPublicLink} type="button">
        <Link2 size={14} />
        Salin Link Publik
      </button>
    </>
  );

  if (loading && !data) {
    return (
      <div className={styles.dashboard}>
        <div className={styles.loadingBox}>
          <p>Memuat dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.dashboard}>
        <div className={styles.loadingBox}>
          <p style={{ color: "var(--color-error)" }}>{error}</p>
          <button onClick={() => fetchData()} className={styles.actionBtnPrimary + " " + styles.actionBtn} style={{ marginTop: 12 }}>Coba Lagi</button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <>
      <DashboardView
        data={data}
        mode="admin"
        filters={filters}
        onFilterChange={applyFilters}
        rightActions={rightActions}
      />
      <ExportModal
        isOpen={exportOpen}
        onClose={() => setExportOpen(false)}
        onExport={handleExport}
      />
    </>
  );
}

export default function AdminDashboardPage() {
  return (
    <ProtectedRoute requireAdmin>
      <Suspense fallback={<div className={styles.loadingBox}><p>Memuat...</p></div>}>
        <AdminDashboardContent />
      </Suspense>
    </ProtectedRoute>
  );
}
