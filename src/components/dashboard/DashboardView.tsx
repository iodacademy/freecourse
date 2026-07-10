"use client";

import { useState, useMemo } from "react";
import {
  Users, Heart, Accessibility, GraduationCap, Smile, ShieldCheck,
  MapPin, TrendingUp, Cake, BookOpen, Building2, Globe2, Sparkles,
} from "lucide-react";
import AreaCard from "./AreaCard";
import KpiCard from "./KpiCard";
import MetricCard from "./MetricCard";
import RatingCard from "./RatingCard";
import BarTable from "./BarTable";
import AgeChart from "./AgeChart";
import DashboardShell from "./DashboardShell";
import DateFilter from "./DateFilter";
import SourceFilter from "./SourceFilter";
import FilterChips, { ActiveFilter } from "./FilterChips";
import styles from "./dashboard.module.css";
import { fmtIntID } from "@/lib/format-helpers";

interface DashboardData {
  stats: {
    total: number; totalCompleted: number; totalTarget: number;
    perempuan: number; perempuanCompleted: number; perempuanTarget: number;
    disabilitas: number; disabilitasCompleted: number; disabilitasTarget: number;
    rerata: number; rerataPretest: number; kepuasan: number; keyakinan: number;
    respondenSurvei1: number; respondenSurvei2: number;
    origin: Array<[string, number]>;
    topik: Array<[string, number]>;
    usia: Array<[string, number]>;
    lulusKuis: number;
    tidakLulusKuis: number;
    channelBreakdown: Record<string, { registered: number; completed: number }>;
    sourceList: Array<{ key: string; label: string; share: number }>;
    areaStats?: Array<{
      key: string;
      label: string;
      desc: string;
      registered: number;
      completed: number;
      cleanCompleted: number;
    }>;
    cleanOnly?: boolean;
  };
  students?: any[];
  generatedAt: string;
  mapping: {
    quizStepTitle: string | null;
    survey1QuestionText: string | null;
    feedbackQuestionText: string | null;
    survey2QuestionText: string | null;
  };
}

export interface DashboardFilterState {
  channel?: string | null;
  gender?: string | null;
  disabilitas?: string | null;
  region?: string | null;
  topik?: string | null;
  usia?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  source?: string | null;
}

interface Props {
  data: DashboardData;
  mode: "admin" | "public";
  filters: DashboardFilterState;
  onFilterChange: (next: DashboardFilterState) => void;
  rightActions?: React.ReactNode; // untuk Export Excel & Salin Link Publik (admin only)
  // Sembunyikan target & persentase completion di KPI (dipakai dashboard mitra).
  hideTargets?: boolean;
  /** Mode "Hanya Data Clean" aktif (internal saja). Undefined = fitur disembunyikan. */
  cleanOnly?: boolean;
  onCleanOnlyChange?: (next: boolean) => void;
}

const RANK_RAMP = ["#CC0000", "#EC5563", "#F18A93", "#F6B5BB", "#FAD9DC"];

