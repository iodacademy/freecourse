"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, Check, Copy, ExternalLink, ChevronRight } from "lucide-react";
import styles from "./page.module.css";

interface BonusTopic {
  id: string;
  name: string;
  description: string;
  classCode: string;
  portalUrl?: string;
}

interface EnrollmentData {
  id: string;
  courseId: string;
  channelSource?: string;
  certificateClaimed: boolean;
  bonusCourseTopicId?: string;
  bonusCourseRedeemCode?: string;
}

export default function BonusCoursePage() {
  const { user, profile } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [enrollment, setEnrollment] = useState<EnrollmentData | null>(null);
  const [topics, setTopics] = useState<BonusTopic[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const [redeemCode, setRedeemCode] = useState("");
  const [selectedTopicName, setSelectedTopicName] = useState("");
  const [portalUrl, setPortalUrl] = useState("https://app.iodacademy.id/portal-belajar/");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user) return;
    async function load() {
      try {
        const idToken = await user!.getIdToken();
        const enrollRes = await fetch("/api/enrollments", {
          headers: { Authorization: `Bearer ${idToken}` },
          cache: "no-store",
        });
        if (!enrollRes.ok) throw new Error();
        const enrollments: EnrollmentData[] = await enrollRes.json();
        const main = enrollments.find((e) => e.courseId === "course-main");
        if (!main) { router.push("/learn"); return; }
        if (main.channelSource !== "beasiswa") { router.push("/learn"); return; }
        if (!main.certificateClaimed) { router.push("/learn/certificate"); return; }
        setEnrollment(main);
        if (main.bonusCourseRedeemCode) {
          setRedeemCode(main.bonusCourseRedeemCode);
          return;
        }
        const topicsRes = await fetch("/api/bonus-courses", {
          headers: { Authorization: `Bearer ${idToken}` },
          cache: "no-store",
        });
        if (topicsRes.ok) setTopics(await topicsRes.json());
      } catch { setError("Gagal memuat data."); }
      finally { setLoading(false); }
    }
    load();
  }, [user, router]);

  async function handleConfirm() {
    if (!selectedTopic || !enrollment || !user) return;
    setConfirming(true);
    setError("");
    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/enrollments/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ enrollmentId: enrollment.id, topicId: selectedTopic }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Gagal generate kode."); return; }
      const topic = topics.find((t) => t.id === selectedTopic);
      setRedeemCode(data.redeemCode);
      setSelectedTopicName(topic?.name || "");
      setPortalUrl(topic?.portalUrl || "https://app.iodacademy.id/portal-belajar/");
      setEnrollment((prev) => prev ? { ...prev, bonusCourseRedeemCode: data.redeemCode } : prev);
    } catch { setError("Terjadi kesalahan jaringan."); }
    finally { setConfirming(false); }
  }

  function copyCode() {
    navigator.clipboard.writeText(redeemCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const showSuccess = !!redeemCode;

  if (loading) {
    return (
      <ProtectedRoute>
        <div className={styles.centered}>
          <Loader2 size={28} className={styles.spinner} />
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className={styles.wrapper}>
        <div className={styles.container}>

          {/* ── PILIH TOPIK ── */}
          {!showSuccess && (
            <div className={styles.pickSection}>
              <div className={styles.pageHead}>
                <p className={styles.eyebrow}>KURSUS TAMBAHAN GRATIS</p>
                <h1 className={styles.pageTitle}>Pilih Satu Kursus Untukmu</h1>
                <p className={styles.pageDesc}>
                  Selamat telah menyelesaikan Kursus Literasi Finansial! Sebagai hadiah,
                  kamu berhak memilih <strong>satu kursus tambahan gratis</strong> di portal IODA Academy.
                  Pilihan ini <strong>tidak bisa diubah</strong> setelah dikonfirmasi.
                </p>
              </div>

              {error && <p className={styles.errorMsg}>{error}</p>}

              {topics.length === 0 ? (
                <div className={styles.emptyState}>
                  Tidak ada kursus tersedia. Hubungi admin.
                </div>
              ) : (
                <div className={styles.topicList}>
                  {topics.map((topic, index) => {
                    const isSelected = selectedTopic === topic.id;
                    return (
                      <button
                        key={topic.id}
                        className={`${styles.topicRow} ${isSelected ? styles.topicRowSelected : ""}`}
                        onClick={() => setSelectedTopic(topic.id)}
                      >
                        <span className={styles.topicNumber}>{index + 1}</span>
                        <span className={styles.topicRowName}>{topic.name}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              <div className={styles.confirmArea}>
                <button
                  className={styles.confirmBtn}
                  disabled={!selectedTopic || confirming}
                  onClick={handleConfirm}
                >
                  {confirming
                    ? <><Loader2 size={16} className={styles.spinner} /> Memproses...</>
                    : "Konfirmasi Pilihan"}
                </button>
                {!selectedTopic && (
                  <p className={styles.hint}>Pilih salah satu kursus di atas</p>
                )}
              </div>
            </div>
          )}

          {/* ── SUKSES ── */}
          {showSuccess && (
            <div className={styles.successSection}>
              <div className={styles.successBanner}>
                <div className={styles.successBadge}>
                  <Check size={22} />
                </div>
                <h1 className={styles.successTitle}>Kursus Siap Diakses!</h1>
                <p className={styles.successDesc}>
                  {selectedTopicName || "Kursus kamu"} sudah siap. Gunakan kode di bawah
                  untuk masuk ke portal belajar.
                </p>
              </div>

              <div className={styles.codeCard}>
                <p className={styles.codeLabel}>KODE REDEEM</p>
                <div className={styles.codeRow}>
                  <code className={styles.codeText}>{redeemCode}</code>
                  <button className={styles.copyBtn} onClick={copyCode}>
                    {copied ? <Check size={15} /> : <Copy size={15} />}
                    {copied ? "Tersalin" : "Salin"}
                  </button>
                </div>
                <p className={styles.codeNote}>
                  Email konfirmasi sudah dikirim ke {profile?.email}
                </p>
              </div>

              <a
                href={portalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.portalBtn}
              >
                Buka Portal Belajar
                <ExternalLink size={15} />
              </a>

              <div className={styles.steps}>
                <p className={styles.stepsTitle}>Cara penggunaan</p>
                <ol className={styles.stepsList}>
                  <li>Klik tombol di atas untuk membuka portal belajar</li>
                  <li>Masukkan kode redeem di halaman login</li>
                  <li>Akses materi kursus langsung</li>
                </ol>
              </div>
            </div>
          )}

        </div>
      </div>
    </ProtectedRoute>
  );
}
