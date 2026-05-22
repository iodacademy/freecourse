"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import LMSPlayer from "@/components/LMSPlayer";
import type { QuizQuestion, LMSScreen } from "@/components/LMSPlayer";
import styles from "./page.module.css";

// ═══ DATA DUMMY — akan diganti data dari Firestore/Admin Panel ═══
interface StepMeta {
  stepNumber: number;
  title: string;
  status: "locked" | "current" | "completed";
}

const DUMMY_STEPS: StepMeta[] = [
  { stepNumber: 1, title: "Apa Itu Literasi Finansial?", status: "completed" },
  { stepNumber: 2, title: "Mengenal Jenis Pendapatan", status: "current" },
  { stepNumber: 3, title: "Cara Mengatur Anggaran", status: "locked" },
  { stepNumber: 4, title: "Menabung vs Investasi", status: "locked" },
  { stepNumber: 5, title: "Pentingnya Dana Darurat", status: "locked" },
  { stepNumber: 6, title: "Mengenal Produk Perbankan", status: "locked" },
  { stepNumber: 7, title: "Manajemen Utang yang Sehat", status: "locked" },
  { stepNumber: 8, title: "Perencanaan Keuangan Jangka Panjang", status: "locked" },
  { stepNumber: 9, title: "Survei Akhir", status: "locked" },
  { stepNumber: 10, title: "Klaim Sertifikat", status: "locked" },
];

const DUMMY_QUESTIONS: QuizQuestion[] = [
  {
    id: "q1",
    text: "Apa yang dimaksud dengan pendapatan pasif?",
    options: [
      { id: "a", text: "Pendapatan yang didapat dari bekerja full-time" },
      { id: "b", text: "Pendapatan yang didapat tanpa bekerja aktif secara rutin" },
      { id: "c", text: "Pendapatan dari menjual barang" },
      { id: "d", text: "Pendapatan dari pinjaman bank" },
    ],
    correctAnswer: "b",
    feedbackCorrect: "Luar biasa! Pendapatan pasif adalah penghasilan yang kamu terima secara otomatis tanpa harus bekerja aktif setiap hari.",
    feedbackWrong: "Wah, sayang sekali! Pendapatan pasif artinya penghasilan yang didapat secara otomatis, misalnya dari sewa properti atau dividen saham.",
    explanation: "Ciri khas pendapatan pasif adalah kamu tidak perlu bekerja setiap hari untuk mendapatkannya — contoh: bunga deposito, sewa, atau royalti.",
  },
  {
    id: "q2",
    text: "Mana yang termasuk contoh pendapatan portofolio?",
    options: [
      { id: "a", text: "Gaji bulanan dari perusahaan" },
      { id: "b", text: "Uang saku dari orang tua" },
      { id: "c", text: "Capital gain dari penjualan saham" },
      { id: "d", text: "Upah lembur" },
    ],
    correctAnswer: "c",
    feedbackCorrect: "Benar sekali! Capital gain dari saham adalah pendapatan portofolio karena berasal dari investasi aset.",
    feedbackWrong: "Belum tepat. Pendapatan portofolio berasal dari investasi, seperti capital gain, dividen, atau bunga deposito.",
    explanation: "Pendapatan portofolio berasal dari ASET yang kamu miliki, bukan dari tenaga yang kamu keluarkan.",
  },
  {
    id: "q3",
    text: "Mengapa penting memiliki lebih dari satu sumber pendapatan?",
    options: [
      { id: "a", text: "Agar terlihat sukses" },
      { id: "b", text: "Untuk mengurangi risiko jika satu sumber hilang" },
      { id: "c", text: "Karena satu pekerjaan saja membosankan" },
      { id: "d", text: "Supaya bisa pamer di media sosial" },
    ],
    correctAnswer: "b",
    feedbackCorrect: "Tepat! Diversifikasi pendapatan adalah salah satu prinsip dasar literasi finansial.",
    feedbackWrong: "Alasan utamanya adalah manajemen risiko — jika satu sumber hilang, masih ada sumber lain sebagai penopang.",
    explanation: "Jika kamu hanya punya satu sumber pendapatan dan tiba-tiba kehilangan pekerjaan, kamu akan kesulitan. Itulah mengapa diversifikasi penting.",
  },
  {
    id: "q4",
    text: "Apa yang sebaiknya dilakukan dengan pendapatan sisa setelah kebutuhan pokok terpenuhi?",
    options: [
      { id: "a", text: "Dihabiskan untuk hiburan" },
      { id: "b", text: "Disimpan dan diinvestasikan secara berkala" },
      { id: "c", text: "Diberikan semua kepada keluarga" },
      { id: "d", text: "Disimpan di bawah bantal agar aman" },
    ],
    correctAnswer: "b",
    feedbackCorrect: "Luar biasa! Menabung dan berinvestasi secara rutin adalah kunci kebebasan finansial jangka panjang.",
    feedbackWrong: "Belum tepat. Pendapatan sisa sebaiknya dikelola dengan bijak — disimpan dan diinvestasikan agar uang bekerja untuk kamu.",
    explanation: "Prinsip 'bayar diri sendiri dulu' mengajarkan kita untuk menyisihkan sebagian pendapatan untuk tabungan dan investasi sebelum konsumsi.",
  },
];

