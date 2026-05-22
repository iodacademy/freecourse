"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import Link from "next/link";
import styles from "./page.module.css";

// Data dummy dashboard
const STATS = [
  { label: "Total Siswa", value: "1,245", icon: "👥", trend: "+12%" },
  { label: "Sertifikat Diterbitkan", value: "856", icon: "🎓", trend: "+8%" },
  { label: "Workshop Mendatang", value: "3", icon: "📅", trend: "0%" },
  { label: "Kode Mitra Aktif", value: "24", icon: "🏷️", trend: "+5%" },
];

const RECENT_ACTIVITY = [
  { id: 1, user: "Budi Santoso", action: "Klaim Sertifikat", time: "10 menit yang lalu" },
  { id: 2, user: "Siti Aminah", action: "Mendaftar via Channel 1", time: "35 menit yang lalu" },
  { id: 3, user: "Anton Wijaya", action: "Lulus Assessment Bab 3", time: "1 jam yang lalu" },
  { id: 4, user: "Dian Paramita", action: "Memilih Kursus HR", time: "2 jam yang lalu" },
];

export default function AdminDashboard() {
  return (
    <ProtectedRoute requireAdmin>
      <div className={styles.dashboard}>
        <header className={styles.header}>
          <div>
            <h1 className={styles.title}>Dashboard Overview</h1>
            <p className={styles.subtitle}>Ringkasan aktivitas platform hari ini.</p>
          </div>
          <div className={styles.actions}>
            <button className="btn btn-secondary">Export Laporan</button>
            <Link href="/admin/events" className="btn btn-primary">
              + Buat Event Baru
            </Link>
          </div>
        </header>

        {/* Stats Grid */}
        <div className={styles.statsGrid}>
          {STATS.map((stat, i) => (
            <div key={i} className={styles.statCard}>
              <div className={styles.statHeader}>
                <span className={styles.statIcon}>{stat.icon}</span>
                <span className={`${styles.statTrend} ${stat.trend.startsWith("+") ? styles.trendUp : ""}`}>
                  {stat.trend}
                </span>
              </div>
              <p className={styles.statLabel}>{stat.label}</p>
              <h3 className={styles.statValue}>{stat.value}</h3>
            </div>
          ))}
        </div>

        {/* Bottom Section */}
        <div className={styles.bottomSection}>
          {/* Recent Activity */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>Aktivitas Terbaru</h2>
              <button className={styles.textBtn}>Lihat Semua</button>
            </div>
            <div className={styles.activityList}>
              {RECENT_ACTIVITY.map((act) => (
                <div key={act.id} className={styles.activityItem}>
                  <div className={styles.activityDot} />
                  <div className={styles.activityContent}>
                    <p className={styles.activityText}>
                      <strong>{act.user}</strong> {act.action}
                    </p>
                    <span className={styles.activityTime}>{act.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>Akses Cepat</h2>
            </div>
            <div className={styles.quickLinks}>
              <Link href="/admin/courses" className={styles.quickLink}>
                <span className={styles.quickLinkIcon}>📖</span>
                <div>
                  <h4>Edit Materi Kursus</h4>
                  <p>Update video, soal, atau survei</p>
                </div>
                <span className={styles.quickLinkArrow}>→</span>
              </Link>
              <Link href="/admin/partner-codes" className={styles.quickLink}>
                <span className={styles.quickLinkIcon}>🏷️</span>
                <div>
                  <h4>Kelola Kode Mitra</h4>
                  <p>Tambah atau nonaktifkan kode</p>
                </div>
                <span className={styles.quickLinkArrow}>→</span>
              </Link>
              <Link href="/admin/students" className={styles.quickLink}>
                <span className={styles.quickLinkIcon}>👥</span>
                <div>
                  <h4>Data Siswa</h4>
                  <p>Lihat progress dan export data</p>
                </div>
                <span className={styles.quickLinkArrow}>→</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
