"use client";

import { useEffect, useState, useCallback, Suspense, use } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { notFound } from "next/navigation";
import DashboardView, { DashboardFilterState } from "@/components/dashboard/DashboardView";
import styles from "@/components/dashboard/dashboard.module.css";

function buildQuery(token: string, filters: DashboardFilterState): string {
  const sp = new URLSearchParams();
  sp.set("token", token);
  Object.entries(filters).forEach(([k, v]) => {
    if (v != null && v !== "") sp.set(k, String(v));
  });
  return `?${sp.toString()}`;
}

function PublicDashboardContent({ token }: { token: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [is404, setIs404] = useState(false);

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

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/public/dashboard/stats${buildQuery(token, filters)}`, {
        cache: "no-store",
      });
      if (res.status === 404) {
        setIs404(true);
        return;
      }
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const d = await res.json();
      setData(d);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, searchParams.toString()]);

  useEffect(() => { fetchData(); }, [fetchData]);

  function applyFilters(next: DashboardFilterState) {
    const sp = new URLSearchParams();
    Object.entries(next).forEach(([k, v]) => {
      if (v != null && v !== "") sp.set(k, String(v));
    });
    const qs = sp.toString();
    router.replace(`/dashboard-public/${token}${qs ? `?${qs}` : ""}`, { scroll: false });
  }

  if (is404) {
    notFound();
  }

  if (loading && !data) {
    return (
      <div className={styles.dashboard}>
        <div className={styles.loadingBox}><p>Memuat dashboard publik...</p></div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <DashboardView
      data={data}
      mode="public"
      filters={filters}
      onFilterChange={applyFilters}
    />
  );
}

export default function PublicDashboardPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  return (
    <Suspense fallback={<div className={styles.loadingBox}><p>Memuat...</p></div>}>
      <PublicDashboardContent token={token} />
    </Suspense>
  );
}