// ─── Helpers ─────────────────────────────────────────────────────
function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val));
}

const VALID_SCREENS: LMSScreen[] = ["quiz", "review", "survey", "done"];
function parseScreen(raw: string | null, fallback: LMSScreen = "quiz"): LMSScreen {
  return VALID_SCREENS.includes(raw as LMSScreen) ? (raw as LMSScreen) : fallback;
}

// ─── Page ────────────────────────────────────────────────────────
export default function StepPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();

  const stepNumber = parseInt(params.step as string, 10) || 1;
  const stepId = `step-${stepNumber}`;

  const currentStepMeta = DUMMY_STEPS.find((s) => s.stepNumber === stepNumber);
  const isLastStep = stepNumber >= DUMMY_STEPS.length;
  const canAccess = currentStepMeta && currentStepMeta.status !== "locked";
  const totalQ = DUMMY_QUESTIONS.length;

  // ── Read initial state from URL ──
  const initialScreen = parseScreen(searchParams.get("s"));
  const initialQIdx = clamp(parseInt(searchParams.get("q") || "0", 10), 0, totalQ - 1);
  const initialRevIdx = clamp(parseInt(searchParams.get("rev") || "0", 10), 0, totalQ - 1);
  const initialSurvSec = clamp(parseInt(searchParams.get("sec") || "0", 10), 0, 2);

  // ── URL update callback ──
  const handleStateChange = useCallback(
    (screen: LMSScreen, q: number, rev: number, sec: number) => {
      const p = new URLSearchParams();
      p.set("s", screen);
      if (screen === "quiz") p.set("q", String(q));
      if (screen === "review") p.set("rev", String(rev));
      if (screen === "survey") p.set("sec", String(sec));
      router.replace(`/learn/${stepNumber}?${p.toString()}`, { scroll: false });
    },
    [router, stepNumber]
  );

  function handleProceedToNext() {
    if (!isLastStep) {
      router.push(`/learn/${stepNumber + 1}`);
    } else {
      router.push("/learn/certificate");
    }
  }

  if (!canAccess) {
    return (
      <ProtectedRoute>
        <div className={styles.lockedWrapper}>
          <div className={styles.lockedCard}>
            <div className={styles.lockedIcon}>🔒</div>
            <h2>Materi Terkunci</h2>
            <p>Selesaikan materi sebelumnya terlebih dahulu untuk membuka materi ini.</p>
            <button className={styles.backBtn} onClick={() => router.push("/learn")}>
              Kembali ke Materi Terakhir
            </button>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className={styles.wrapper}>
        <LMSPlayer
          youtubeId="dQw4w9WgXcQ"
          questions={DUMMY_QUESTIONS}
          kkm={70}
          surveyEnabled={true}
          onProceedToNext={handleProceedToNext}
          isLastStep={isLastStep}
          stepId={stepId}
          initialScreen={initialScreen}
          initialQIdx={initialQIdx}
          initialRevIdx={initialRevIdx}
          initialSurvSec={initialSurvSec}
          onStateChange={handleStateChange}
        />
      </div>
    </ProtectedRoute>
  );
}
