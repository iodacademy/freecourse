"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useLearnLoading } from "@/contexts/LearnLoadingContext";
import { Loader2, Check, Copy, ExternalLink } from "lucide-react";

interface BonusTopic {
  id: string;
  name: string;
  description?: string;
  classCode: string;
  category?: string;
  groupLink?: string;
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
  const [groupLink, setGroupLink] = useState("");
  const [selectedTopicCategory, setSelectedTopicCategory] = useState("vl");
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
          // fetch topic to get category/groupLink
          const topicsRes = await fetch("/api/bonus-courses", {
            headers: { Authorization: `Bearer ${idToken}` },
            cache: "no-store",
          });
          if (topicsRes.ok) {
             const tData: BonusTopic[] = await topicsRes.json();
             setTopics(tData);
             const topic = tData.find((t) => t.id === main.bonusCourseTopicId);
             if (topic) {
               setSelectedTopicName(topic.name);
               setPortalUrl(topic.portalUrl || "https://app.iodacademy.id/portal-belajar/");
               setSelectedTopicCategory(topic.category || "vl");
               setGroupLink(topic.groupLink || "");
             }
          }
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
      setSelectedTopicCategory(topic?.category || "vl");
      setGroupLink(topic?.groupLink || "");
      setPortalUrl(topic?.portalUrl || "https://app.iodacademy.id/portal-belajar/");
      setEnrollment((prev) => prev ? { ...prev, bonusCourseRedeemCode: data.redeemCode, bonusCourseTopicId: selectedTopic } : prev);
    } catch { setError("Terjadi kesalahan jaringan."); }
    finally { setConfirming(false); }
  }

  function copyCode() {
    navigator.clipboard.writeText(redeemCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const showSuccess = !!redeemCode;

  const { signalReady } = useLearnLoading();
  useEffect(() => {
    if (!loading) signalReady();
  }, [loading, signalReady]);

  if (loading) return null;

  return (
    <>
      <div className="bonus-wrapper">
        <div className="bonus-container">

          {/* ── PILIH TOPIK ── */}
          {!showSuccess && (
            <div className="bonus-pick">
              <div className="bonus-head">
                <p className="bonus-eyebrow">KURSUS TAMBAHAN GRATIS</p>
                <h1 className="bonus-title">Pilih Satu Kursus Untukmu</h1>
                <p className="bonus-desc">
                  Selamat telah menyelesaikan Kursus Literasi Finansial! Sebagai hadiah,
                  kamu berhak memilih <strong>satu kursus tambahan gratis</strong> di portal IODA Academy.
                  Pilihan ini <strong>tidak bisa diubah</strong> setelah dikonfirmasi.
                </p>
              </div>

              {error && <p className="bonus-error">{error}</p>}

              {topics.length === 0 ? (
                <div className="bonus-empty">
                  Tidak ada kursus tersedia. Hubungi admin.
                </div>
              ) : (
                <div className="bonus-topics">
                  {topics.map((topic, index) => {
                    const isSelected = selectedTopic === topic.id;
                    return (
                      <button
                        key={topic.id}
                        className={`bonus-topic ${isSelected ? "bonus-topic--sel" : ""}`}
                        onClick={() => setSelectedTopic(topic.id)}
                      >
                        <span className="bonus-topic-num">{index + 1}</span>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
                          <span className="bonus-topic-name">{topic.name}</span>
                          {(topic.category === "wpb" || topic.category === "bootcamp") && topic.description && (
                            <span style={{ fontSize: 13, color: "var(--color-gray-600)", textAlign: "left", lineHeight: 1.4 }}>
                              {topic.description}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="bonus-confirm">
                <button
                  className="bonus-confirm-btn"
                  disabled={!selectedTopic || confirming}
                  onClick={handleConfirm}
                >
                  {confirming
                    ? <><Loader2 size={16} className="animate-spin" /> Memproses...</>
                    : "Konfirmasi Pilihan"}
                </button>
                {!selectedTopic && (
                  <p className="bonus-hint">Pilih salah satu kursus di atas</p>
                )}
              </div>
            </div>
          )}

          {/* ── SUKSES ── */}
          {showSuccess && (
            <div className="bonus-success">
              <div className="bonus-banner">
                <div className="bonus-badge">
                  <Check size={22} />
                </div>
                <h1 className="bonus-success-title">Kursus Siap Diakses!</h1>
                <p className="bonus-success-desc">
                  {selectedTopicName || "Kursus kamu"} sudah siap. Gunakan kode di bawah
                  untuk masuk ke portal belajar.
                </p>
              </div>

              <div className="bonus-code-card">
                <p className="bonus-code-label">KODE REDEEM</p>
                <div className="bonus-code-row">
                  <code className="bonus-code-text">{redeemCode}</code>
                  <button className="bonus-copy-btn" onClick={copyCode}>
                    {copied ? <Check size={15} /> : <Copy size={15} />}
                    {copied ? "Tersalin" : "Salin"}
                  </button>
                </div>
                <p className="bonus-code-note">
                  Email konfirmasi sudah dikirim ke {profile?.email}
                </p>
              </div>

              <a
                href={portalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="bonus-portal-btn"
              >
                Buka Portal Belajar
                <ExternalLink size={15} />
              </a>

              {(selectedTopicCategory === "wpb" || selectedTopicCategory === "bootcamp") && groupLink && (
                <a
                  href={groupLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bonus-portal-btn"
                  style={{ marginTop: 10, background: "#25D366", color: "#fff" }}
                >
                  Gabung Grup WhatsApp
                  <ExternalLink size={15} />
                </a>
              )}

              <div className="bonus-steps">
                <p className="bonus-steps-title">Cara penggunaan</p>
                <ol className="bonus-steps-list">
                  <li>Klik tombol Buka Portal Belajar di atas</li>
                  <li>Masukkan kode redeem di halaman login portal</li>
                  {(selectedTopicCategory === "wpb" || selectedTopicCategory === "bootcamp") && (
                    <li>Jangan lupa untuk bergabung dengan Grup WhatsApp melalui tombol di atas.</li>
                  )}
                </ol>
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  );
}
