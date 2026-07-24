"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useLearnLoading } from "@/contexts/LearnLoadingContext";
import { Loader2, Check, Copy, ExternalLink, Download, Upload, FileText } from "lucide-react";
import type { BenefitCategory } from "@/lib/types";
import { isBenefitCategoryAllowed, isBenefitTopicAllowed, resolveBenefitCategories, resolveBenefitTopicIds } from "@/lib/benefit-categories";

interface WorkshopData {
  date?: string;
  time?: string;
  platform?: string;
  meetingLink?: string;
  waGroupLink?: string;
}

interface BonusTopic {
  id: string;
  name: string;
  description?: string;
  classCode?: string;
  category?: string;
  benefitType?: string;
  groupLink?: string;
  portalUrl?: string;
  lastSessionDate?: string;
  workshopData?: WorkshopData;
  downloadUrl?: string;
}

interface EnrollmentData {
  id: string;
  courseId: string;
  channelSource?: string;
  certificateClaimed: boolean;
  benefitClaimed?: boolean;
  bonusCourseTopicId?: string;
  bonusCourseRedeemCode?: string;
  beasiswaType?: string;
  eventId?: string;
}

// Map query ?cat= ke daftar kategori topik yang cocok.
function catMatches(cat: string | null, topicCategory: string): boolean {
  const c = topicCategory || "vl";
  if (!cat) return true;
  if (cat === "vl") return c === "vl" || c === "wpb"; // wpb lama diperlakukan sbg VL
  if (cat === "workshop") return c === "workshop";
  if (cat === "bootcamp") return c === "bootcamp";
  if (cat === "lainnya") return c === "review_cv" || c === "downloadable";
  return c === cat;
}

async function loadAllowedBenefit(
  eventId: string
): Promise<{ categories: BenefitCategory[] | null; topicIds: string[] | null }> {
  try {
    const res = await fetch(`/api/events/public/${encodeURIComponent(eventId)}`, { cache: "no-store" });
    if (!res.ok) return { categories: null, topicIds: null };
    const data = await res.json();
    return { categories: resolveBenefitCategories(data), topicIds: resolveBenefitTopicIds(data) };
  } catch {
    return { categories: null, topicIds: null };
  }
}

