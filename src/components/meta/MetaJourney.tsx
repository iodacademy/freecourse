"use client";

import { useState, useEffect } from "react";
import MetaVerifyGate from "./MetaVerifyGate";
import Assessment from "../Assessment/Assessment";
import Survey from "../Survey/Survey";
import { CheckCircle2, Loader2, ChevronLeft, Award } from "lucide-react";
import type { AssessmentQuestion, SurveyQuestion } from "@/lib/types";

type Step = "verify" | "pretest" | "materi1" | "materi2" | "sertifikat";

const formatCourseDescription = (desc: string) => {
  if (!desc) return <p style={{ fontSize: "0.8rem", color: "#555", marginBottom: 10, lineHeight: 1.4 }}>Kelas tambahan eksklusif.</p>;

  let formatted = desc.replace(/\b(Kurikulum|Sesi\s+Live\s+Class\s+\d+|Jadwal\s+Sesi|Sesi\s+\d+|Recording\s+\d+)/gi, '\n$1');

  const lines = formatted.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  if (lines.length <= 1) {
    return <p style={{ fontSize: "0.8rem", color: "#555", marginBottom: 10, lineHeight: 1.4 }}>{desc}</p>;
  }

  return (
    <div style={{ fontSize: "0.8rem", color: "#555", marginBottom: 10, lineHeight: 1.4 }}>
      {lines.map((line, i) => (
        <div key={i} style={{ marginBottom: "6px", display: "flex", alignItems: "flex-start", gap: "6px" }}>
          <span style={{ color: "var(--color-primary)", marginTop: "2px" }}>•</span>
          <span>{line}</span>
        </div>
      ))}
    </div>
  );
};

/**
 * Alur belajar untuk peserta Meta Instant Form.
 * Sama persis dengan StandaloneJourney, KECUALI tahap awal:
 * di sini peserta TIDAK mengisi form data diri, melainkan VERIFIKASI
 * (cari & cocokkan data dari collection `leads`). Setelah verifikasi,
 * userData diisi dari leads dan alur belajar identik dengan standalone.
 *
 * Tahap kuis/survei/sertifikat/redeem memakai ulang endpoint standalone:
 *   /api/public/standalone/submit  &  /api/public/standalone/redeem
 * karena keduanya berbasis email — tidak perlu logika baru.
 */