export default function DashboardView({
  data, mode, filters, onFilterChange, rightActions, hideTargets = false,
  cleanOnly, onCleanOnlyChange,
}: Props) {
  const { stats } = data;
  // Card Per Area & toggle Clean hanya untuk dashboard internal.
  const showAreas = mode === "admin" && !!stats.areaStats?.length;
  const showCleanToggle = mode === "admin" && onCleanOnlyChange != null;

  // Active filter chips
  const activeFilters: ActiveFilter[] = useMemo(() => {
    const out: ActiveFilter[] = [];
    if (filters.gender) out.push({ key: "gender", label: "Gender", value: filters.gender });
    if (filters.disabilitas) out.push({ key: "disabilitas", label: "Disabilitas", value: filters.disabilitas });
    if (filters.region) out.push({ key: "region", label: "Asal", value: filters.region });
    if (filters.topik) out.push({ key: "topik", label: "Minat", value: filters.topik });
    if (filters.usia) out.push({ key: "usia", label: "Usia", value: filters.usia });
    return out;
  }, [filters]);

  function toggle(key: keyof DashboardFilterState, value: string) {
    onFilterChange({
      ...filters,
      [key]: filters[key] === value ? null : value,
    });
  }

  function removeFilter(key: string) {
    onFilterChange({ ...filters, [key]: null });
  }

  function resetAll() {
    onFilterChange({});
  }

  const toolbarRight = (
    <>
      <FilterChips filters={activeFilters} onRemove={removeFilter} onReset={resetAll} />
      <DateFilter
        dateFrom={filters.dateFrom || null}
        dateTo={filters.dateTo || null}
        onApply={(from, to) => onFilterChange({ ...filters, dateFrom: from, dateTo: to })}
      />
      <SourceFilter
        options={stats.sourceList}
        value={filters.source || null}
        onChange={(key) => onFilterChange({ ...filters, source: key })}
      />
      {showCleanToggle && (
        <label
          className={[styles.cleanToggle, cleanOnly ? styles.cleanToggleOn : ""].filter(Boolean).join(" ")}
          title="Hitung kartu hanya dari peserta di area program dengan usia yang memenuhi syarat (≤29 th; ≤35 th untuk penyandang disabilitas)"
        >
          <input
            type="checkbox"
            checked={!!cleanOnly}
            onChange={(e) => onCleanOnlyChange?.(e.target.checked)}
          />
          <Sparkles size={14} />
          Hanya Data Clean
        </label>
      )}
      {rightActions}
    </>
  );

  return (
    <DashboardShell mode={mode} toolbarRight={toolbarRight} generatedAt={mode === "public" ? data.generatedAt : undefined}>
      {/* Row A — KPI */}
      <div className={styles.row3}>
        <KpiCard
          label="Total Completion"
          value={stats.total}
          completed={mode === "admin" ? stats.totalCompleted : undefined}
          target={stats.totalTarget}
          hideTarget={hideTargets}
          icon={<Users size={26} strokeWidth={1.75} />}
          variant="ink"
        />
        <KpiCard
          label="Completion Perempuan"
          value={stats.perempuan}
          completed={mode === "admin" ? stats.perempuanCompleted : undefined}
          target={stats.perempuanTarget}
          hideTarget={hideTargets}
          icon={<Heart size={26} strokeWidth={1.75} />}
          variant="red"
          clickable
          active={filters.gender === "Perempuan"}
          onClick={() => toggle("gender", "Perempuan")}
        />
        <KpiCard
          label="Completion Disabilitas"
          value={stats.disabilitas}
          completed={mode === "admin" ? stats.disabilitasCompleted : undefined}
          target={stats.disabilitasTarget}
          hideTarget={hideTargets}
          icon={<Accessibility size={26} strokeWidth={1.75} />}
          variant="red"
          clickable
          active={filters.disabilitas === "Ya"}
          onClick={() => toggle("disabilitas", "Ya")}
        />
      </div>

      {/* Row A2 — Card Per Area (internal saja) */}
      {showAreas && (
        <>
          <div className={styles.sectionHead}>
            <h3 className={styles.sectionTitle}>
              <Building2 size={18} strokeWidth={1.75} />
              Completion per Area
            </h3>
            <span className={styles.sectionNote}>
              {cleanOnly
                ? "Hanya Data Clean — jumlah semua area = Total Completion di atas"
                : "Data Clean = usia ≤29 th (≤35 th untuk penyandang disabilitas)"}
            </span>
          </div>
          <div className={styles.areaGrid}>
            {stats.areaStats!.map((a) => {
              const isLuar = a.key === "luar";
              return (
                <AreaCard
                  key={a.key}
                  label={a.label}
                  desc={a.desc}
                  completed={a.completed}
                  registered={a.registered}
                  cleanCompleted={a.cleanCompleted}
                  muted={isLuar}
                  hideCleanRow={!!cleanOnly}
                  icon={isLuar ? <Globe2 size={20} strokeWidth={1.75} /> : <MapPin size={20} strokeWidth={1.75} />}
                />
              );
            })}
          </div>
        </>
      )}

      {/* Row B — Metric */}
      <div className={styles.row4}>
        <MetricCard
          label="Rerata Nilai Pre-test"
          value={stats.rerataPretest}
          suffix="/ 100"
          icon={<BookOpen size={22} strokeWidth={1.75} />}
          foot="Rata-rata nilai pre-test peserta"
        />
        <MetricCard
          label="Rerata Nilai Post-test"
          value={stats.rerata}
          suffix="/ 100"
          icon={<GraduationCap size={22} strokeWidth={1.75} />}
          foot="Rata-rata nilai akhir pelatihan"
        >
          <div style={{
            marginTop: "12px",
            padding: "8px 12px",
            backgroundColor: "#F9FAFB",
            borderRadius: "6px",
            border: "1px solid #E5E7EB",
            display: "flex",
            justifyContent: "space-between",
            fontSize: "13px",
            fontWeight: 500,
            color: "#374151"
          }}>
            <span style={{ color: "#059669" }}>Lulus: {stats.lulusKuis}</span>
            <span style={{ color: "#DC2626" }}>Tidak Lulus: {stats.tidakLulusKuis}</span>
          </div>
        </MetricCard>
        <RatingCard
          label="Kepuasan Peserta"
          value={stats.kepuasan}
          responden={stats.respondenSurvei1}
          icon={<Smile size={22} strokeWidth={1.75} />}
        />
        <RatingCard
          label="Keyakinan Kesiapan Kerja"
          value={stats.keyakinan}
          responden={stats.respondenSurvei2}
          icon={<ShieldCheck size={22} strokeWidth={1.75} />}
          iconVariant="ink"
        />
      </div>

      {/* Row C — Data Panel */}
      <div className={styles.rowData}>
        <div className={styles.panel}>
          <div className={styles.panelHead}>
            <h3 className={styles.panelTitle}>
              <MapPin size={18} strokeWidth={1.75} />
              Asal Peserta
            </h3>
            <span className={styles.panelSub}>klik untuk filter</span>
          </div>
          <BarTable
            rows={stats.origin}
            activeKey={filters.region || null}
            onSelect={(key) => onFilterChange({ ...filters, region: key })}
          />
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHead}>
            <h3 className={styles.panelTitle}>
              <TrendingUp size={18} strokeWidth={1.75} />
              Topik Diminati
            </h3>
            <span className={styles.panelSub}>klik untuk filter</span>
          </div>
          <BarTable
            rows={stats.topik}
            rankNumbers
            colorScale={RANK_RAMP}
            activeKey={filters.topik || null}
            onSelect={(key) => onFilterChange({ ...filters, topik: key })}
          />
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHead}>
            <h3 className={styles.panelTitle}>
              <Cake size={18} strokeWidth={1.75} />
              Distribusi Usia
            </h3>
            <span className={styles.panelSub}>klik untuk filter</span>
          </div>
          <AgeChart
            rows={stats.usia}
            activeKey={filters.usia || null}
            onSelect={(key) => onFilterChange({ ...filters, usia: key })}
          />
        </div>
      </div>

    </DashboardShell>
  );
}