export default function BonusCoursePage() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const targetCategory = searchParams.get("cat");

  const [loading, setLoading] = useState(true);
  const [enrollment, setEnrollment] = useState<EnrollmentData | null>(null);
  const [topics, setTopics] = useState<BonusTopic[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");

  // Hasil (success) — beragam bentuk tergantung kategori
  const [resultKind, setResultKind] = useState<"" | "code" | "workshop" | "downloadable" | "review_cv">("");
  const [redeemCode, setRedeemCode] = useState("");
  const [selectedTopicName, setSelectedTopicName] = useState("");
  const [portalUrl, setPortalUrl] = useState("https://app.iodacademy.id/portal-belajar/");
  const [groupLink, setGroupLink] = useState("");
  const [downloadUrl, setDownloadUrl] = useState("");
  const [selectedTopicCategory, setSelectedTopicCategory] = useState("vl");
  const [copied, setCopied] = useState(false);

  // Form Review CV
  const [cvName, setCvName] = useState("");
  const [cvEmail, setCvEmail] = useState("");
  const [cvFile, setCvFile] = useState<File | null>(null);

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
        // Benefit tersedia untuk semua jalur yang punya channelSource.
        if (!main.channelSource) { router.push("/learn"); return; }
        if (!main.certificateClaimed) { router.push("/learn/certificate"); return; }
        setEnrollment(main);

        // Sudah pernah KLAIM benefit → tampilkan status yang sesuai.
        // Bukti klaim: flag benefitClaimed (baru) ATAU bonusCourseRedeemCode (jejak data lama).
        // beasiswaType TIDAK dipakai sebagai bukti klaim — itu hanya penanda kategori yang
        // bisa terisi oleh auto-complete admin tanpa peserta pernah mengklaim benefit.
        if (main.benefitClaimed || main.bonusCourseRedeemCode) {
          const topicsRes = await fetch("/api/bonus-courses", {
            headers: { Authorization: `Bearer ${idToken}` }, cache: "no-store",
          });
          const tData: BonusTopic[] = topicsRes.ok ? await topicsRes.json() : [];
          const topic = tData.find((t) => t.id === main.bonusCourseTopicId);
          const bType = main.beasiswaType || topic?.category || "vl";
          setSelectedTopicName(topic?.name || "");
          setSelectedTopicCategory(bType);
          if (main.bonusCourseRedeemCode) {
            setRedeemCode(main.bonusCourseRedeemCode);
            setPortalUrl(topic?.portalUrl || "https://app.iodacademy.id/portal-belajar/");
            setGroupLink(topic?.groupLink || "");
            setResultKind("code");
          } else if (bType === "workshop") {
            setGroupLink(topic?.workshopData?.waGroupLink || topic?.groupLink || "");
            setResultKind("workshop");
          } else if (bType === "downloadable") {
            setDownloadUrl(topic?.downloadUrl || "");
            setResultKind("downloadable");
          } else if (bType === "review_cv") {
            setResultKind("review_cv");
          }
          return;
        }

        // Belum pilih → tampilkan daftar sesuai ?cat=
        const [topicsRes, allowed] = await Promise.all([
          fetch("/api/bonus-courses", {
            headers: { Authorization: `Bearer ${idToken}` }, cache: "no-store",
          }),
          main.eventId ? loadAllowedBenefit(main.eventId) : Promise.resolve({ categories: null, topicIds: null }),
        ]);
        if (topicsRes.ok) {
          const tData: BonusTopic[] = await topicsRes.json();
          setTopics(tData.filter((t) => (
            catMatches(targetCategory, t.category || "vl") &&
            isBenefitCategoryAllowed(t.category || "vl", allowed.categories) &&
            isBenefitTopicAllowed(t.id, allowed.topicIds)
          )));
        }
      } catch { setError("Gagal memuat data."); }
      finally { setLoading(false); }
    }
    load();
  }, [user, router, targetCategory]);

  // Prefill form Review CV dari profil
  useEffect(() => {
    if (profile) {
      setCvName((prev) => prev || (profile.profileData?.namaLengkap as string) || profile.displayName || "");
      setCvEmail((prev) => prev || profile.email || "");
    }
  }, [profile]);

  const selected = topics.find((t) => t.id === selectedTopic) || null;
  const selectedCat = selected?.category || "vl";

  async function handleConfirm() {
    if (!selected || !enrollment || !user) return;
    setConfirming(true);
    setError("");
    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/enrollments/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ enrollmentId: enrollment.id, topicId: selected.id }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Gagal memproses pilihan."); return; }

      setSelectedTopicName(selected.name);
      setSelectedTopicCategory(selectedCat);
      if (data.category === "workshop") {
        setGroupLink(data.groupLink || selected.workshopData?.waGroupLink || "");
        setResultKind("workshop");
      } else if (data.category === "downloadable") {
        setDownloadUrl(data.downloadUrl || selected.downloadUrl || "");
        setResultKind("downloadable");
      } else {
        setRedeemCode(data.redeemCode);
        setGroupLink(selected.groupLink || "");
        setPortalUrl(selected.portalUrl || "https://app.iodacademy.id/portal-belajar/");
        setResultKind("code");
      }
      setEnrollment((prev) => prev ? { ...prev, bonusCourseTopicId: selected.id, beasiswaType: data.category } : prev);
    } catch { setError("Terjadi kesalahan jaringan."); }
    finally { setConfirming(false); }
  }

  async function handleSubmitCv() {
    if (!selected || !enrollment || !user || !cvFile) return;
    setError("");
    if (cvFile.type !== "application/pdf") { setError("File CV harus PDF."); return; }
    if (cvFile.size > 5 * 1024 * 1024) { setError("Ukuran file maksimal 5MB."); return; }
    if (!cvName.trim() || !cvEmail.trim()) { setError("Nama & email wajib diisi."); return; }
    setConfirming(true);
    try {
      const idToken = await user.getIdToken();
      const fd = new FormData();
      fd.append("file", cvFile);
      fd.append("enrollmentId", enrollment.id);
      fd.append("topicId", selected.id);
      fd.append("namaLengkap", cvName.trim());
      fd.append("email", cvEmail.trim());
      const res = await fetch("/api/enrollments/review-cv", {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}` },
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Gagal mengirim CV."); return; }
      setSelectedTopicName(selected.name);
      setResultKind("review_cv");
      setEnrollment((prev) => prev ? { ...prev, bonusCourseTopicId: selected.id, beasiswaType: "review_cv" } : prev);
    } catch { setError("Terjadi kesalahan jaringan."); }
    finally { setConfirming(false); }
  }

  function copyCode() {
    navigator.clipboard.writeText(redeemCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const showSuccess = !!resultKind;

  const { signalReady } = useLearnLoading();
  useEffect(() => {
    if (!loading) signalReady();
  }, [loading, signalReady]);

  if (loading) return null;

  return (
    <>
      <div className="bonus-wrapper">
        <div className="bonus-container">

          {/* ── PILIH / FORM ── */}
          {!showSuccess && (
            <div className="bonus-pick">
              <div className="bonus-head">
                <p className="bonus-eyebrow">BENEFIT GRATIS</p>
                <h1 className="bonus-title">Pilih Benefit Untukmu</h1>
                <p className="bonus-desc">
                  Selamat telah menyelesaikan Kursus Literasi Finansial! Sebagai hadiah,
                  kamu berhak memilih <strong>satu benefit gratis</strong>.
                  Pilihan ini <strong>tidak bisa diubah</strong> setelah dikonfirmasi.
                </p>
              </div>

              {error && <p className="bonus-error">{error}</p>}

              {topics.length === 0 ? (
                <div className="bonus-empty">
                  Tidak ada benefit tersedia untuk kategori ini. Hubungi admin.
                </div>
              ) : (
                <div className="bonus-topics">
                  {topics.map((topic, index) => {
                    const isSelected = selectedTopic === topic.id;
                    const cat = topic.category || "vl";
                    return (
                      <button
                        key={topic.id}
                        className={`bonus-topic ${isSelected ? "bonus-topic--sel" : ""}`}
                        onClick={() => setSelectedTopic(topic.id)}
                      >
                        <span className="bonus-topic-num">{index + 1}</span>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
                          <span className="bonus-topic-name">{topic.name}</span>
                          {(cat === "bootcamp" || cat === "review_cv" || cat === "downloadable") && topic.description && (
                            <span style={{ fontSize: 13, color: "var(--color-gray-600)", textAlign: "left", lineHeight: 1.4, marginTop: 4 }}>
                              {topic.description}
                            </span>
                          )}
                          {cat === "workshop" && (
                            <span style={{ fontSize: 13, color: "var(--color-gray-600)", textAlign: "left", lineHeight: 1.4, marginTop: 4 }}>
                              {[topic.workshopData?.date, topic.workshopData?.time, topic.workshopData?.platform].filter(Boolean).join(" · ")}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Form Review CV muncul saat topik review_cv dipilih */}
              {selected && selectedCat === "review_cv" ? (
                <div className="bonus-confirm" style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "stretch" }}>
                  <p style={{ fontSize: 13, color: "var(--color-gray-600)", margin: 0 }}>
                    Data di bawah diambil dari profil kamu. Perbaiki bila perlu sebelum kirim CV.
                  </p>
                  <label style={{ fontSize: 13, fontWeight: 600 }}>Nama Lengkap (sesuai sertifikat)</label>
                  <input type="text" value={cvName} onChange={(e) => setCvName(e.target.value)}
                    style={{ padding: "10px 14px", borderRadius: 10, border: "1.5px solid #ddd", fontSize: 15 }} />
                  <label style={{ fontSize: 13, fontWeight: 600 }}>Email</label>
                  <input type="email" value={cvEmail} onChange={(e) => setCvEmail(e.target.value)}
                    style={{ padding: "10px 14px", borderRadius: 10, border: "1.5px solid #ddd", fontSize: 15 }} />
                  <label style={{ fontSize: 13, fontWeight: 600 }}>Upload CV (PDF, maks 5MB)</label>
                  <label style={{
                    display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 10,
                    border: "1.5px dashed #bbb", cursor: "pointer", fontSize: 14, color: "#555",
                  }}>
                    <Upload size={16} />
                    {cvFile ? cvFile.name : "Pilih file CV (.pdf)"}
                    <input type="file" accept="application/pdf" style={{ display: "none" }}
                      onChange={(e) => setCvFile(e.target.files?.[0] || null)} />
                  </label>
                  <button className="bonus-confirm-btn" disabled={!cvFile || confirming} onClick={handleSubmitCv}>
                    {confirming ? <><Loader2 size={16} className="animate-spin" /> Mengirim...</> : "Kirim CV"}
                  </button>
                </div>
              ) : (
                <div className="bonus-confirm">
                  <button className="bonus-confirm-btn" disabled={!selectedTopic || confirming} onClick={handleConfirm}>
                    {confirming
                      ? <><Loader2 size={16} className="animate-spin" /> Memproses...</>
                      : "Konfirmasi Pilihan"}
                  </button>
                  {!selectedTopic && <p className="bonus-hint">Pilih salah satu benefit di atas</p>}
                </div>
              )}
            </div>
          )}

          {/* ── SUKSES: KODE REDEEM (vl / bootcamp) ── */}
          {resultKind === "code" && (
            <div className="bonus-success">
              <div className="bonus-banner">
                <div className="bonus-badge"><Check size={22} /></div>
                <h1 className="bonus-success-title">Benefit Siap Diakses!</h1>
                <p className="bonus-success-desc">
                  {selectedTopicName || "Benefit kamu"} sudah siap. Gunakan kode di bawah untuk masuk ke portal belajar.
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
                <p className="bonus-code-note">Email konfirmasi sudah dikirim ke {profile?.email}</p>
              </div>

              <a href={portalUrl} target="_blank" rel="noopener noreferrer" className="bonus-portal-btn">
                Buka Portal Belajar <ExternalLink size={15} />
              </a>

              {selectedTopicCategory === "bootcamp" && groupLink && (
                <a href={groupLink} target="_blank" rel="noopener noreferrer" className="bonus-portal-btn"
                  style={{ marginTop: 10, background: "#25D366", color: "#fff" }}>
                  Gabung Grup WhatsApp <ExternalLink size={15} />
                </a>
              )}

              <div className="bonus-steps">
                <p className="bonus-steps-title">Cara penggunaan</p>
                <ol className="bonus-steps-list">
                  <li>Klik tombol Buka Portal Belajar di atas</li>
                  <li>Masukkan kode redeem di halaman login portal</li>
                  {selectedTopicCategory === "bootcamp" && (
                    <li>Jangan lupa untuk bergabung dengan Grup WhatsApp melalui tombol di atas.</li>
                  )}
                </ol>
              </div>
            </div>
          )}

          {/* ── SUKSES: WORKSHOP ── */}
          {resultKind === "workshop" && (
            <div className="bonus-success">
              <div className="bonus-banner">
                <div className="bonus-badge"><Check size={22} /></div>
                <h1 className="bonus-success-title">Pendaftaran Workshop Berhasil!</h1>
                <p className="bonus-success-desc">
                  Kamu terdaftar di <strong>{selectedTopicName}</strong>. Detail & link workshop sudah dikirim ke {profile?.email}.
                </p>
              </div>
              {groupLink && (
                <a href={groupLink} target="_blank" rel="noopener noreferrer" className="bonus-portal-btn"
                  style={{ background: "#25D366", color: "#fff" }}>
                  Gabung Grup WhatsApp <ExternalLink size={15} />
                </a>
              )}
              <div className="bonus-steps">
                <p className="bonus-steps-title">Langkah selanjutnya</p>
                <ol className="bonus-steps-list">
                  <li>Cek email untuk detail jadwal & link meeting</li>
                  <li>Gabung grup WhatsApp melalui tombol di atas</li>
                </ol>
              </div>
            </div>
          )}

          {/* ── SUKSES: DOWNLOADABLE ── */}
          {resultKind === "downloadable" && (
            <div className="bonus-success">
              <div className="bonus-banner">
                <div className="bonus-badge"><Download size={22} /></div>
                <h1 className="bonus-success-title">{selectedTopicName}</h1>
                <p className="bonus-success-desc">Kontenmu siap diunduh. Klik tombol di bawah.</p>
              </div>
              {downloadUrl ? (
                <a href={downloadUrl} target="_blank" rel="noopener noreferrer" className="bonus-portal-btn">
                  Download <Download size={15} />
                </a>
              ) : (
                <p className="bonus-error">Link download belum tersedia. Hubungi admin.</p>
              )}
            </div>
          )}

          {/* ── SUKSES: REVIEW CV ── */}
          {resultKind === "review_cv" && (
            <div className="bonus-success">
              <div className="bonus-banner">
                <div className="bonus-badge"><FileText size={22} /></div>
                <h1 className="bonus-success-title">CV Berhasil Dikirim!</h1>
                <p className="bonus-success-desc">
                  Terima kasih. Tim kami akan mereview CV kamu dan mengabari hasilnya via email {profile?.email}.
                </p>
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  );
}