export default function MetaJourney() {
  const [currentStep, setCurrentStep] = useState<Step>("verify");
  const [userData, setUserData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [survey2Done, setSurvey2Done] = useState(false);
  const [certDriveUrl, setCertDriveUrl] = useState<string | null>(null);
  const [bonusCourses, setBonusCourses] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("vl");
  const [isClient, setIsClient] = useState(false);

  // Pre-test
  const [pretestAnswer, setPretestAnswer] = useState<string>("");
  const [pretestError, setPretestError] = useState("");

  // Konfirmasi nama untuk sertifikat (popup)
  const [showNameModal, setShowNameModal] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [nameError, setNameError] = useState("");

  // Redeem state
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [redeemError, setRedeemError] = useState("");
  const [redeemCode, setRedeemCode] = useState("");
  const [redeemTopicName, setRedeemTopicName] = useState("");
  const [redeemPortalUrl, setRedeemPortalUrl] = useState("");
  const [redeemGroupLink, setRedeemGroupLink] = useState("");
  const [redeemCategory, setRedeemCategory] = useState("");
  const [redeemDownloadUrl, setRedeemDownloadUrl] = useState("");
  const [redeemDone, setRedeemDone] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (currentStep === "sertifikat" && bonusCourses.length === 0) {
      fetch("/api/public/standalone/bonus-courses")
        .then(r => r.json())
        .then(data => {
          if (Array.isArray(data)) setBonusCourses(data);
        })
        .catch(console.error);
    }
  }, [currentStep]);

  // ── Pertanyaan kuis & survei (sama dengan standalone) ──
  const kuis1Questions: AssessmentQuestion[] = [
    {
      id: "q-1779462169465",
      text: "Prinsip yang benar terkait alokasi pemasukan (gaji) adalah...",
      points: 30,
      options: [
        { id: "A", text: "50% (Kebutuhan Pokok) -- 30% (Hiburan dan Hobi) -- 20% (Tabungan dan Dana Darurat)" },
        { id: "B", text: "50% (Hiburan dan Hobi) -- 30 % (Kebutuhan Pokok) -- 20% (Tabungan dan Dana Darurat)" },
        { id: "C", text: "50% (Tabungan dan Dana Darurat) -- 30% (Kebutuhan Pokok) -- 20%(Hiburan dan Hobi)" },
        { id: "D", text: "50% (Hiburan dan Hobi) -- 30% (Tabungan dan Dana Darurat) -- 20%(Kebutuhan Pokok)" }
      ],
      correctAnswer: "A",
      feedbackCorrect: "Jawaban kamu benar! Ini adalah metode budgeting 50/30/20 yang dipopulerkan oleh Elizabeth Warren. 50% dialokasikan untuk kebutuhan esensial/pokok (seperti makan, sewa rumah, tagihan), 30% untuk keinginan/hiburan, dan 20% disisihkan untuk tabungan, investasi, atau melunasi utang.",
      feedbackWrong: "Jawaban kamu belum tepat. Coba ingat kembali urutan prioritas keuangan: porsi paling besar selalu ditujukan untuk sesuatu yang esensial (kebutuhan pokok), baru kemudian diikuti oleh hiburan, dan jangan lupa menyisihkan porsi khusus untuk masa depan.",
      hint: ""
    },
    {
      id: "q-1779462319546",
      text: "Jika gaji bersih Budi Rp5.000.000 per bulan dan ia menggunakan metode 50/30/20, berapa idealnya dana untuk tabungan/investasi setiap bulan?",
      points: 30,
      options: [
        { id: "A", text: "Rp1.000.000" },
        { id: "B", text: "Rp500.000" },
        { id: "C", text: "Rp2.500.000" },
        { id: "D", text: "Rp1.500.000" }
      ],
      correctAnswer: "A",
      feedbackCorrect: "Luar biasa, hitungan kamu akurat! 🌟 Mengalokasikan 20% dari Rp5.000.000 berarti Budi memiliki Rp1.000.000 setiap bulannya untuk mengamankan masa depan finansialnya.",
      feedbackWrong: "Ups, hitungannya masih kurang pas. Yuk, coba hitung ulang! Ingat kembali berapa persentase yang seharusnya dialokasikan khusus untuk Tabungan dan Dana Darurat pada metode 50/30/20, lalu kalikan persentase tersebut dengan total gaji Budi.",
      hint: ""
    },
    {
      id: "q-1779462400362",
      text: "Menurut konsep dasar keuangan pribadi, manakah dari situasi berikut yang paling tepat dikategorikan sebagai kebutuhan dasar?",
      points: 40,
      options: [
        { id: "A", text: "Berlibur ke luar negeri setiap tahun untuk menghilangkan penat." },
        { id: "B", text: "Mengalokasikan dana untuk biaya sewa tempat tinggal dan bahan makanan pokok." },
        { id: "C", text: "Membeli smartphone model terbaru untuk mengikuti tren teknologi." },
        { id: "D", text: "Membeli kopi premium harian di kedai kopi ternama." }
      ],
      correctAnswer: "B",
      feedbackCorrect: "Jawaban kamu tepat! 👏 Sewa rumah dan makanan pokok adalah pengeluaran wajib untuk bertahan hidup, sedangkan pilihan lainnya hanyalah pelengkap gaya hidup atau keinginan semata.",
      feedbackWrong: "Jawaban kamu kurang tepat. Mari bedakan lagi antara 'kebutuhan' dan 'keinginan'. Kebutuhan dasar adalah hal-hal yang sifatnya wajib dan mendesak untuk kelangsungan hidup (seperti sandang, pangan, papan), bukan sesuatu yang sekadar memanjakan gaya hidup.",
      hint: ""
    }
  ];

  const survei1Questions: SurveyQuestion[] = [
    {
      id: "sq-1779462786725",
      text: "Bagaimana menurutmu terkait materi literasi keuangan dan soft skills sebelumnya?",
      type: "starRating",
      required: true,
      maxStars: 5
    },
    {
      id: "sq-1779462798676",
      text: "Boleh ceritakan secara singkat alasan dari penilaianmu? (Opsional)",
      type: "shortText",
      required: false
    }
  ];

  const survei2Questions: SurveyQuestion[] = [
    {
      id: "sq-1779478038912",
      text: "Setelah mempelajari video, seberapa yakin kamu dalam menentukan minat dan preferensi kerja untuk masa depanmu?",
      type: "scale",
      required: true,
      maxStars: 5
    }
  ];

  const steps = [
    { id: "verify", label: "Verifikasi" },
    { id: "materi1", label: "Materi 1" },
    { id: "materi2", label: "Materi 2" },
    { id: "sertifikat", label: "Sertifikat" }
  ];

  const currentStepIndex = Math.max(0, steps.findIndex(s => s.id === currentStep));

  // ── Setelah verifikasi sukses: simpan userData, lanjut ke pre-test ──
  const handleVerified = (data: any) => {
    setUserData(data);
    setCurrentStep("pretest");
    window.scrollTo(0, 0);
  };

  // ── Submit Pre-test → simpan ke users.profileData, lanjut ke materi 1 ──
  const handlePretestSubmit = async () => {
    if (!pretestAnswer) {
      setPretestError("Silakan pilih salah satu jawaban.");
      return;
    }
    setIsLoading(true);
    setPretestError("");
    try {
      const res = await fetch("/api/public/standalone/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "pretest",
          email: userData.alamat_email,
          payload: { pretest_pernah_belajar_financial_literacy: pretestAnswer },
        }),
      });
      if (!res.ok) throw new Error("Gagal menyimpan pre-test");
      setCurrentStep("materi1");
      window.scrollTo(0, 0);
    } catch (error) {
      setPretestError("Terjadi kesalahan. Silakan coba lagi.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuizPass = async (achievedScore: number, answers: Record<string, string>) => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/public/standalone/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "quiz",
          email: userData.alamat_email,
          payload: {
            score: achievedScore,
            passed: achievedScore >= 60,
            kkm: 60,
            answers: answers
          }
        })
      });
      if (!res.ok) throw new Error("Gagal menyimpan nilai kuis");

      setScore(achievedScore);
      setQuizAnswers(answers);
      setTimeout(() => window.scrollBy({ top: 400, behavior: 'smooth' }), 100);
    } catch (error) {
      alert("Terjadi kesalahan. Silakan coba lagi.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSurveiSubmit = async (answers: any, stepName: "survei1" | "survei2") => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/public/standalone/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "survey",
          email: userData.alamat_email,
          payload: { surveyResult: answers, surveyType: stepName }
        })
      });
      if (!res.ok) throw new Error("Gagal menyimpan survei");

      if (stepName === "survei1") {
        setCurrentStep("materi2");
        window.scrollTo(0, 0);
      } else {
        setSurvey2Done(true);
        setTimeout(() => window.scrollBy({ top: 400, behavior: 'smooth' }), 100);
      }
    } catch (error) {
      alert("Terjadi kesalahan. Silakan coba lagi.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmRedeem = async () => {
    if (!selectedTopic || !userData?.alamat_email) return;
    setConfirming(true);
    setRedeemError("");
    try {
      const res = await fetch("/api/public/standalone/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: userData.alamat_email, topicId: selectedTopic }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRedeemError(data.error || "Gagal melakukan redeem kursus.");
        return;
      }
      setRedeemCategory(data.category);
      const chosen = bonusCourses.find((c) => c.id === selectedTopic);
      setRedeemTopicName(data.topicName || chosen?.name || "");
      if (data.category === "workshop") {
        setRedeemGroupLink(data.groupLink || "");
        setRedeemDone(true);
      } else if (data.category === "downloadable") {
        setRedeemDownloadUrl(data.downloadUrl || chosen?.downloadUrl || "");
        setRedeemDone(true);
      } else {
        setRedeemCode(data.redeemCode);
        setRedeemPortalUrl(data.portalUrl);
        setRedeemGroupLink(data.groupLink);
      }
    } catch (error) {
      setRedeemError("Terjadi kesalahan jaringan.");
    } finally {
      setConfirming(false);
    }
  };

  function copyCode() {
    navigator.clipboard.writeText(redeemCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const showSuccessRedeem = !!redeemCode || redeemDone;

  // Cocokkan benefit ke tab kategori. "lainnya" = downloadable saja
  // (review_cv login-only). "vl" mencakup data lama "wpb".
  const matchesTab = (course: any, tab: string) => {
    const cat = course.category || "vl";
    if (tab === "lainnya") return cat === "downloadable";
    if (tab === "vl") return cat === "vl" || cat === "wpb";
    return cat === tab;
  };

  const ALL_TABS = [
    { key: "workshop", label: "Workshop" },
    { key: "bootcamp", label: "Bootcamp" },
    { key: "vl", label: "Video Learning" },
    { key: "lainnya", label: "Bonus Lainnya" },
  ];
  // Hanya tampilkan tab yang punya minimal 1 benefit.
  const availableTabs = ALL_TABS.filter((t) => bonusCourses.some((c) => matchesTab(c, t.key)));

  const visibleCourses = bonusCourses.filter((c) => matchesTab(c, selectedCategory));

  // Pastikan kategori terpilih selalu tab yang ada isinya (mis. default "vl" kosong).
  useEffect(() => {
    if (availableTabs.length === 0) return;
    if (!availableTabs.some((t) => t.key === selectedCategory)) {
      setSelectedCategory(availableTabs[0].key);
    }
  }, [availableTabs, selectedCategory]);

  // Buka popup konfirmasi nama (isi awal dari nama yang ada).
  const openNameModal = () => {
    setConfirmName(userData?.nama_lengkap || "");
    setNameError("");
    setShowNameModal(true);
  };

  // Setelah nama dikonfirmasi → klaim sertifikat dengan nama itu.
  const handleConfirmNameAndClaim = async () => {
    const trimmed = (confirmName || "").trim();
    if (!trimmed) {
      setNameError("Nama wajib diisi.");
      return;
    }
    setIsLoading(true);
    setNameError("");
    try {
      const res = await fetch("/api/public/standalone/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "certificate",
          email: userData.alamat_email,
          payload: { confirmedName: trimmed }
        })
      });
      if (!res.ok) throw new Error("Gagal mengklaim sertifikat");
      const data = await res.json();

      // Perbarui nama lokal agar tampilan sertifikat memakai nama final.
      setUserData((prev: any) => ({ ...prev, nama_lengkap: trimmed }));

      if (data.driveUrl) {
        setCertDriveUrl(data.driveUrl);
        window.open(data.driveUrl, "_blank");
      }

      setShowNameModal(false);
      setCurrentStep("sertifikat");
      window.scrollTo(0, 0);
    } catch (error) {
      setNameError("Terjadi kesalahan. Silakan coba lagi.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isClient) {
    return (
      <div className="flex justify-center items-center" style={{ minHeight: "100vh", backgroundColor: "var(--color-bg-soft)" }}>
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  return (
    <div className="pf-page" style={{ backgroundColor: "var(--color-bg-soft)", minHeight: "100vh", padding: "20px 16px" }}>
      <div className="container-narrow mx-auto" style={{ maxWidth: "800px", width: "100%" }}>

        {/* Progress Bar */}
        <div className="pf-progress" style={{ margin: "0 auto 24px", maxWidth: "500px" }}>
          <span className="pf-progress__bar">
            <span style={{ width: `${Math.round(((currentStepIndex + 1) / steps.length) * 100)}%` }} />
          </span>
          <span className="pf-progress__label">{Math.round(((currentStepIndex + 1) / steps.length) * 100)}%</span>
        </div>

        {/* Header Indicator */}
        <div style={{ marginBottom: "24px", position: "relative", textAlign: "center", minHeight: "48px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          {/* Tombol kembali hanya muncul setelah lewat tahap verifikasi (tidak boleh balik ke verify) */}
          {currentStepIndex > 1 && (
            <button
              onClick={() => setCurrentStep(steps[currentStepIndex - 1].id as Step)}
              className="pf-back-btn hover:text-primary transition-colors"
              style={{ position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)", display: "flex", alignItems: "center", gap: "4px", color: "var(--color-gray-500)", fontWeight: 600, fontSize: "14px", background: "transparent", border: "none", cursor: "pointer", padding: "8px" }}
            >
              <ChevronLeft size={20} /> <span className="hidden sm:inline">Kembali</span>
            </button>
          )}
          <h1 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--color-gray-900)", margin: 0 }}>
            {steps[currentStepIndex].label}
          </h1>
          <p style={{ fontSize: "0.875rem", color: "var(--color-gray-500)", marginTop: "4px" }}>
            Langkah {currentStepIndex + 1} dari {steps.length}
          </p>
        </div>

        {/* Content Area */}
        <div style={{ width: "100%", overflowX: "hidden" }}>
          {currentStep === "verify" && (
            <MetaVerifyGate onVerified={handleVerified} />
          )}

          {currentStep === "pretest" && (
            <div className="pf-card" style={{ marginBottom: 24 }}>
              <div className="pf-card__head">
                <h2>Sebelum Mulai Belajar</h2>
                <p>Jawab pertanyaan singkat berikut ini.</p>
              </div>
              <div className="pf-card__body">
                <div className="pf-field-group">
                  <label className="pf-label">
                    Apakah kamu pernah mempelajari Financial Literacy sebelumnya? <span className="yr-req">*</span>
                  </label>
                  <div className="pf-segmented" role="radiogroup">
                    {["Pernah", "Belum Pernah"].map(opt => (
                      <button
                        key={opt}
                        type="button"
                        className={`pf-segmented__opt ${pretestAnswer === opt ? 'pf-segmented__opt--active' : ''}`}
                        onClick={() => { setPretestAnswer(opt); setPretestError(""); }}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                  {pretestError && <div className="pf-error">{pretestError}</div>}
                </div>
                <button
                  type="button"
                  onClick={handlePretestSubmit}
                  disabled={isLoading}
                  className="btn btn-primary w-full"
                  style={{ marginTop: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                >
                  {isLoading ? (<><Loader2 className="animate-spin" size={18} /> Menyimpan...</>) : (<>Selanjutnya</>)}
                </button>
              </div>
            </div>
          )}

          {currentStep === "materi1" && (
            <div className="flex flex-col gap-6">
              <div className="card">
                <div className="card-body">
                  <h2 className="mb-5">Materi 1: Konsep Cash Flow, Alokasi Pemasukan, dan Dana Darurat</h2>

                  <div className="mb-6 rounded-lg overflow-hidden" style={{ position: "relative", width: "100%", paddingTop: "56.25%", background: "var(--color-black)" }}>
                    <iframe
                      style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: 0 }}
                      src="https://www.youtube.com/embed/3QP7njgAPVk?rel=0"
                      allowFullScreen
                    />
                  </div>
                  <div className="text-muted" style={{ lineHeight: "var(--line-height-relaxed)" }}>
                    <p>Tonton video di atas secara lengkap. Jika sudah paham, silakan kerjakan kuis evaluasi di bawah.</p>
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="card-body">
                  <h2 className="mb-2">Kuis Evaluasi</h2>
                  <p className="text-muted mb-6">Jawab pertanyaan berikut untuk menguji pemahaman Anda. KKM: 60</p>

                  {isLoading && score === null ? (
                    <div className="loading-overlay">
                      <Loader2 className="animate-spin text-primary" size={32} />
                      <p className="mt-4">Menyimpan hasil kuis...</p>
                    </div>
                  ) : (
                    <Assessment
                      questions={kuis1Questions}
                      kkm={60}
                      onPass={handleQuizPass}
                      initialAnswers={quizAnswers}
                      disabled={score !== null && score >= 60}
                      previousPassed={score !== null && score >= 60}
                      previousScore={score}
                    />
                  )}
                </div>
              </div>

              {score !== null && score >= 60 && (
                <div className="card" style={{ borderTop: "4px solid var(--color-success)" }}>
                  <div className="card-body">
                    <h2 className="mb-2">Survei Pelatihan</h2>
                    <p className="text-muted mb-6">Selamat Anda telah lulus kuis! Langkah terakhir untuk modul ini: bantu kami menjadi lebih baik dengan mengisi ulasan singkat ini.</p>

                    {isLoading && score !== null ? (
                      <div className="loading-overlay">
                        <Loader2 className="animate-spin text-primary" size={32} />
                      </div>
                    ) : (
                      <Survey
                        questions={survei1Questions}
                        onSubmit={(ans) => handleSurveiSubmit(ans, "survei1")}
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {currentStep === "materi2" && (
            <div className="flex flex-col gap-6">
              <div className="card">
                <div className="card-body">
                  <h2 className="mb-5">Materi 2: Mengenali Minat, Kekuatan, dan Preferensi Kerja</h2>

                  <div className="mb-6 rounded-lg overflow-hidden" style={{ position: "relative", width: "100%", paddingTop: "56.25%", background: "var(--color-black)" }}>
                    <iframe
                      style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: 0 }}
                      src="https://www.youtube.com/embed/xuMGnzxf7ZM?rel=0"
                      allowFullScreen
                    />
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="card-body">
                  <h2 className="mb-2">Survei Materi 2</h2>
                  <p className="text-muted mb-6">Setelah mempelajari video, berikan ulasan Anda terkait materi kedua ini.</p>

                  {isLoading ? (
                    <div className="loading-overlay">
                      <Loader2 className="animate-spin text-primary" size={32} />
                    </div>
                  ) : (
                    <Survey
                      questions={survei2Questions}
                      onSubmit={(ans) => handleSurveiSubmit(ans, "survei2")}
                      disabled={survey2Done}
                      alreadySubmitted={survey2Done}
                    />
                  )}
                </div>
              </div>

              {survey2Done && (
                <div className="card" style={{ borderTop: "4px solid var(--color-success)" }}>
                  <div className="card-body">
                    <h2 className="mb-4">Materi Tambahan</h2>
                    <p className="text-muted mb-6">Untuk melihat materi secara lengkap, silakan akses melalui tautan berikut ini:</p>

                    <a
                      href="https://drive.google.com/drive/folders/1DPTNfbFnuAwunOAt1COZAbVLOCXwqKGG?usp=sharing"
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center justify-center p-4 mb-8"
                      style={{ background: "var(--color-bg-soft)", borderRadius: "var(--radius-md)", color: "var(--color-info)", fontWeight: "var(--font-weight-semibold)" }}
                    >
                      Modul Literasi Keuangan dan Soft Skills ↗
                    </a>

                    <button
                      onClick={openNameModal}
                      disabled={isLoading}
                      className="btn btn-primary w-full flex items-center justify-center gap-2"
                    >
                      <Award size={20} />
                      Klaim Sertifikat
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {currentStep === "sertifikat" && (
            <div className="cert-wrapper" style={{ padding: 0, minHeight: "auto", background: "transparent" }}>
              <div className="cert-content" style={{ maxWidth: "100%", margin: 0, padding: 0, boxShadow: "none" }}>

                <div className="cert-success" style={{ padding: "var(--space-8) var(--space-6)" }}>
                  <div className="cert-confetti">🎉</div>
                  <h1 className="cert-success-title" style={{ fontSize: "1.5rem" }}>Sertifikat Anda Siap!</h1>
                  <p className="cert-success-sub">
                    Sertifikat telah berhasil dibuat dan seharusnya sudah otomatis diunduh. Jika belum, Anda bisa melihat pratinjaunya di bawah ini.
                  </p>

                  <div className="cert-preview" style={{ cursor: certDriveUrl ? "pointer" : "default" }} onClick={() => {
                    if (certDriveUrl) window.open(certDriveUrl, "_blank");
                  }}>
                    <div className="cert-preview-img-wrap">
                      <img src="/images/certificate-template.png" alt="Sertifikat" className="cert-preview-img" />
                      <div className="cert-preview-name">{userData?.nama_lengkap || "Peserta"}</div>
                      {certDriveUrl && (
                        <div className="cert-download-overlay">
                          <span>📥 Klik untuk Buka PDF di Tab Baru</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="cert-info">
                    <div className="cert-info-row">
                      <span className="cert-info-label">Nama</span>
                      <span className="cert-info-value">{userData?.nama_lengkap || "Peserta"}</span>
                    </div>
                    <div className="cert-info-row">
                      <span className="cert-info-label">Program</span>
                      <span className="cert-info-value">Workshop Literasi Finansial</span>
                    </div>
                  </div>
                </div>

                {/* ── BONUS KELAS ── */}
                <div className="cert-success" style={{ marginTop: 24, padding: "var(--space-8) var(--space-6)" }}>
                  <h1 className="cert-success-title" style={{ fontSize: "1.25rem", marginBottom: 8 }}>Bonus Kelas Tambahan</h1>
                  <p className="cert-success-sub" style={{ marginBottom: 24 }}>
                    Sebagai apresiasi karena Anda telah menyelesaikan program ini, Anda berhak memilih kelas bonus di bawah ini!
                  </p>

                  <div className="flex gap-2 justify-center mb-6 flex-wrap">
                    {availableTabs.map((tab) => (
                      <button
                        key={tab.key}
                        onClick={() => { setSelectedCategory(tab.key); setSelectedTopic(null); setRedeemError(""); }}
                        className={`btn ${selectedCategory === tab.key ? "btn-primary" : "btn-outline"}`}
                        style={{ borderRadius: 50, padding: "8px 16px", fontSize: "0.875rem" }}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {!showSuccessRedeem ? (
                    <>
                      {redeemError && (
                        <div style={{ background: "#FEE2E2", color: "#B91C1C", padding: "12px", borderRadius: "8px", marginBottom: "16px", fontSize: "0.875rem", textAlign: "center" }}>
                          {redeemError}
                        </div>
                      )}
                      {visibleCourses.length === 0 ? (
                        <div className="text-center p-6 bg-gray-50 rounded-lg">
                          <p className="text-muted m-0 text-sm">Maaf, saat ini belum ada benefit di kategori ini.</p>
                        </div>
                      ) : (
                        <div>
                          <div style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                            gap: "16px",
                            alignItems: "stretch",
                            textAlign: "left",
                            marginBottom: "24px"
                          }}>
                            {visibleCourses.map((course, idx) => {
                              const isSelected = selectedTopic === course.id;
                              return (
                                <div key={idx}
                                  onClick={() => setSelectedTopic(course.id)}
                                  className="flex flex-col" style={{
                                  border: isSelected ? "2px solid var(--color-primary)" : "1.5px solid #e5e7eb",
                                  borderRadius: 12, padding: 12,
                                  background: isSelected ? "#F8FAFC" : "#fff",
                                  cursor: "pointer",
                                  transition: "all 0.2s"
                                }}>
                                  <h3 style={{ fontSize: "0.9rem", fontWeight: 700, marginBottom: 8, color: "#111" }}>{course.name}</h3>
                                  {formatCourseDescription(course.description)}
                                  <div style={{ marginTop: "auto", paddingTop: "12px" }}>
                                    <div style={{
                                      display: "block", padding: "8px", borderRadius: 8,
                                      background: isSelected ? "var(--color-primary)" : "#f3f4f6",
                                      color: isSelected ? "#fff" : "#444",
                                      border: "none", textAlign: "center", fontWeight: 600, fontSize: "0.8rem",
                                      transition: "all 0.2s"
                                    }}>
                                      {isSelected ? "Terpilih" : "Pilih Kelas"}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          <div style={{ textAlign: "center", padding: "24px 0", borderTop: "1px solid #e5e7eb", paddingBottom: selectedTopic ? "80px" : "24px" }}>
                            {!selectedTopic ? (
                              <>
                                <button
                                  className="btn btn-primary"
                                  disabled={true}
                                  style={{ padding: "12px 32px", fontSize: "1rem", borderRadius: "50px", opacity: 0.5 }}
                                >
                                  Konfirmasi Pilihan
                                </button>
                                <p style={{ fontSize: "0.85rem", color: "#666", marginTop: "8px" }}>Pilih salah satu kelas di atas</p>
                              </>
                            ) : (
                              <div style={{
                                position: "fixed",
                                bottom: 0,
                                left: 0,
                                right: 0,
                                background: "#fff",
                                padding: "16px",
                                boxShadow: "0 -4px 12px rgba(0,0,0,0.1)",
                                zIndex: 50,
                                display: "flex",
                                justifyContent: "center"
                              }}>
                                <button
                                  className="btn btn-primary shadow-lg"
                                  disabled={confirming}
                                  onClick={handleConfirmRedeem}
                                  style={{ padding: "12px 32px", fontSize: "1rem", borderRadius: "50px", width: "100%", maxWidth: "400px" }}
                                >
                                  {confirming ? <><Loader2 size={18} className="animate-spin inline-block mr-2" /> Memproses...</> : "Konfirmasi Pilihan"}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  ) : redeemCategory === "workshop" ? (
                    <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: "16px", padding: "32px", textAlign: "center", marginTop: "24px" }}>
                      <div style={{ width: "64px", height: "64px", background: "#22C55E", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", color: "white" }}>
                        <CheckCircle2 size={32} />
                      </div>
                      <h2 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#166534", marginBottom: "8px" }}>Pendaftaran Workshop Berhasil!</h2>
                      <p style={{ color: "#15803D", marginBottom: "24px", lineHeight: "1.6" }}>
                        Kamu terdaftar di <strong>{redeemTopicName}</strong>. Detail & link workshop sudah dikirim ke {userData?.alamat_email}.
                      </p>
                      {redeemGroupLink && (
                        <a href={redeemGroupLink} target="_blank" rel="noopener noreferrer" className="btn" style={{ background: "#25D366", color: "#fff", border: "none", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                          Gabung Grup WhatsApp ↗
                        </a>
                      )}
                    </div>
                  ) : redeemCategory === "downloadable" ? (
                    <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: "16px", padding: "32px", textAlign: "center", marginTop: "24px" }}>
                      <div style={{ width: "64px", height: "64px", background: "#22C55E", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", color: "white" }}>
                        <CheckCircle2 size={32} />
                      </div>
                      <h2 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#166534", marginBottom: "8px" }}>{redeemTopicName}</h2>
                      <p style={{ color: "#15803D", marginBottom: "24px", lineHeight: "1.6" }}>Kontenmu siap diunduh.</p>
                      {redeemDownloadUrl ? (
                        <a href={redeemDownloadUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                          Download ↓
                        </a>
                      ) : (
                        <p style={{ color: "#B91C1C" }}>Link download belum tersedia. Hubungi admin.</p>
                      )}
                    </div>
                  ) : (
                    <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: "16px", padding: "32px", textAlign: "center", marginTop: "24px" }}>
                      <div style={{ width: "64px", height: "64px", background: "#22C55E", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", color: "white" }}>
                        <CheckCircle2 size={32} />
                      </div>
                      <h2 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#166534", marginBottom: "8px" }}>Kursus Siap Diakses!</h2>
                      <p style={{ color: "#15803D", marginBottom: "24px", lineHeight: "1.6" }}>
                        <strong>{redeemTopicName}</strong> sudah siap. Gunakan kode di bawah untuk masuk ke portal belajar IODA Academy.
                      </p>

                      <div style={{ background: "#fff", border: "2px dashed #86EFAC", borderRadius: "12px", padding: "20px", marginBottom: "24px", maxWidth: "400px", margin: "0 auto 24px" }}>
                        <p style={{ fontSize: "0.75rem", fontWeight: 700, color: "#166534", letterSpacing: "1px", marginBottom: "8px", textTransform: "uppercase" }}>KODE REDEEM</p>
                        <div style={{ display: "flex", gap: "12px", alignItems: "center", justifyContent: "center", flexWrap: "wrap" }}>
                          <code style={{ fontSize: "1.25rem", fontWeight: 800, color: "#111827", background: "#F3F4F6", padding: "8px 16px", borderRadius: "8px", letterSpacing: "1px", wordBreak: "break-all" }}>
                            {redeemCode}
                          </code>
                          <button onClick={copyCode} style={{ background: "#E5E7EB", border: "none", padding: "10px 16px", borderRadius: "8px", cursor: "pointer", fontWeight: 600, color: "#374151" }}>
                            {copied ? "Tersalin!" : "Salin"}
                          </button>
                        </div>
                        <p style={{ fontSize: "0.85rem", color: "#6B7280", marginTop: "12px" }}>Email konfirmasi juga sudah dikirim ke {userData?.alamat_email}</p>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: "12px", maxWidth: "400px", margin: "0 auto" }}>
                        <a href={redeemPortalUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                          Buka Portal Belajar ↗
                        </a>
                        {(redeemCategory === "wpb" || redeemCategory === "bootcamp") && redeemGroupLink && (
                          <a href={redeemGroupLink} target="_blank" rel="noopener noreferrer" className="btn" style={{ background: "#25D366", color: "#fff", border: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                            Gabung Grup WhatsApp ↗
                          </a>
                        )}
                      </div>

                      <div style={{ marginTop: "32px", textAlign: "left", background: "#fff", padding: "24px", borderRadius: "12px", border: "1px solid #e5e7eb" }}>
                        <h4 style={{ fontWeight: 700, marginBottom: "12px", color: "#111" }}>Langkah Selanjutnya:</h4>
                        <ol style={{ margin: 0, paddingLeft: "20px", color: "#4B5563", lineHeight: "1.6" }}>
                          <li style={{ marginBottom: "8px" }}>Klik tombol <strong>Buka Portal Belajar</strong> di atas.</li>
                          <li style={{ marginBottom: "8px" }}>Masukkan kode redeem Anda di halaman utama portal.</li>
                          {(redeemCategory === "wpb" || redeemCategory === "bootcamp") && (
                            <li>Jangan lupa untuk segera bergabung dengan <strong>Grup WhatsApp</strong> kelas Anda.</li>
                          )}
                        </ol>
                      </div>
                    </div>
                  )}
                </div>

              </div>
            </div>
          )}

        </div>
      </div>

      {/* ── POPUP KONFIRMASI NAMA UNTUK SERTIFIKAT ── */}
      {showNameModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: "16px",
          }}
          onClick={() => { if (!isLoading) setShowNameModal(false); }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff",
              borderRadius: 16,
              padding: "28px 24px",
              width: "100%",
              maxWidth: 440,
              boxShadow: "0 10px 40px rgba(0,0,0,0.2)",
            }}
          >
            <div style={{ textAlign: "center", marginBottom: 8 }}>
              <Award size={36} style={{ color: "var(--color-primary)" }} />
            </div>
            <h2 style={{ fontSize: "1.2rem", fontWeight: 800, textAlign: "center", margin: "0 0 8px", color: "#111" }}>
              Konfirmasi Nama di Sertifikat
            </h2>
            <p style={{ fontSize: "0.9rem", color: "#666", textAlign: "center", margin: "0 0 20px", lineHeight: 1.5 }}>
              Pastikan nama berikut sudah benar karena akan tercetak di sertifikat.
              Anda bisa memperbaikinya bila perlu.
            </p>

            <label className="pf-label" style={{ display: "block", marginBottom: 6 }}>
              Nama Lengkap
            </label>
            <input
              type="text"
              className="pf-input"
              value={confirmName}
              onChange={(e) => { setConfirmName(e.target.value); setNameError(""); }}
              placeholder="Tulis nama lengkap Anda"
              autoFocus
            />
            {nameError && (
              <div style={{ color: "#B91C1C", fontSize: "0.85rem", marginTop: 8 }}>{nameError}</div>
            )}

            <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
              <button
                type="button"
                className="btn btn-outline"
                style={{ flex: 1 }}
                disabled={isLoading}
                onClick={() => setShowNameModal(false)}
              >
                Batal
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ flex: 2, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                disabled={isLoading}
                onClick={handleConfirmNameAndClaim}
              >
                {isLoading ? (
                  <><Loader2 className="animate-spin" size={18} /> Memproses...</>
                ) : (
                  <>Nama Sudah Benar, Klaim</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
