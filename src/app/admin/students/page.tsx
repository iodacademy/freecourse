"use client";

import { useState } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import styles from "./page.module.css";
import type { UserProfile } from "@/lib/types";

// Dummy data
const DUMMY_STUDENTS: Partial<UserProfile>[] = [
  {
    uid: "u001",
    displayName: "Rohmat Ramadhan",
    email: "rohmat@example.com",
    channelSource: "b2c_ads",
    profileCompleted: true,
    createdAt: new Date("2026-05-15"),
  },
  {
    uid: "u002",
    displayName: "Budi Santoso",
    email: "budi@example.com",
    channelSource: "b2b_campus",
    partnerCode: "UNIVX2026",
    profileCompleted: true,
    createdAt: new Date("2026-05-18"),
  },
  {
    uid: "u003",
    displayName: "Siti Aminah",
    email: "siti@example.com",
    channelSource: "b2c_workshop",
    profileCompleted: false,
    createdAt: new Date("2026-05-20"),
  }
];

export default function AdminStudentsPage() {
  const [students] = useState(DUMMY_STUDENTS);
  const [filter, setFilter] = useState("all");

  const filteredStudents = students.filter((s) => {
    if (filter === "all") return true;
    return s.channelSource === filter;
  });

  return (
    <ProtectedRoute requireAdmin>
      <div className={styles.page}>
        <header className={styles.header}>
          <div>
            <h1 className={styles.title}>Data Siswa</h1>
            <p className={styles.subtitle}>Pantau pendaftaran dan progress belajar siswa.</p>
          </div>
          <button className="btn btn-primary">📥 Export ke Excel</button>
        </header>

        <div className={styles.filters}>
          <button
            className={`${styles.filterBtn} ${filter === "all" ? styles.active : ""}`}
            onClick={() => setFilter("all")}
          >
            Semua Siswa
          </button>
          <button
            className={`${styles.filterBtn} ${filter === "b2b_campus" ? styles.active : ""}`}
            onClick={() => setFilter("b2b_campus")}
          >
            Channel 1 (B2B)
          </button>
          <button
            className={`${styles.filterBtn} ${filter === "b2c_ads" ? styles.active : ""}`}
            onClick={() => setFilter("b2c_ads")}
          >
            Channel 2 (Ads)
          </button>
          <button
            className={`${styles.filterBtn} ${filter === "b2c_workshop" ? styles.active : ""}`}
            onClick={() => setFilter("b2c_workshop")}
          >
            Channel 3 (Workshop)
          </button>
        </div>

        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Nama Siswa</th>
                <th>Email</th>
                <th>Channel Pendaftaran</th>
                <th>Status Profil</th>
                <th>Tanggal Daftar</th>
                <th className={styles.actionsCell}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((s) => (
                <tr key={s.uid}>
                  <td className={styles.fw500}>{s.displayName}</td>
                  <td className={styles.textSm}>{s.email}</td>
                  <td>
                    <div className={styles.channelInfo}>
                      <span className={styles.channelBadge}>
                        {s.channelSource === "b2b_campus" ? "B2B Kampus" :
                         s.channelSource === "b2c_ads" ? "Ads Campaign" : "Workshop"}
                      </span>
                      {s.partnerCode && <code className={styles.partnerCode}>{s.partnerCode}</code>}
                    </div>
                  </td>
                  <td>
                    {s.profileCompleted ? (
                      <span className={`${styles.statusBadge} ${styles.complete}`}>Lengkap</span>
                    ) : (
                      <span className={`${styles.statusBadge} ${styles.incomplete}`}>Belum Lengkap</span>
                    )}
                  </td>
                  <td>{s.createdAt?.toLocaleDateString("id-ID")}</td>
                  <td className={styles.actionsCell}>
                    <button className={styles.iconBtn} title="Lihat Progress">📊</button>
                    <button className={styles.iconBtn} title="Detail Siswa">👁️</button>
                  </td>
                </tr>
              ))}
              {filteredStudents.length === 0 && (
                <tr>
                  <td colSpan={6} className={styles.emptyState}>
                    Tidak ada data siswa ditemukan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </ProtectedRoute>
  );
}
