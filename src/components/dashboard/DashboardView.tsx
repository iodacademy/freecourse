"use client";

import { useState, useMemo } from "react";
import {
  Users, Heart, Accessibility, GraduationCap, Smile, ShieldCheck,
  MapPin, TrendingUp, Cake,
} from "lucide-react";
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
    rerata: number; kepuasan: number; keyakinan: number;
    respondenSurvei1: number; respondenSurvei2: number;
    origin: Array<[string, number]>;
    topik: Array<[string, number]>;
    usia: Array<[string, number]>;
    lulusKuis: number;
    tidakLulusKuis: number;
    channelBreakdown: Record<string, { registered: number; completed: number }>;
    sourceList: Array<{ key: string; label: string; share: number }>;
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
}

const RANK_RAMP = ["#CC0000", "#EC5563", "#F18A93", "#F6B5BB", "#FAD9DC"];

export default function DashboardView({ data, mode, filters, onFilterChange, rightActions }: Props) {
  const { stats } = data;

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
          icon={<Users size={26} strokeWidth={1.75} />}
          variant="ink"
        />
        <KpiCard
          label="Completion Perempuan"
          value={stats.perempuan}
          completed={mode === "admin" ? stats.perempuanCompleted : undefined}
          target={stats.perempuanTarget}
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
          icon={<Accessibility size={26} strokeWidth={1.75} />}
          variant="red"
          clickable
          active={filters.disabilitas === "Ya"}
          onClick={() => toggle("disabilitas", "Ya")}
        />
      </div>

      {/* Row B — Metric */}
      <div className={styles.row4} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <MetricCard
          label="Rerata Nilai Peserta"
          value={stats.rerata}
          suffix="/ 100"
          icon={<GraduationCap size={22} strokeWidth={1.75} />}
          foot="Rata-rata nilai akhir pelatihan"
        />
        <MetricCard
          label="Lulus vs Gagal Kuis"
          value={stats.lulusKuis}
          suffix={` / ${stats.tidakLulusKuis}`}
          icon={<GraduationCap size={22} strokeWidth={1.75} />}
          foot="Total yang lulus vs tidak lulus kuis"
        />
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
