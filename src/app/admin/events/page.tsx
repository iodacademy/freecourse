"use client";

import { useState } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import styles from "./page.module.css";
import type { Event } from "@/lib/types";

// Dummy data
const DUMMY_EVENTS: Partial<Event>[] = [
  {
    id: "evt-001",
    name: "Workshop Finansial Gen-Z",
    channelType: "b2c_workshop",
    status: "active",
    startDate: new Date("2026-05-25"),
    workshopConfig: {
      capacity: 500,
      currentRegistrants: 342,
      schedule: new Date("2026-05-28T10:00:00"),
    } as any,
  },
  {
    id: "evt-002",
    name: "Campaign IG Ads - Literasi Merdeka",
    channelType: "b2c_ads",
    status: "active",
    startDate: new Date("2026-05-01"),
    landingPageConfig: {
      heroTitle: "Merdeka Finansial Sekarang!",
    } as any,
  },
  {
    id: "evt-003",
    name: "Webinar Investasi Pemula",
    channelType: "b2c_workshop",
    status: "draft",
    startDate: new Date("2026-06-15"),
    workshopConfig: {
      capacity: 1000,
      currentRegistrants: 0,
      schedule: new Date("2026-06-20T13:00:00"),
    } as any,
  },
];

export default function AdminEventsPage() {
  const [events] = useState(DUMMY_EVENTS);
  const [filter, setFilter] = useState("all");

  const filteredEvents = events.filter((e) => {
    if (filter === "all") return true;
    return e.channelType === filter;
  });

  return (
    <ProtectedRoute requireAdmin>
      <div className={styles.page}>
        <header className={styles.header}>
          <div>
            <h1 className={styles.title}>Kelola Event & Campaign</h1>
            <p className={styles.subtitle}>Atur landing page Ads dan pendaftaran Workshop.</p>
          </div>
          <button className="btn btn-primary">+ Buat Event Baru</button>
        </header>

        <div className={styles.filters}>
          <button
            className={`${styles.filterBtn} ${filter === "all" ? styles.active : ""}`}
            onClick={() => setFilter("all")}
          >
            Semua Event
          </button>
          <button
            className={`${styles.filterBtn} ${filter === "b2c_ads" ? styles.active : ""}`}
            onClick={() => setFilter("b2c_ads")}
          >
            Campaign Ads (Ch 2)
          </button>
          <button
            className={`${styles.filterBtn} ${filter === "b2c_workshop" ? styles.active : ""}`}
            onClick={() => setFilter("b2c_workshop")}
          >
            Workshop (Ch 3)
          </button>
        </div>

        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Nama Event</th>
                <th>Tipe Channel</th>
                <th>Status</th>
                <th>Tanggal Mulai</th>
                <th>Info Tambahan</th>
                <th className={styles.actionsCell}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredEvents.map((evt) => (
                <tr key={evt.id}>
                  <td className={styles.fw500}>{evt.name}</td>
                  <td>
                    <span className={styles.channelBadge}>
                      {evt.channelType === "b2c_ads" ? "🎯 Ads" : "🎤 Workshop"}
                    </span>
                  </td>
                  <td>
                    <span className={`${styles.statusBadge} ${styles[evt.status!]}`}>
                      {evt.status === "active" ? "Aktif" : evt.status === "draft" ? "Draft" : "Selesai"}
                    </span>
                  </td>
                  <td>{evt.startDate?.toLocaleDateString("id-ID")}</td>
                  <td className={styles.textSm}>
                    {evt.channelType === "b2c_workshop" ? (
                      <span className={styles.registrants}>
                        👥 {evt.workshopConfig?.currentRegistrants} / {evt.workshopConfig?.capacity} pendaftar
                      </span>
                    ) : (
                      <span className={styles.linkInfo}>
                        🔗 /campaign/{evt.id}
                      </span>
                    )}
                  </td>
                  <td className={styles.actionsCell}>
                    <button className={styles.iconBtn} title="Edit">✏️</button>
                    <button className={styles.iconBtn} title="Lihat Landing Page">👁️</button>
                    <button className={styles.iconBtn} title="Hapus">🗑️</button>
                  </td>
                </tr>
              ))}
              {filteredEvents.length === 0 && (
                <tr>
                  <td colSpan={6} className={styles.emptyState}>
                    Tidak ada event yang ditemukan.
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
