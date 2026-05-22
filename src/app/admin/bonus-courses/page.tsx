"use client";

import { useState } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import styles from "./page.module.css";
import type { BonusCourseTopic } from "@/lib/types";
import { Pencil, CheckCircle, XCircle } from "lucide-react";

// Dummy data
const DUMMY_BONUS: Partial<BonusCourseTopic>[] = [
  {
    id: "legal",
    name: "Legal & Hukum Bisnis",
    description: "Pelajari dasar hukum bisnis, kontrak, dan perlindungan konsumen.",
    classCode: "BLG81",
    status: "active",
  },
  {
    id: "hr",
    name: "Human Resource Management",
    description: "Kelola SDM dengan efektif: rekrutmen, pelatihan, dan retensi karyawan.",
    classCode: "BHR30",
    status: "active",
  },
  {
    id: "marketing",
    name: "Marketing Konvensional",
    description: "Strategi pemasaran offline.",
    classCode: "BMK21",
    status: "inactive",
  }
];

export default function AdminBonusCoursesPage() {
  const [topics] = useState(DUMMY_BONUS);

  return (
    <ProtectedRoute requireAdmin>
      <div className={styles.page}>
        <header className={styles.header}>
          <div>
            <h1 className={styles.title}>Kelola Kursus Tambahan</h1>
            <p className={styles.subtitle}>Atur topik kursus bonus yang bisa diklaim peserta setelah lulus.</p>
          </div>
          <button className="btn btn-primary">+ Tambah Topik</button>
        </header>

        <div className={styles.grid}>
          {topics.map((topic) => (
            <div key={topic.id} className={`${styles.card} ${topic.status === "inactive" ? styles.inactiveCard : ""}`}>
              <div className={styles.cardHeader}>
                <h3 className={styles.cardTitle}>{topic.name}</h3>
                <span className={`${styles.statusBadge} ${styles[topic.status!]}`}>
                  {topic.status === "active" ? "Aktif" : "Nonaktif"}
                </span>
              </div>
              <p className={styles.cardDesc}>{topic.description}</p>
              <div className={styles.cardMeta}>
                <span className={styles.codeLabel}>Kode Kelas:</span>
                <code className={styles.codeValue}>{topic.classCode}</code>
              </div>
              <div className={styles.cardActions}>
                <button className="btn btn-secondary w-full" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}><Pencil size={16} /> Edit Topik</button>
                <button className="btn btn-secondary" title={topic.status === "active" ? "Nonaktifkan" : "Aktifkan"} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {topic.status === "active" ? <XCircle size={16} /> : <CheckCircle size={16} />}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </ProtectedRoute>
  );
}
