"use client";

import { useState, useEffect } from "react";
import StandaloneIdentityForm from "./StandaloneIdentityForm";
import Assessment from "../Assessment/Assessment";
import Survey from "../Survey/Survey";
import { CheckCircle2, Loader2, ChevronLeft, Award, Sparkles } from "lucide-react";
import type { AssessmentQuestion, SurveyQuestion } from "@/lib/types";

type Step = "form" | "materi1" | "materi2" | "materi_tambahan" | "sertifikat";

const formatCourseDescription = (desc: string) => {
  if (!desc) return <p style={{ fontSize: "0.8rem", color: "#555", marginBottom: 10, lineHeight: 1.4 }}>Kelas tambahan eksklusif.</p>;
  
  // Format bootcamp descriptions by inserting newlines before Sesi, Jadwal, Recording, Kurikulum
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

export default function StandaloneJourney() {
  const [currentStep, setCurrentStep] = useState<Step>("form");
  const [userData, setUserData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [survey2Done, setSurvey2Done] = useState(false);
  const [certDriveUrl, setCertDriveUrl] = useState<string | null>(null);
  const [bonusCourses, setBonusCourses] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("vl");
  const [isClient, setIsClient] = useState(false);
  
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
  const [redeemDone, setRedeemDone] = useState(false); // untuk kategori tanpa kode (workshop/downloadable)
  const [copied, setCopied] = useState(false);

  // Only run on client
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Fetch bonus courses when reaching sertifikat step
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

  // Mock Questions from User Payload
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
    { id: "form", label: "Data Diri" },
    { id: "materi1", label: "Materi 1" },
    { id: "materi2", label: "Materi 2" },
    { id: "sertifikat", label: "Sertifikat" }
  ];

  const currentStepIndex = Math.max(0, steps.findIndex(s => s.id === currentStep));

  const handleIdentitySubmit = async (data: any) => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/public/standalone/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "identity",
          email: data.alamat_email,
          payload: data
        })
      });
      if (!res.ok) throw new Error("Gagal menyimpan data diri");
      
      setUserData(data);
      setCurrentStep("materi1");
      window.scrollTo(0, 0);
    } catch (error) {
      alert("Terjadi kesalahan. Silakan coba lagi.");
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
      // Gulir sedikit ke bawah agar mereka melihat bahwa Survei sekarang muncul
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

  // Filter benefit per tab. "lainnya" = downloadable saja (review_cv login-only,
  // tidak ditampilkan di jalur standalone). "vl" juga mencakup data lama "wpb".
  const visibleCourses = bonusCourses.filter((c) => {
    const cat = c.category || "vl";
    if (selectedCategory === "lainnya") return cat === "downloadable";
    if (selectedCategory === "vl") return cat === "vl" || cat === "wpb";
    return cat === selectedCategory;
  });

  const handleClaimCertificate = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/public/standalone/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "certificate",
          email: userData.alamat_email,
          payload: {}
        })
      });
      if (!res.ok) throw new Error("Gagal mengklaim sertifikat");
      const data = await res.json();
      
      if (data.driveUrl) {
        setCertDriveUrl(data.driveUrl);
        window.open(data.driveUrl, "_blank");
      }
      
      setCurrentStep("sertifikat");
      window.scrollTo(0, 0);
    } catch (error) {
      alert("Terjadi kesalahan. Silakan coba lagi.");
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
        
        {/* Progress Bar (Mobile Friendly) */}
        <div className="pf-progress" style={{ margin: "0 auto 24px", maxWidth: "500px" }}>
          <span className="pf-progress__bar">
            <span style={{ width: `${Math.round(((currentStepIndex + 1) / steps.length) * 100)}%` }} />
          </span>
          <span className="pf-progress__label">{Math.round(((currentStepIndex + 1) / steps.length) * 100)}%</span>
        </div>

        {/* Header Indicator */}
        <div style={{ marginBottom: "24px", position: "relative", textAlign: "center", minHeight: "48px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          {currentStepIndex > 0 && (
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
          {currentStep === "form" && (
            <StandaloneIdentityForm onSubmit={handleIdentitySubmit} isLoading={isLoading} />
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

              {/* KUIS LANGSUNG DI BAWAH VIDEO */}
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

              {/* SURVEI MUNCUL SETELAH LULUS KUIS */}
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

              {/* SURVEI 2 LANGSUNG DI BAWAH VIDEO */}
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

              {/* MATERI TAMBAHAN LANGSUNG MUNCUL DI BAWAH */}
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
                      onClick={handleClaimCertificate}
                      disabled={isLoading}
                      className="btn btn-primary w-full flex items-center justify-center gap-2"
                    >
                      {isLoading ? <Loader2 className="animate-spin" size={20} /> : <Award size={20} />}
                      {isLoading ? "Memproses Sertifikat..." : "Klaim Sertifikat"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {currentStep === "sertifikat" && (
            <div className="cert-wrapper" style={{ padding: 0, minHeight: "auto", background: "transparent" }}>
              <div className="cert-content" style={{ maxWidth: "100%", margin: 0, padding: 0, boxShadow: "none" }}>
                
                {/* ── SUDAH DIKLAIM ── */}
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
                    {[
                      { key: "workshop", label: "Workshop" },
                      { key: "bootcamp", label: "Bootcamp" },
                      { key: "vl", label: "Video Learning" },
                      { key: "lainnya", label: "Bonus Lainnya" },
                    ].map((tab) => (
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
                    /* ── SUKSES WORKSHOP ── */
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
                    /* ── SUKSES DOWNLOADABLE ── */
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
                    /* ── SUKSES REDEEM (vl/bootcamp) ── */
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
    </div>
  );
}
