"use client";

import { useState } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import styles from "./page.module.css";

// Data dummy — nanti dari Firestore (bonusCourseTopics collection)
const DUMMY_TOPICS = [
  {
    id: "legal",
    name: "Legal & Hukum Bisnis",
    description: "Pelajari dasar hukum bisnis, kontrak, dan perlindungan konsumen.",
    classCode: "BLG81",
    icon: "⚖️",
  },
  {
    id: "hr",
    name: "Human Resource Management",
    description: "Kelola SDM dengan efektif: rekrutmen, pelatihan, dan retensi karyawan.",
    classCode: "BHR30",
    icon: "👥",
  },
  {
    id: "digital",
    name: "Digital Marketing",
    description: "Strategi pemasaran digital: SEO, social media, dan content marketing.",
    classCode: "BDM45",
    icon: "📱",
  },
  {
    id: "finance",
    name: "Akuntansi & Keuangan",
    description: "Dasar pembukuan, laporan keuangan, dan analisis bisnis.",
    classCode: "BAK22",
    icon: "📊",
  },
];

export default function BonusCoursePage() {
  const { profile } = useAuth();
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [redeemCode, setRedeemCode] = useState("");

  const selectedData = DUMMY_TOPICS.find((t) => t.id === selectedTopic);

  function handleConfirm() {
    if (!selectedData || !profile) return;
    // Generate kode redeem: emailUsername + classCode
    const code = `${profile.emailUsername}${selectedData.classCode}`;
    setRedeemCode(code);
    setConfirmed(true);
    // Nanti: simpan ke Firestore
  }

  function copyCode() {
    navigator.clipboard.writeText(redeemCode);
  }

  return (
    <ProtectedRoute>
      <div className={styles.wrapper}>
        <div className={`container ${styles.content}`}>
          {!confirmed ? (
            <>
              <div className={styles.header}>
                <span className={styles.headerIcon}>🎁</span>
                <h1>Pilih Kursus Tambahan</h1>
                <p>
                  Selamat! Sebagai pemegang sertifikat, kamu berhak memilih
                  <strong> satu kursus tambahan gratis</strong> dari pilihan
                  berikut. Kursus ini bisa kamu akses di portal belajar IODA
                  Academy.
                </p>
              </div>

              <div className={styles.topicGrid}>
                {DUMMY_TOPICS.map((topic) => (
                  <button
                    key={topic.id}
                    className={`${styles.topicCard} ${
                      selectedTopic === topic.id ? styles.topicSelected : ""
                    }`}
                    onClick={() => setSelectedTopic(topic.id)}
                  >
                    <span className={styles.topicIcon}>{topic.icon}</span>
                    <h3 className={styles.topicName}>{topic.name}</h3>
                    <p className={styles.topicDesc}>{topic.description}</p>
                    {selectedTopic === topic.id && (
                      <span className={styles.selectedCheck}>✓ Dipilih</span>
                    )}
                  </button>
                ))}
              </div>

              <button
                className="btn btn-primary btn-lg w-full"
                disabled={!selectedTopic}
                onClick={handleConfirm}
              >
                Konfirmasi Pilihan
              </button>

              {!selectedTopic && (
                <p className={styles.selectHint}>
                  Pilih salah satu topik di atas untuk melanjutkan.
                </p>
              )}
            </>
          ) : (
            /* Success — tampilkan kode redeem */
            <div className={styles.successCard}>
              <span className={styles.successIcon}>🎉</span>
              <h1>Kursus Tambahan Siap!</h1>
              <p className={styles.successSubtitle}>
                Kamu memilih kursus <strong>{selectedData?.name}</strong>. Gunakan
                kode redeem di bawah untuk mengakses portal belajar.
              </p>

              {/* Redeem Code Box */}
              <div className={styles.redeemBox}>
                <span className={styles.redeemLabel}>Kode Redeem Kamu</span>
                <div className={styles.redeemCode}>
                  <code>{redeemCode}</code>
                  <button
                    className={styles.copyBtn}
                    onClick={copyCode}
                    title="Salin kode"
                  >
                    📋
                  </button>
                </div>
                <span className={styles.redeemHint}>
                  Gabungan dari username email + kode kelas
                </span>
              </div>

              {/* Portal Link */}
              <div className={styles.portalBox}>
                <p className={styles.portalLabel}>
                  Masukkan kode di atas di halaman:
                </p>
                <a
                  href="https://app.iodacademy.id/portal-belajar/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary btn-lg w-full"
                >
                  Buka Portal Belajar →
                </a>
              </div>

              {/* Steps */}
              <div className={styles.howTo}>
                <h3>Cara Menggunakan Kode Redeem:</h3>
                <ol>
                  <li>Buka link portal belajar di atas</li>
                  <li>Di halaman login, masukkan <strong>kode redeem</strong> kamu</li>
                  <li>Kamu akan langsung bisa mengakses materi kursus {selectedData?.name}</li>
                </ol>
              </div>
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
