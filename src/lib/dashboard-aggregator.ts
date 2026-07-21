/**
 * dashboard-aggregator.ts — Service Layer untuk Dashboard YOURISE
 *
 * Satu pintu untuk fetch + clean + dedup + agregasi data siswa.
 * Dipakai oleh semua endpoint: admin stats, public stats, export Excel, sync sheet.
 *
 * Sumber data:
 *  - users (exclude role==='admin')
 *  - enrollments (filter courseId === mainCourseId)
 *  - courses + steps (lookup question/step untuk mapping)
 *  - events, partnerCodes, bonusCourseTopics (lookup label)
 *  - settings/app (target + mapping)
 */
import { getAdminDb, getAdminStorage } from "./firebase-admin";
import {
  AREAS,
  areaOfCity,
  isAgeEligible,
  isAreaKey,
  isDisabilitasValue,
  type AreaKey,
} from "./regions";
import type {
  UserProfile,
  Enrollment,
  CourseStep,
  Event as IodaEvent,
  PartnerCode,
  BonusCourseTopic,
  StepProgress,
  Survey,
  SurveyQuestion,
} from "./types";

// ─── Types untuk hasil agregasi ─────────────────────────────────────────────

export type DashboardFilter = {
  channel?: "umum" | "beasiswa" | "kemitraan" | "workshop" | null;
  gender?: "Laki-laki" | "Perempuan" | null;
  disabilitas?: "Ya" | "Tidak" | null;
  region?: string | null;
  topik?: string | null;
  usia?: "18-23" | "24-29" | "30+" | null;
  dateFrom?: string | null; // ISO date
  dateTo?: string | null;
  source?: string | null; // event id / partner code / channel key
};

export type DashboardStudent = {
  // Bagian 1 — Identitas
  tanggalDaftar: string;
  persetujuan: string;
  channel: string;
  detailChannel: string;
  email: string;
  nomorWA: string;
  namaLengkap: string;
  jenisKelamin: string;
  tanggalLahir: string;
  umur: string;
  kota: string;
  disabilitas: string;
  jenisDisabilitas: string;
  minat: string;
  // Bagian 2 — Completion
  status: "Belum Start" | "In Progress" | "Selesai" | "Tersertifikasi";
  nilaiPretest: string; // Nilai Pre-test (dari users.profileData.pretest_score)
  statusKuis: "LULUS" | "TIDAK LULUS" | "-"; // status kelulusan post-test
  nilaiQuiz: string;
  nilaiSurvei1: string;
  feedbackMateri: string;
  nilaiSurvei2: string;
  linkSertifikat: string | null;
  // Status PDF sertifikat (terpisah dari `status` kelulusan):
  //  - "none"       : belum klaim sertifikat
  //  - "ready"      : PDF sudah jadi (linkSertifikat terisi)
  //  - "processing" : sudah klaim, PDF sedang diantre cron (pdfPending=true)
  //  - "stuck"      : sudah klaim, PDF belum ada & TIDAK diantre (perlu perhatian)
  certStatus: "none" | "ready" | "processing" | "stuck";
  // Bagian 3 — Passthrough untuk compatibility Modal Siswa
  uid: string;
  photoURL: string | null;
  profileCompleted: boolean;
  partnerCode: string | null;
  eventId: string | null;
  channelSource: string; // the original db value
};

/** Ringkasan satu area program (dipakai card Per Area di dashboard internal). */
export type AreaStat = {
  key: AreaKey | "luar";
  label: string;
  desc: string;
  /** Semua peserta di area ini (lolos filter aktif). */
  registered: number;
  /** Yang berstatus Tersertifikasi. */
  completed: number;
  /** Tersertifikasi DAN memenuhi syarat usia Data Clean. */
  cleanCompleted: number;
};

export type DashboardStats = {
  total: number;
  totalCompleted: number;
  totalTarget: number;
  perempuan: number;
  perempuanCompleted: number;
  perempuanTarget: number;
  disabilitas: number;
  disabilitasCompleted: number;
  disabilitasTarget: number;
  rerata: number; // 0-100 (Nilai Post-test)
  rerataPretest: number; // Rerata Nilai Pre-test
  kepuasan: number; // 0-5
  keyakinan: number; // 0-5
  respondenSurvei1: number;
  respondenSurvei2: number;
  origin: Array<[string, number]>; // [city, count] top N
  topik: Array<[string, number]>; // [topic name, count] top 5
  usia: Array<[string, number]>; // [bucket, count] 3 buckets
  lulusKuis: number;
  tidakLulusKuis: number;
  channelBreakdown: Record<string, { registered: number; completed: number }>;
  sourceList: Array<{ key: string; label: string; share: number }>;
  /** Ringkasan per area program + satu entri "Daerah Lainnya" di akhir (4 kartu). */
  areaStats: AreaStat[];
  /** Apakah metrik di atas dihitung dalam mode "Hanya Data Clean". */
  cleanOnly: boolean;
};

export type DashboardResult = {
  stats: DashboardStats;
  students: DashboardStudent[];
  generatedAt: string; // ISO WIB
  mapping: {
    quizStepId: string | null;
    quizStepTitle: string | null;
    survey1QuestionId: string | null;
    survey1QuestionText: string | null;
    feedbackQuestionId: string | null;
    feedbackQuestionText: string | null;
    survey2QuestionId: string | null;
    survey2QuestionText: string | null;
  };
};

// ─── Helper: timezone WIB ───────────────────────────────────────────────────

function toWIBString(dt: Date | null | undefined): string {
  if (!dt) return "-";
  const d = dt instanceof Date ? dt : new Date(dt as any);
  if (isNaN(d.getTime())) return "-";
  // WIB = UTC+7
  const wib = new Date(d.getTime() + 7 * 60 * 60 * 1000);
  const yyyy = wib.getUTCFullYear();
  const mm = String(wib.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(wib.getUTCDate()).padStart(2, "0");
  const hh = String(wib.getUTCHours()).padStart(2, "0");
  const mi = String(wib.getUTCMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

function isoToDDMMYYYY(iso: string | undefined | null): string {
  if (!iso) return "-";
  if (iso.match(/^\d{2}\/\d{2}\/\d{4}$/)) return iso;
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function calcAge(tanggalLahirIso: string | undefined | null): string {
  if (!tanggalLahirIso) return "-";
  let year, month, day;
  const mIso = tanggalLahirIso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const mId = tanggalLahirIso.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (mIso) {
    year = mIso[1]; month = mIso[2]; day = mIso[3];
  } else if (mId) {
    year = mId[3]; month = mId[2]; day = mId[1];
  } else {
    return "-";
  }
  const birth = new Date(`${year}-${month}-${day}`);
  if (isNaN(birth.getTime())) return "-";
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const md = now.getMonth() - birth.getMonth();
  if (md < 0 || (md === 0 && now.getDate() < birth.getDate())) age--;
  return age >= 0 && age < 150 ? String(age) : "-";
}

/**
 * Umur string ("23" / "-") → number. Mengembalikan null bila tidak terbaca.
 * Pakai parseInt, bukan Number(): `Number("")` = 0 → peserta tanpa tanggal
 * lahir akan terbaca "umur 0" dan lolos batas usia Data Clean.
 */
function parseAgeNum(ageStr: string): number | null {
  const n = parseInt(ageStr, 10);
  return Number.isFinite(n) ? n : null;
}

function ageToBucket(ageStr: string): string | null {
  const n = parseInt(ageStr, 10);
  if (isNaN(n)) return null;
  if (n <= 23) return "18-23"; // <18 ikut bucket pertama
  if (n <= 29) return "24-29";
  return "30+"; // 30 tahun ke atas
}

// ─── Helper: normalisasi email ──────────────────────────────────────────────

function normalizeEmail(e: string | null | undefined): string {
  return (e || "").toLowerCase().trim();
}

function toReadableDetailChannel(value: string): string {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const cleaned = raw.replace(/^Kelas Reguler Ioda Academy\s*-\s*/i, "");
  const match = cleaned.match(/^(WPB|BOOTCAMP|VL|REGULER)[_\s-]+(.+)$/i);
  if (!match) return cleaned.replace(/_/g, " ").replace(/\s+/g, " ").trim();
  const program = match[1].toUpperCase();
  const className = match[2].replace(/_/g, " ").replace(/\s+/g, " ").trim();
  return `${program} - ${className}`;
}

// ─── Helper: text-match fallback untuk mapping ──────────────────────────────

type StepWithSurvey = {
  stepId: string;
  stepTitle: string;
  questions: SurveyQuestion[];
};

function detectQuizStep(steps: CourseStep[]): { stepId: string; stepTitle: string } | null {
  const keywords = ["cash flow", "alokasi pemasukan", "dana darurat"];
  const match = steps.find(
    (s) =>
      s.hasAssessment &&
      keywords.some((k) => (s.title || "").toLowerCase().includes(k))
  );
  if (match) return { stepId: match.id, stepTitle: match.title };
  // fallback: pertama yang ada assessment
  const first = steps.find((s) => s.hasAssessment);
  return first ? { stepId: first.id, stepTitle: first.title } : null;
}

function findQuestionByKeywords(
  surveys: StepWithSurvey[],
  ...keywordSets: string[][]
): { id: string; text: string; stepTitle: string } | null {
  for (const keywords of keywordSets) {
    for (const sw of surveys) {
      for (const q of sw.questions) {
        const lower = (q.text || "").toLowerCase();
        if (keywords.every((k) => lower.includes(k))) {
          return { id: q.id, text: q.text, stepTitle: sw.stepTitle };
        }
      }
    }
  }
  return null;
}

function detectSurvey1(surveys: StepWithSurvey[]) {
  return findQuestionByKeywords(surveys, ["literasi keuangan", "soft skills"]);
}
function detectFeedback(surveys: StepWithSurvey[]) {
  return findQuestionByKeywords(surveys, ["ceritakan", "alasan"]);
}
function detectSurvey2(surveys: StepWithSurvey[]) {
  return findQuestionByKeywords(surveys, ["minat", "preferensi kerja"]);
}

// ─── Helper: status enrollment ──────────────────────────────────────────────

function deriveStatus(
  enr: Enrollment | null,
  totalSteps: number
): DashboardStudent["status"] {
  if (!enr) return "Belum Start";
  const status = String((enr as any).status || "").toLowerCase();
  if (
    enr.certificateClaimed ||
    status === "certified" ||
    status === "completed" ||
    !!String((enr as any).certificateDriveUrl || "").trim()
  ) return "Tersertifikasi";
  if (enr.currentStep > totalSteps) return "Selesai";
  return "In Progress";
}

// ─── Helper: ambil string dari profileData (handle field array & province_city) ─

function getProfileString(profileData: any, key: string): string {
  const v = profileData?.[key];
  if (v == null || v === "") return "";
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.join("; ");
  if (typeof v === "object") {
    if (v.city) return v.city; // province_city
    return JSON.stringify(v);
  }
  return String(v);
}

function toAnswerArray(value: any): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean);
  if (value == null || value === "") return [];
  return [String(value).trim()];
}

function collectEnrollmentAnswerMaps(enr: any): any[] {
  const maps: any[] = [];
  const pushMap = (value: any) => {
    if (value && typeof value === "object" && !Array.isArray(value)) maps.push(value);
  };

  pushMap(enr?.customFormResult?.answers);
  for (const sp of Object.values((enr?.stepProgress || {}) as Record<string, any>)) {
    pushMap((sp as any)?.formResult?.answers);
    pushMap((sp as any)?.surveyResult);
    for (const block of ((sp as any)?.lessonResult?.blocks || [])) {
      pushMap(block?.formResult?.answers);
      pushMap(block?.surveyResult);
    }
  }
  pushMap(enr?.survey);
  return maps;
}

function collectEnrollmentAssessments(enr: any): any[] {
  const results: any[] = [];
  const pushAssessment = (value: any) => {
    if (value && typeof value === "object" && !Array.isArray(value)) results.push(value);
  };

  pushAssessment(enr?.quiz);
  for (const sp of Object.values((enr?.stepProgress || {}) as Record<string, any>)) {
    pushAssessment((sp as any)?.assessmentResult);
    for (const block of ((sp as any)?.lessonResult?.blocks || [])) {
      pushAssessment(block?.assessmentResult);
    }
  }
  return results;
}

function getBestQuizAssessment(enr: any, quizStepId: string | null): any | null {
  const direct = quizStepId && enr?.stepProgress ? (enr.stepProgress as any)[quizStepId]?.assessmentResult : null;
  const assessments = [direct, ...collectEnrollmentAssessments(enr)].filter(Boolean);
  if (!assessments.length) return null;
  return assessments.find((item) => item.passed === true) || assessments[0];
}

function findInterestFromEnrollment(enr: any): string[] {
  for (const answers of collectEnrollmentAnswerMaps(enr)) {
    for (const [key, value] of Object.entries(answers)) {
      const values = toAnswerArray(value);
      if (!values.length) continue;
      const lowerKey = String(key).toLowerCase();
      if (
        lowerKey.includes("minat") ||
        lowerKey.includes("pelatihan") ||
        lowerKey.includes("preferensi") ||
        lowerKey.includes("bidang") ||
        lowerKey.includes("kerja")
      ) {
        return values;
      }
    }
  }

  for (const answers of collectEnrollmentAnswerMaps(enr)) {
    for (const [key, value] of Object.entries(answers)) {
      const values = toAnswerArray(value);
      if (!Array.isArray(value) || !values.length) continue;
      const lowerKey = String(key).toLowerCase();
      if (lowerKey.includes("rating") || lowerKey.includes("score")) continue;
      if (values.every((item) => !/^\d+(\.\d+)?$/.test(item) && !["ya", "tidak"].includes(item.toLowerCase()))) {
        return values;
      }
    }
  }
  return [];
}

function findSurveyAnswerFromEnrollment(enr: any, qId: string | null, kind: "survey1" | "feedback" | "survey2"): string | number | null {
  const maps = collectEnrollmentAnswerMaps(enr);
  if (qId) {
    for (const answers of maps) {
      const ans = answers[qId] ?? answers.answers?.[qId];
      if (ans != null && ans !== "") return ans as any;
    }
  }

  const ratingKeys = ["sq-rating", "rating"];
  if (kind === "survey1" || kind === "survey2") {
    const ratingAnswers = maps
      .map((answers) => {
        for (const key of ratingKeys) {
          const value = answers[key];
          if (value != null && value !== "") return value;
        }
        for (const [key, value] of Object.entries(answers)) {
          if (String(key).toLowerCase().includes("rating") && value != null && value !== "") return value;
        }
        return null;
      })
      .filter((value) => value != null && value !== "");
    const pick = kind === "survey1" ? ratingAnswers[0] : ratingAnswers[ratingAnswers.length - 1];
    return pick != null ? (pick as any) : null;
  }

  for (const answers of maps) {
    for (const key of ["sq-feedback", "feedback", "masukan", "alasan"]) {
      const value = answers[key];
      if (value != null && value !== "") return value as any;
    }
    for (const [key, value] of Object.entries(answers)) {
      const lowerKey = String(key).toLowerCase();
      if (
        value != null &&
        value !== "" &&
        (lowerKey.includes("feedback") || lowerKey.includes("masukan") || lowerKey.includes("alasan") || lowerKey.includes("ceritakan"))
      ) {
        return value as any;
      }
    }
  }
  return null;
}

function getCityFromProfile(profileData: any): string {
  // Cek beberapa kemungkinan key
  const candidates = ["asal_daerah", "asalDaerah", "kota", "kotaKabupaten"];
  for (const k of candidates) {
    const v = profileData?.[k];
    if (typeof v === "string" && v) return v;
    if (typeof v === "object" && v?.city) return v.city;
  }
  return "";
}

function getConsentValue(profileData: any): string {
  // Cari field yang nama-nya mengandung "consent" / "persetujuan" / "setuju"
  if (!profileData || typeof profileData !== "object") return "";
  for (const [k, v] of Object.entries(profileData)) {
    const lk = k.toLowerCase();
    if (lk.includes("consent") || lk.includes("persetujuan") || lk.includes("setuju")) {
      if (typeof v === "string") return v;
      if (Array.isArray(v)) return v.join("; ");
    }
  }
  return "";
}

// ─── Helper: parse rating dari jawaban survey ──────────────────────────────

function parseRating(val: unknown): number | null {
  if (val == null) return null;
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    const n = parseFloat(val);
    return isNaN(n) ? null : n;
  }
  return null;
}

// ─── Tipe dataset mentah (hasil fetch+build, sebelum filter) ────────────────

// Baris siswa lengkap termasuk field internal "_" untuk agregasi.
type FullStudent = DashboardStudent & {
  _gender: string;
  _disabilitas: string;
  _kota: string;
  _ageBucket: string | null;
  /** Umur sebagai angka; null bila tanggal lahir kosong/tak terbaca. */
  _ageNum: number | null;
  /** Area program (jabodetabek/medan/surabaya) atau null bila di luar area. */
  _area: AreaKey | null;
  _channel: string; // raw enrollments.channelSource
  _quizScore: number | null;
  _pretestScore: number | null;
  _survey1Rating: number | null;
  _survey2Rating: number | null;
  _minatArray: string[];
  _createdAt: Date | null;
  _linkSertifikat: string | null;
};

type RawDataset = {
  allStudents: FullStudent[];
  totalSteps: number;
  targets: any;
  quizStepId: string | null;
  quizStepTitle: string | null;
  survey1: { id: string | null; text: string | null };
  feedback: { id: string | null; text: string | null };
  survey2: { id: string | null; text: string | null };
};

// ─── Lookups + pembangun 1 baris siswa (dipakai bersama buildRawDataset & upsertStudentIndex) ──

export type StudentLookups = {
  eventsById: Map<string, IodaEvent>;
  partnerByCode: Map<string, PartnerCode>;
  topicsById: Map<string, BonusCourseTopic>;
  quizStepId: string | null;
  survey1: { id: string | null; text: string | null };
  feedback: { id: string | null; text: string | null };
  survey2: { id: string | null; text: string | null };
  totalSteps: number;
};

// Helper: convert Firestore timestamp ke Date
function tsToDate(t: any): Date | null {
  if (!t) return null;
  if (t instanceof Date) return t;
  if (typeof t.toDate === "function") return t.toDate();
  return new Date(t);
}

/**
 * Bangun 1 baris siswa lengkap dari (user, enrollment, lookups).
 * Fungsi murni — tidak menyentuh Firestore. Sumber kebenaran tunggal untuk
 * format baris siswa, dipakai oleh buildRawDataset() (loop) & upsertStudentIndex() (single).
 */
export function computeStudentRow(
  u: UserProfile & { uid: string },
  enr: (Enrollment & { id: string }) | null,
  lk: StudentLookups
): FullStudent {
  const { eventsById, partnerByCode, topicsById, quizStepId, survey1, feedback, survey2, totalSteps } = lk;
  const email = u.email;
  const profileData: any = u.profileData || {};

  // Tanggal Daftar — pakai createdAt user
  const createdAt = tsToDate((u as any).createdAt);
  const tanggalDaftar = toWIBString(createdAt);

  const persetujuan = getConsentValue(profileData);

  // Channel + detail
  const rawChannel = (enr?.channelSource || u.channelSource || "umum").toLowerCase();
  const channelLabel: Record<string, string> = {
    umum: "Umum",
    beasiswa: "Beasiswa",
    kemitraan: "Kemitraan",
    workshop: "Workshop",
  };
  const channel = channelLabel[rawChannel] || rawChannel;
  let detailChannel = "-";
  
  const code = u.partnerCode || "";

  if (rawChannel === "kemitraan" && code) {
    // Paksa gunakan nama event/mitra, abaikan detailChannel dari enrollments
    let partnerName = "-";
    // Cari di collection events
    for (const ev of Array.from(eventsById.values())) {
      if ((ev as any).partnerCode === code) {
        partnerName = ev.name || partnerName;
        break;
      }
    }
    // Fallback ke partnerCodes collection bila tidak ada di events
    if (partnerName === "-" && partnerByCode.has(code)) {
      partnerName = partnerByCode.get(code)?.partnerName || "-";
    }
    detailChannel = partnerName;
  } else {
    // Prioritaskan detailChannel yang tersimpan langsung di data (mis. peserta
    // standalone/Meta yang ditandai "All Beasiswa - Facebook Instant Forms").
    const storedDetail = ((enr as any)?.detailChannel || (u as any).detailChannel || "").toString().trim();
    if (storedDetail) {
      detailChannel = toReadableDetailChannel(storedDetail);
    } else if (rawChannel === "beasiswa" || rawChannel === "workshop") {
      const evId = enr?.eventId || u.eventId;
      if (evId) {
        detailChannel = eventsById.get(evId)?.name || "-";
      }
    }
  }

  const namaLengkap =
    getProfileString(profileData, "nama_lengkap") ||
    getProfileString(profileData, "namaLengkap") ||
    u.displayName || "";

  const nomorWA = (() => {
    const raw =
      getProfileString(profileData, "nomor_whatsapp") ||
      getProfileString(profileData, "nomorWA");
    if (!raw) return "";
    return raw.startsWith("+") ? raw : `+62${raw.replace(/^0+/, "")}`;
  })();

  const jenisKelamin =
    getProfileString(profileData, "jenis_kelamin") ||
    getProfileString(profileData, "jenisKelamin");

  let tanggalLahirIso = "";
  if (profileData) {
    for (const k of Object.keys(profileData)) {
      const kl = k.toLowerCase();
      if (kl.includes("tanggal") && kl.includes("lahir")) {
        tanggalLahirIso = getProfileString(profileData, k);
        if (tanggalLahirIso) break;
      }
    }
  }

  const tanggalLahir = isoToDDMMYYYY(tanggalLahirIso);
  const umur = calcAge(tanggalLahirIso);

  const kota = getCityFromProfile(profileData);

  const disabilitasRaw =
    getProfileString(profileData, "disabilitas") ||
    getProfileString(profileData, "isDisabilitas") || "";
  const isDisabilitasStatusYa =
    disabilitasRaw === "Ya" || disabilitasRaw === "Penyandang Disabilitas";
  // Kategori/jenis disabilitas mentah (hanya relevan bila status "Ya").
  const jenisDisabilitasRaw = isDisabilitasStatusYa
    ? getProfileString(profileData, "jenis_disabilitas") ||
      getProfileString(profileData, "jenisDisabilitas") ||
      getProfileString(profileData, "kategori_disabilitas_yang_anda_miliki") ||
      getProfileString(profileData, "kategori_disabilitas") ||
      getProfileString(profileData, "kategoriDisabilitas") || ""
    : "";
  // Normalisasi: status "Ya" tapi jenisnya kosong / "-" / "Tidak Ada" / "Lainnya"
  // dianggap BUKAN penyandang disabilitas (status → "Tidak"). Data form kadang
  // salah isi (pilih "Ya" lalu jenisnya tidak ada). Ini men-sinkronkan status.
  const jenisKosongAtauNone = (() => {
    const v = jenisDisabilitasRaw.trim().toLowerCase();
    return v === "" || v === "-" || v === "tidak ada" || v === "tidak" || v === "lainnya";
  })();
  const disabilitas =
    isDisabilitasStatusYa && jenisKosongAtauNone ? "Tidak" : disabilitasRaw;
  const jenisDisabilitas =
    disabilitas === "Ya" || disabilitas === "Penyandang Disabilitas"
      ? jenisDisabilitasRaw || "-"
      : "-";

  let minatArray: string[] = [];
  const rawMinatData = profileData?.["jika_diberikan_kesempatan_pelatihan_bidang_apa_yang_paling_anda_minati"];
  if (Array.isArray(rawMinatData)) {
    minatArray = rawMinatData.filter((x) => typeof x === "string" && x.trim());
  } else if (typeof rawMinatData === "string" && rawMinatData.trim() !== "") {
    minatArray = [rawMinatData.trim()];
  }
  if (!minatArray.length && enr?.bonusCourseTopicId) {
    const tName = topicsById.get(enr.bonusCourseTopicId)?.name;
    if (tName) minatArray = [tName];
  }
  if (!minatArray.length) {
    minatArray = findInterestFromEnrollment(enr);
  }
  const minat = minatArray.length > 0 ? minatArray.join("; ") : "Belum Pilih";

  const status = deriveStatus(enr, totalSteps);

  // Nilai Quiz + statusKuis
  let quizScore: number | null = null;
  let statusKuis: DashboardStudent["statusKuis"] = "-";
  const quizAssessment = getBestQuizAssessment(enr, quizStepId);
  if (quizAssessment) {
    quizScore = quizAssessment.firstPassScore ?? quizAssessment.score ?? quizAssessment.rawScore ?? null;
    if (quizAssessment.passed === true || quizAssessment.firstPassScore != null || (quizScore != null && quizScore >= 60)) {
      statusKuis = "LULUS";
    } else if (quizAssessment.attempts > 0 || quizScore != null) {
      statusKuis = "TIDAK LULUS";
    }
  }

  // Survey ratings
  function findAnswer(qId: string | null, kind: "survey1" | "feedback" | "survey2"): string | number | null {
    return findSurveyAnswerFromEnrollment(enr, qId, kind);
  }

  const rawSurvey1 = findAnswer(survey1.id, "survey1");
  const rawFeedback = findAnswer(feedback.id, "feedback");
  const rawSurvey2 = findAnswer(survey2.id, "survey2");

  // Nilai Pre-test — disimpan di users.profileData.pretest_score
  let pretestScore: number | null = null;
  {
    const rawPretest = profileData?.pretest_score;
    if (typeof rawPretest === "number" && !isNaN(rawPretest)) {
      pretestScore = rawPretest;
    } else if (typeof rawPretest === "string" && rawPretest.trim() !== "") {
      const n = parseFloat(rawPretest);
      if (!isNaN(n)) pretestScore = n;
    }
  }

  const ageBucket = ageToBucket(umur);

  // Status PDF sertifikat — dibedakan dari status kelulusan.
  const hasCertUrl = !!(enr?.certificateDriveUrl && String(enr.certificateDriveUrl).trim());
  let certStatus: DashboardStudent["certStatus"];
  if (!enr?.certificateClaimed) certStatus = "none";
  else if (hasCertUrl) certStatus = "ready";
  else if ((enr as any)?.pdfPending === true) certStatus = "processing";
  else certStatus = "stuck";

  return {
    tanggalDaftar,
    persetujuan,
    channel,
    detailChannel,
    email,
    nomorWA,
    namaLengkap,
    jenisKelamin,
    tanggalLahir,
    umur,
    kota,
    disabilitas,
    jenisDisabilitas,
    minat,
    status,
    nilaiPretest: pretestScore != null ? String(pretestScore) : "-",
    statusKuis,
    nilaiQuiz: quizScore != null ? String(quizScore) : "-",
    nilaiSurvei1: rawSurvey1 != null ? String(rawSurvey1) : "-",
    feedbackMateri: rawFeedback != null ? String(rawFeedback) : "-",
    nilaiSurvei2: rawSurvey2 != null ? String(rawSurvey2) : "-",
    linkSertifikat: enr?.certificateDriveUrl || null,
    certStatus,

    uid: u.uid || "",
    photoURL: u.photoURL || null,
    profileCompleted: !!u.profileCompleted,
    partnerCode: u.partnerCode || null,
    eventId: u.eventId || null,
    channelSource: u.channelSource || "",

    _gender: jenisKelamin,
    _disabilitas: disabilitas,
    _kota: kota,
    _ageBucket: ageBucket,
    _ageNum: parseAgeNum(umur),
    _area: areaOfCity(kota),
    _channel: rawChannel,
    _quizScore: quizScore,
    _pretestScore: pretestScore,
    _survey1Rating: parseRating(rawSurvey1),
    _survey2Rating: parseRating(rawSurvey2),
    _minatArray: minatArray,
    _createdAt: createdAt,
    _linkSertifikat: enr?.certificateDriveUrl || null,
  };
}

// ─── Cache mentah (in-memory, stale-while-revalidate) ───────────────────────
// Server berjalan long-running (node start.js) → cache aman & shared antar request.

const RAW_TTL_MS = 10_800_000; // 3 Jam (3 * 60 * 60 * 1000)
let _rawCache: { data: RawDataset; ts: number } | null = null;
let _rawInflight: Promise<RawDataset> | null = null;

/** Hapus cache — panggil setelah mutasi data admin agar perubahan langsung tampak. */
export function invalidateDashboardCache(): void {
  _rawCache = null;
}

const STORAGE_CACHE_FILE = "dashboard/raw-dataset-cache-v2.json";

async function saveToStorage(data: RawDataset) {
  try {
    const bucket = getAdminStorage().bucket();
    const file = bucket.file(STORAGE_CACHE_FILE);
    const content = JSON.stringify({ ts: Date.now(), data });
    await file.save(content, {
      contentType: "application/json",
    });
  } catch (e) {
    console.error("[Dashboard] Gagal menyimpan cache ke Storage:", e);
  }
}

function rebuildRawDataset(): Promise<RawDataset> {
  if (_rawInflight) return _rawInflight;
  _rawInflight = buildRawDataset()
    .then((data) => {
      _rawCache = { data, ts: Date.now() };
      // Simpan ke Storage secara asynchronous (fire & forget)
      saveToStorage(data).catch(console.error);
      return data;
    })
    .finally(() => {
      _rawInflight = null;
    });
  return _rawInflight;
}

/**
 * Ambil dataset mentah dengan pola stale-while-revalidate + Storage Fallback:
 * - bypass=true → rebuild & tunggu (tombol Refresh).
 * - ada memori (RAM) cache & segar → kembalikan cache.
 * - ada memori cache & basi → kembalikan cache (stale) lalu rebuild di background.
 * - memori kosong (Cold Start) → cek Storage. Jika ada, gunakan & isi RAM.
 * - Storage kosong → rebuild penuh.
 */
async function getRawDatasetCached(bypass = false): Promise<RawDataset> {
  if (bypass) return rebuildRawDataset();

  // 1. Cek Memori (RAM) terlebih dahulu (paling cepat)
  if (_rawCache) {
    const age = Date.now() - _rawCache.ts;
    if (age > RAW_TTL_MS && !_rawInflight) {
      // refresh background — jangan await, error tidak menghapus cache lama
      rebuildRawDataset().catch((e) => console.error("[Dashboard] background rebuild gagal:", e));
    }
    return _rawCache.data;
  }

  // 2. Cold Start (RAM Kosong) -> Coba ambil dari Firebase Storage
  try {
    const bucket = getAdminStorage().bucket();
    const file = bucket.file(STORAGE_CACHE_FILE);
    const [exists] = await file.exists();
    if (exists) {
      console.log("[Dashboard] Menggunakan cache dari Firebase Storage (Cold Start)");
      const [buffer] = await file.download();
      const parsed = JSON.parse(buffer.toString("utf-8")) as { ts: number; data: RawDataset };
      
      // Parse _createdAt strings back to Date objects
      for (const s of parsed.data.allStudents) {
        if (s._createdAt) {
          s._createdAt = new Date(s._createdAt);
        }
      }

      _rawCache = parsed; // Isi memori RAM kembali
      
      const age = Date.now() - parsed.ts;
      if (age > RAW_TTL_MS && !_rawInflight) {
        // Data di storage sudah basi, revalidate di belakang layar
        rebuildRawDataset().catch((e) => console.error("[Dashboard] background rebuild gagal (Storage):", e));
      }
      return parsed.data;
    }
  } catch (e) {
    console.error("[Dashboard] Gagal membaca cache Storage:", e);
  }

  // 3. Fallback Utama: Jika memori dan storage kosong (Pertama kali jalan)
  console.log("[Dashboard] Membangun ulang dataset dari awal (Cold Cache)");
  return rebuildRawDataset();
}

// ─── Main aggregator ────────────────────────────────────────────────────────

export async function aggregateDashboard(
  filter: DashboardFilter = {},
  options: AggregateOptions = {}
): Promise<DashboardResult> {
  const raw = await getRawDatasetCached(options.bypassCache);
  return applyFiltersAndAggregate(raw, filter, options);
}

export async function aggregatePartnerDashboard(
  partnerCode: string,
  filter: DashboardFilter = {},
  options: AggregateOptions = {}
): Promise<DashboardResult> {
  const rawDataset = await buildPartnerRawDataset(partnerCode);
  return applyFiltersAndAggregate(rawDataset, filter, options);
}

// ─── Build dataset mentah (mahal: fetch semua collection + bangun students) ──


export interface DashboardLookupsBase {
  eventsById: Map<string, IodaEvent>;
  partnerByCode: Map<string, PartnerCode>;
  topicsById: Map<string, BonusCourseTopic>;
  quizStepId: string | null;
  quizStepTitle: string | null;
  survey1: { id: string | null; text: string | null };
  feedback: { id: string | null; text: string | null };
  survey2: { id: string | null; text: string | null };
  totalSteps: number;
  targets: any;
  mainCourseIdActual: string;
}

export async function buildDashboardLookups(): Promise<DashboardLookupsBase> {
  const db = getAdminDb();
  const [
    coursesSnap,
    eventsSnap,
    partnerCodesSnap,
    bonusTopicsSnap,
    settingsDoc,
  ] = await Promise.all([
    db.collection("courses").get(),
    db.collection("events").get(),
    db.collection("partnerCodes").get(),
    db.collection("bonusCourseTopics").get(),
    db.collection("settings").doc("app").get(),
  ]);

  const settings = (settingsDoc.exists ? settingsDoc.data() : {}) || {};
  const targets = (settings.targets as any) || {};
  const dashboardMapping = (settings.dashboardMapping as any) || {};
  const mainCourseId = settings.mainCourseId || "course-main";

  // Build lookup tables
  const eventsById = new Map<string, IodaEvent>();
  eventsSnap.docs.forEach((d) => eventsById.set(d.id, { id: d.id, ...(d.data() as any) }));

  const partnerByCode = new Map<string, PartnerCode>();
  partnerCodesSnap.docs.forEach((d) => {
    const data = d.data() as any;
    if (data.code) partnerByCode.set(data.code, { id: d.id, ...data });
  });

  const topicsById = new Map<string, BonusCourseTopic>();
  bonusTopicsSnap.docs.forEach((d) => topicsById.set(d.id, { id: d.id, ...(d.data() as any) }));

  // Cari course utama + collect semua steps
  const mainCourseDoc = coursesSnap.docs.find((d) => d.id === mainCourseId)
    || coursesSnap.docs.find((d) => (d.data() as any).isMainCourse === true);
  const mainCourseIdActual = mainCourseDoc?.id || mainCourseId;

  let mainSteps: CourseStep[] = [];
  if (mainCourseDoc) {
    const stepsSnap = await db
      .collection("courseSteps")
      .where("courseId", "==", mainCourseDoc.id)
      .get();
      
    mainSteps = stepsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
    mainSteps.sort((a, b) => (a.order || 0) - (b.order || 0));
  }
  const totalSteps = mainSteps.length;

  const surveys: StepWithSurvey[] = mainSteps
    .filter((s) => s.survey?.questions?.length)
    .map((s) => ({
      stepId: s.id,
      stepTitle: s.title,
      questions: s.survey!.questions,
    }));

  let quizStepId: string | null = dashboardMapping.quizStepId || null;
  let quizStepTitle: string | null = null;
  if (quizStepId) {
    const found = mainSteps.find((s) => s.id === quizStepId);
    quizStepTitle = found?.title || null;
  } else {
    const auto = detectQuizStep(mainSteps);
    if (auto) {
      quizStepId = auto.stepId;
      quizStepTitle = auto.stepTitle;
    }
  }

  function resolveQuestion(
    explicitId: string | undefined,
    detector: () => { id: string; text: string; stepTitle: string } | null
  ): { id: string | null; text: string | null } {
    if (explicitId) {
      for (const sw of surveys) {
        const q = sw.questions.find((x) => x.id === explicitId);
        if (q) return { id: q.id, text: q.text };
      }
      return { id: explicitId, text: null };
    }
    const found = detector();
    return found ? { id: found.id, text: found.text } : { id: null, text: null };
  }

  const survey1 = resolveQuestion(dashboardMapping.survey1QuestionId, () => detectSurvey1(surveys));
  const feedback = resolveQuestion(dashboardMapping.feedbackQuestionId, () => detectFeedback(surveys));
  const survey2 = resolveQuestion(dashboardMapping.survey2QuestionId, () => detectSurvey2(surveys));

  if (!quizStepId) console.warn("[Dashboard] Step Quiz tidak ditemukan");
  if (!survey1.id) console.warn("[Dashboard] Pertanyaan Survei 1 tidak ditemukan");
  if (!feedback.id) console.warn("[Dashboard] Pertanyaan Feedback tidak ditemukan");
  if (!survey2.id) console.warn("[Dashboard] Pertanyaan Survei 2 tidak ditemukan");

  return {
    eventsById, partnerByCode, topicsById, quizStepId, quizStepTitle,
    survey1, feedback, survey2, totalSteps, targets, mainCourseIdActual
  };
}

async function buildRawDataset(): Promise<RawDataset> {
  const db = getAdminDb();
  const lookupsData = await buildDashboardLookups();
  const {
    eventsById, partnerByCode, topicsById, quizStepId, quizStepTitle,
    survey1, feedback, survey2, totalSteps, targets, mainCourseIdActual
  } = lookupsData;

  const [usersSnap, enrollmentsSnap] = await Promise.all([
    db.collection("users").get(),
    db.collection("enrollments").get(),
  ]);

  // Build map enrollment by userId untuk mainCourse — pilih updatedAt terbaru kalau dobel
  const enrollmentByUser = new Map<string, Enrollment & { _ts: number }>();
  for (const d of enrollmentsSnap.docs) {
    const data = d.data() as any;
    if (data.courseId !== mainCourseIdActual) continue;
    const ts =
      (data.updatedAt?.toMillis?.() as number) ||
      (data.createdAt?.toMillis?.() as number) ||
      0;
    const enrollment = { id: d.id, ...data, _ts: ts };
    const keys = new Set(
      [
        data.userId,
        normalizeEmail(data.email),
        d.id,
        normalizeEmail(d.id),
      ].filter((key) => String(key || "").trim()).map((key) => String(key).trim())
    );
    for (const key of keys) {
      const prev = enrollmentByUser.get(key);
      if (!prev || ts > prev._ts) {
        enrollmentByUser.set(key, enrollment);
      }
    }
  }

  // Process users — exclude admin, normalize email, dedup by email (ambil terbaru updatedAt)
  type RawUser = UserProfile & { _ts: number };
  const userByEmail = new Map<string, RawUser>();
  for (const d of usersSnap.docs) {
    const data = d.data() as any;
    if (data.role === "admin") continue;
    if (!data.profileCompleted) continue; // hanya hitung yang sudah lengkapi profil
    const email = normalizeEmail(data.email);
    if (!email) continue;
    const ts =
      (data.updatedAt?.toMillis?.() as number) ||
      (data.createdAt?.toMillis?.() as number) ||
      0;
    const prev = userByEmail.get(email);
    if (!prev || ts > prev._ts) {
      userByEmail.set(email, { uid: d.id, ...data, email, _ts: ts });
    }
  }

  // Lookups dibungkus untuk dipakai computeStudentRow (sumber kebenaran tunggal baris siswa)
  const lookups: StudentLookups = {
    eventsById,
    partnerByCode,
    topicsById,
    quizStepId,
    survey1,
    feedback,
    survey2,
    totalSteps,
  };

  // Build student rows
  const allStudents: FullStudent[] = [];
  for (const [email, u] of userByEmail) {
    const enr = enrollmentByUser.get(u.uid) || enrollmentByUser.get(email) || null;
    allStudents.push(computeStudentRow(u as any, enr as any, lookups));
  }

  return {
    allStudents,
    totalSteps,
    targets,
    quizStepId,
    quizStepTitle,
    survey1,
    feedback,
    survey2,
  };
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const result = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

export async function buildPartnerRawDataset(partnerCode: string): Promise<RawDataset> {
  const db = getAdminDb();
  const lookupsData = await buildDashboardLookups();
  const {
    eventsById, partnerByCode, topicsById, quizStepId, quizStepTitle,
    survey1, feedback, survey2, totalSteps, targets, mainCourseIdActual
  } = lookupsData;

  const usersSnap = await db.collection("users").where("partnerCode", "==", partnerCode).get();
  
  type RawUser = UserProfile & { _ts: number };
  const userByEmail = new Map<string, RawUser>();
  const uidsToFetch = new Set<string>();
  const emailsToFetch = new Set<string>();

  for (const d of usersSnap.docs) {
    const data = d.data() as any;
    if (data.role === "admin") continue;
    if (!data.profileCompleted) continue;
    const email = normalizeEmail(data.email);
    if (!email) continue;
    const ts =
      (data.updatedAt?.toMillis?.() as number) ||
      (data.createdAt?.toMillis?.() as number) ||
      0;
    const prev = userByEmail.get(email);
    if (!prev || ts > prev._ts) {
      userByEmail.set(email, { uid: d.id, ...data, email, _ts: ts });
      uidsToFetch.add(d.id);
      emailsToFetch.add(email);
    }
  }

  const uidsArray = Array.from(uidsToFetch);
  const emailsArray = Array.from(emailsToFetch);
  const uidChunks = chunkArray(uidsArray, 30);
  const emailChunks = chunkArray(emailsArray, 30);

  const enrollmentByUser = new Map<string, Enrollment & { _ts: number }>();
  
  const processEnrollmentsSnap = (snap: FirebaseFirestore.QuerySnapshot) => {
    for (const d of snap.docs) {
      const data = d.data() as any;
      if (data.courseId !== mainCourseIdActual) continue;
      const ts =
        (data.updatedAt?.toMillis?.() as number) ||
        (data.createdAt?.toMillis?.() as number) ||
        0;
      const enrollment = { id: d.id, ...data, _ts: ts };
      const keys = new Set(
        [
          data.userId,
          normalizeEmail(data.email),
          d.id,
          normalizeEmail(d.id),
        ].filter((key) => String(key || "").trim()).map((key) => String(key).trim())
      );
      for (const key of keys) {
        const prev = enrollmentByUser.get(key);
        if (!prev || ts > prev._ts) {
          enrollmentByUser.set(key, enrollment);
        }
      }
    }
  };

  for (const chunk of uidChunks) {
    if (chunk.length === 0) continue;
    const snap = await db.collection("enrollments").where("userId", "in", chunk).get();
    processEnrollmentsSnap(snap);
  }
  for (const chunk of emailChunks) {
    if (chunk.length === 0) continue;
    const snap = await db.collection("enrollments").where("email", "in", chunk).get();
    processEnrollmentsSnap(snap);
  }

  const lookups: StudentLookups = {
    eventsById, partnerByCode, topicsById, quizStepId,
    survey1, feedback, survey2, totalSteps,
  };

  const allStudents: FullStudent[] = [];
  for (const [email, u] of userByEmail) {
    const enr = enrollmentByUser.get(u.uid) || enrollmentByUser.get(email) || null;
    allStudents.push(computeStudentRow(u as any, enr as any, lookups));
  }

  return {
    allStudents,
    totalSteps, targets, quizStepId, quizStepTitle,
    survey1, feedback, survey2,
  };
}

// ─── Filter + agregasi + paginate (murah, per request) ──────────────────────

/**
 * Opsi agregasi.
 *  - `cleanOnly`  : hitung stats hanya dari peserta yang lolos syarat Data Clean.
 *  - `areas`      : batasi Data Clean ke sebagian area (undefined/kosong = semua).
 *                   Tidak berlaku untuk `mismatchExport`.
 */
export type AggregateOptions = {
  includeStudents?: boolean;
  exportOnlyCertified?: boolean;
  cleanExport?: boolean;
  rawExport?: boolean;
  mismatchExport?: boolean;
  cleanOnly?: boolean;
  areas?: AreaKey[];
  bypassCache?: boolean;
};

function applyFiltersAndAggregate(
  raw: RawDataset,
  filter: DashboardFilter = {},
  options: AggregateOptions = {}
): DashboardResult {
  const { allStudents, totalSteps, targets, quizStepId, quizStepTitle, survey1, feedback, survey2 } = raw;

  // ─── Aturan "Data Clean" ──────────────────────────────────────────────────
  // Peserta dianggap sesuai bila berdomisili di salah satu area program DAN
  // usianya 18–29 (18–35 untuk penyandang disabilitas).
  const hasDisabilitas = (s: FullStudent) => isDisabilitasValue(s._disabilitas);
  const isCleanEligible = (s: FullStudent) =>
    s._area !== null && 
    isAgeEligible(s._ageNum, hasDisabilitas(s)) && 
    s.status === "Tersertifikasi";

  // Subset area yang diminta pemanggil (export Clean per-area). Kosong/undefined
  // = semua area program.
  const selectedAreas =
    options.areas && options.areas.length > 0 ? new Set<AreaKey>(options.areas) : null;
  const inSelectedAreas = (s: FullStudent) =>
    !selectedAreas || (s._area !== null && selectedAreas.has(s._area));

  // ─── Apply filter ─────────────────────────────────────────────────────────
  let filtered = allStudents;
  if (filter.channel) {
    filtered = filtered.filter((s) => s._channel === filter.channel);
  }
  if (filter.gender) {
    filtered = filtered.filter((s) => s._gender === filter.gender);
  }
  if (filter.disabilitas) {
    filtered = filtered.filter((s) => s._disabilitas === filter.disabilitas);
  }
  if (filter.region) {
    filtered = filtered.filter(
      (s) => s._kota.toLowerCase() === (filter.region || "").toLowerCase()
    );
  }
  if (filter.topik) {
    filtered = filtered.filter(
      (s) => s._minatArray && s._minatArray.includes(filter.topik!)
    );
  }
  if (filter.usia) {
    filtered = filtered.filter((s) => s._ageBucket === filter.usia);
  }
  if (filter.dateFrom) {
    const from = new Date(filter.dateFrom);
    filtered = filtered.filter((s) => s._createdAt && s._createdAt >= from);
  }
  if (filter.dateTo) {
    const to = new Date(filter.dateTo);
    to.setHours(23, 59, 59, 999);
    filtered = filtered.filter((s) => s._createdAt && s._createdAt <= to);
  }
  if (filter.source) {
    // Source bisa = partnerCode (kemitraan), eventId (b2c/workshop), atau channel key.
    // Perbandingan case-insensitive agar toleran (partnerCode sering huruf besar/kecil campur).
    const src = String(filter.source).toLowerCase();
    filtered = filtered.filter((s) => {
      if (s.partnerCode && String(s.partnerCode).toLowerCase() === src) return true;
      if (s.eventId && String(s.eventId).toLowerCase() === src) return true;
      if (s._channel && String(s._channel).toLowerCase() === src) return true;
      return false;
    });
  }

  // ─── Mode "Hanya Data Clean" ──────────────────────────────────────────────
  // Bila aktif, SELURUH metrik dashboard (Completion, card per area, rerata,
  // asal, usia, …) dihitung hanya dari peserta yang lolos syarat area+usia —
  // sehingga semua angka di layar berasal dari populasi yang sama, dan
  // konsisten dengan jumlah baris export Data Clean.
  //
  // Sengaja variabel terpisah, bukan menimpa `filtered`: pemilihan baris
  // export di bawah membaca `filtered` dan punya aturannya sendiri (mis.
  // Data Tidak Sesuai justru butuh baris yang TIDAK clean).
  const statsBase = options.cleanOnly
    ? filtered.filter((s) => isCleanEligible(s) && inSelectedAreas(s))
    : filtered;

  // ─── Card Per Area ────────────────────────────────────────────────────────
  // Dihitung dari `statsBase` agar ikut menyusut saat toggle Data Clean aktif.
  // Kalau memakai `filtered`, card area akan menampilkan populasi mentah
  // sementara KPI di atasnya sudah tersaring → Jabodetabek bisa terlihat lebih
  // besar daripada Total Completion.
  const areaStats: AreaStat[] = AREAS.map((area) => {
    const inAreaRaw = filtered.filter((s) => s._area === area.key);
    const inArea = statsBase.filter((s) => s._area === area.key);
    const certified = inArea.filter((s) => s.status === "Tersertifikasi");
    return {
      key: area.key,
      label: area.label,
      desc: area.desc,
      registered: inAreaRaw.length,
      completed: certified.length,
      cleanCompleted: certified.filter(isCleanEligible).length,
    };
  });
  const luarAreaRaw = filtered.filter((s) => s._area === null);
  const luarArea = statsBase.filter((s) => s._area === null);
  const outsideArea: AreaStat = {
    key: "luar",
    label: "Daerah Lainnya",
    desc: "Kota di luar Jabodetabek, Surabaya, dan Medan",
    registered: luarAreaRaw.length,
    completed: luarArea.filter((s) => s.status === "Tersertifikasi").length,
    cleanCompleted: 0,
  };

  // ─── Agregasi ─────────────────────────────────────────────────────────────

  // Ambil hanya yang tersertifikasi (Completion) untuk metrik dashboard utama
  const certifiedFiltered = statsBase.filter((s) => s.status === "Tersertifikasi");

  const total = certifiedFiltered.length;
  const totalCompleted = filtered.length;

  const perempuanFiltered = statsBase.filter((s) => s._gender === "Perempuan");
  const perempuan = perempuanFiltered.filter((s) => s.status === "Tersertifikasi").length;
  const perempuanCompleted = filtered.filter((s) => s._gender === "Perempuan").length;

  const disabilitasFiltered = statsBase.filter(hasDisabilitas);
  const disabilitas = disabilitasFiltered.filter((s) => s.status === "Tersertifikasi").length;
  const disabilitasCompleted = filtered.filter(hasDisabilitas).length;

  const quizScores = certifiedFiltered.map((s) => s._quizScore).filter((x): x is number => x != null);
  const rerata = quizScores.length
    ? Number((quizScores.reduce((a, b) => a + b, 0) / quizScores.length).toFixed(3))
    : 0;

  const pretestScores = certifiedFiltered.map((s) => s._pretestScore).filter((x): x is number => x != null);
  const rerataPretest = pretestScores.length
    ? Number((pretestScores.reduce((a, b) => a + b, 0) / pretestScores.length).toFixed(3))
    : 0;

  const s1Ratings = certifiedFiltered.map((s) => s._survey1Rating).filter((x): x is number => x != null);
  const kepuasan = s1Ratings.length ? s1Ratings.reduce((a, b) => a + b, 0) / s1Ratings.length : 0;
  const respondenSurvei1 = certifiedFiltered.length;

  const s2Ratings = certifiedFiltered.map((s) => s._survey2Rating).filter((x): x is number => x != null);
  const keyakinan = s2Ratings.length ? s2Ratings.reduce((a, b) => a + b, 0) / s2Ratings.length : 0;
  const respondenSurvei2 = certifiedFiltered.length;

  // Origin top 9 kota
  const cityCount = new Map<string, number>();
  for (const s of certifiedFiltered) {
    if (!s._kota) continue;
    cityCount.set(s._kota, (cityCount.get(s._kota) || 0) + 1);
  }
  const origin = Array.from(cityCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 9);

  // Topik top 5
  const topicCount = new Map<string, number>();
  for (const s of certifiedFiltered) {
    if (!s._minatArray || s._minatArray.length === 0) continue;
    for (const name of s._minatArray) {
      topicCount.set(name, (topicCount.get(name) || 0) + 1);
    }
  }
  const topik = Array.from(topicCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Usia 3 bucket
  const usiaCount: Record<string, number> = { "18-23": 0, "24-29": 0, "30+": 0 };
  const usiaSource = options.cleanOnly
    ? filtered.filter((s) => isCleanEligible(s) && inSelectedAreas(s))
    : certifiedFiltered;
  for (const s of usiaSource) {
    if (s._ageBucket) usiaCount[s._ageBucket]++;
  }
  const usia: Array<[string, number]> = [
    ["18-23", usiaCount["18-23"]],
    ["24-29", usiaCount["24-29"]],
    ["30+", usiaCount["30+"]],
  ];

  // Channel breakdown & sourceList sengaja memakai `allStudents` (pra-filter,
  // termasuk pra-cleanOnly): keduanya BUKAN metrik yang ditampilkan, melainkan
  // daftar opsi filter Sumber. Kalau ikut menyusut, opsi bisa hilang dari menu
  // dan user tak bisa membatalkan filternya sendiri.
  const channelBreakdown: Record<string, { registered: number; completed: number }> = {
    umum: { registered: 0, completed: 0 },
    beasiswa: { registered: 0, completed: 0 },
    kemitraan: { registered: 0, completed: 0 },
    workshop: { registered: 0, completed: 0 },
  };
  for (const s of allStudents) {
    const ch = s._channel in channelBreakdown ? s._channel : "umum";
    channelBreakdown[ch].registered++;
    if (s.status === "Tersertifikasi") channelBreakdown[ch].completed++;
  }

  // Source list — dinamis dari events + partner codes + 4 channel base
  const sourceList: Array<{ key: string; label: string; share: number }> = [];
  const totalAll = allStudents.length || 1;
  sourceList.push({ key: "semua", label: "Semua Sumber", share: 1 });
  for (const ch of ["umum", "beasiswa", "kemitraan", "workshop"]) {
    const cnt = allStudents.filter((s) => s._channel === ch).length;
    if (cnt > 0) {
      sourceList.push({
        key: ch,
        label: ({ umum: "Umum", beasiswa: "Beasiswa", kemitraan: "Kemitraan", workshop: "Workshop" } as any)[ch],
        share: cnt / totalAll,
      });
    }
  }

  const lulusKuis = certifiedFiltered.filter((s) => s.statusKuis === "LULUS").length;
  const tidakLulusKuis = certifiedFiltered.filter((s) => s.statusKuis === "TIDAK LULUS").length;

  const stats: DashboardStats = {
    total,
    totalCompleted,
    totalTarget: Number(targets.totalPendaftar) || 0,
    perempuan,
    perempuanCompleted,
    perempuanTarget: Number(targets.perempuan) || 0,
    disabilitas,
    disabilitasCompleted,
    disabilitasTarget: Number(targets.disabilitas) || 0,
    rerata: Math.round(rerata * 10) / 10,
    rerataPretest: Math.round(rerataPretest * 10) / 10,
    kepuasan: Math.round(kepuasan * 10) / 10,
    keyakinan: Math.round(keyakinan * 10) / 10,
    respondenSurvei1,
    respondenSurvei2,
    origin,
    topik,
    usia,
    lulusKuis,
    tidakLulusKuis,
    channelBreakdown,
    sourceList,
    // Selalu 4 kartu (3 area + Daerah Lainnya) agar barisnya konsisten.
    // Dalam mode cleanOnly, "Daerah Lainnya" pasti 0 — itu memang informasinya:
    // tak ada peserta luar area yang ikut terhitung.
    areaStats: [...areaStats, outsideArea],
    cleanOnly: !!options.cleanOnly,
  };

  // Strip internal fields kalau includeStudents
  // Pilih sumber baris export:
  //  - rawExport / mismatchExport → semua peserta yang sudah menyelesaikan kursus
  //    (Selesai + Tersertifikasi). raw ambil semua; mismatch disaring komplemen Clean.
  //  - exportOnlyCertified → hanya yang Tersertifikasi (dipakai export Clean).
  //  - selain itu → seluruh hasil filter.
  let sourceArray =
    options.rawExport || options.mismatchExport
      ? filtered.filter((s) => s.status === "Selesai" || s.status === "Tersertifikasi")
      : options.exportOnlyCertified
      ? certifiedFiltered
      : filtered;

  if (options.mismatchExport) {
    // Data Tidak Sesuai = komplemen Clean: di luar area program ATAU usia
    // melewati batas. Sengaja TIDAK menghormati `options.areas` — filenya
    // memang untuk melihat semua baris yang tidak lolos.
    sourceArray = sourceArray.filter((s) => !isCleanEligible(s));
  } else if (options.cleanExport && !options.rawExport) {
    // Data Clean: dalam area terpilih & usia memenuhi syarat.
    sourceArray = sourceArray.filter((s) => isCleanEligible(s) && inSelectedAreas(s));
  }

  // Sort sourceArray by _createdAt (oldest to newest)
  sourceArray.sort((a, b) => {
    const timeA = a._createdAt ? a._createdAt.getTime() : 0;
    const timeB = b._createdAt ? b._createdAt.getTime() : 0;
    return timeA - timeB;
  });

  const students: DashboardStudent[] = options.includeStudents
    ? sourceArray.map(stripInternal)
    : [];

  return {
    stats,
    students,
    generatedAt: toWIBString(new Date()),
    mapping: {
      quizStepId,
      quizStepTitle,
      survey1QuestionId: survey1.id,
      survey1QuestionText: survey1.text,
      feedbackQuestionId: feedback.id,
      feedbackQuestionText: feedback.text,
      survey2QuestionId: survey2.id,
      survey2QuestionText: survey2.text,
    },
  };
}

// ─── Helper: parse filter dari URL search params ────────────────────────────

/**
 * Baca parameter `?areas=jabodetabek,medan` → daftar AreaKey valid.
 * Nilai tak dikenal dibuang. Kosong/absen → null (artinya: semua area).
 */
export function parseAreasFromSearchParams(sp: URLSearchParams): AreaKey[] | undefined {
  const raw = sp.get("areas");
  if (!raw) return undefined;
  const keys = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s !== "")
    .filter(isAreaKey);
  return keys.length > 0 ? Array.from(new Set(keys)) : undefined;
}

export function parseFilterFromSearchParams(sp: URLSearchParams): DashboardFilter {
  const get = (k: string) => {
    const v = sp.get(k);
    return v && v !== "" ? v : null;
  };
  return {
    channel: get("channel") as any,
    gender: get("gender") as any,
    disabilitas: get("disabilitas") as any,
    region: get("region"),
    topik: get("topik"),
    usia: get("usia") as any,
    dateFrom: get("dateFrom"),
    dateTo: get("dateTo"),
    source: get("source"),
  };
}

// ─── Helper: tabel Excel/Sheet headers + rows ───────────────────────────────

export const SHEET_HEADERS = [
  // Bagian 1
  "Tanggal Daftar",
  "Persetujuan",
  "Channel",
  "Detail Channel",
  "Email",
  "Nomor WA",
  "Nama Lengkap",
  "Jenis Kelamin",
  "Tanggal Lahir",
  "Umur",
  "Kota",
  "Disabilitas",
  "Jenis Disabilitas",
  "Minat",
  // Bagian 2
  "Status",
  "Nilai Pre-test",
  "Status Post-test",
  "Nilai Post-test",
  "Nilai Survei 1",
  "Feedback Materi",
  "Nilai Survei 2",
  "Link Sertifikat",
] as const;

export function studentToRow(s: DashboardStudent): (string | number)[] {
  return [
    s.tanggalDaftar,
    s.persetujuan,
    s.channel,
    s.detailChannel,
    s.email,
    s.nomorWA,
    s.namaLengkap,
    s.jenisKelamin,
    s.tanggalLahir,
    s.umur,
    s.kota,
    s.disabilitas,
    s.jenisDisabilitas,
    s.minat,
    s.status,
    s.nilaiPretest,
    s.statusKuis,
    s.nilaiQuiz,
    s.nilaiSurvei1,
    s.feedbackMateri,
    s.nilaiSurvei2,
    s.linkSertifikat || "-",
  ];
}

// ─── Query siswa untuk halaman student dataset (server-side filter+paginate) ─

export type StudentsQuery = {
  page?: number;
  pageSize?: number;
  channel?: string;        // "all" | umum | kemitraan | beasiswa | workshop
  detailChannel?: string;  // "all" | <nama detail channel>
  statusKuis?: string;     // "all" | LULUS | TIDAK LULUS | Belum
  status?: string;         // "all" | Tersertifikasi | Selesai | "Sedang Belajar" | "Belum Mulai"
  search?: string;
  sortUsia?: string;       // default | Termuda | Tertua
  bypassCache?: boolean;
};

export type StudentsPage = {
  students: DashboardStudent[];
  total: number;          // total semua siswa (tanpa filter apa pun)
  filteredTotal: number;  // total setelah filter (sebelum paginate)
  totalPages: number;
  page: number;
  pageSize: number;
  channelSummary: Record<string, number>; // count per channel (umum/kemitraan/beasiswa/workshop), tanpa filter
  detailChannelOptions: Array<{ value: string; count: number }>; // sesuai filter channel induk
  generatedAt: string;
};

// Petakan label progress UI → enum status aggregator.
function matchStatusFilter(studentStatus: string, uiFilter: string): boolean {
  if (uiFilter === "all") return true;
  switch (uiFilter) {
    case "Tersertifikasi": return studentStatus === "Tersertifikasi";
    case "Selesai": return studentStatus === "Selesai";
    case "Sedang Belajar": return studentStatus === "In Progress";
    case "Belum Mulai": return studentStatus === "Belum Start";
    // fallback: cocokkan langsung (mis. nilai enum dikirim apa adanya)
    default: return studentStatus === uiFilter;
  }
}

/** Buang field internal "_" agar tidak bocor ke payload API / file export. */
function stripInternal(s: FullStudent): DashboardStudent {
  const { _gender, _disabilitas, _kota, _ageBucket, _ageNum, _area, _channel, _quizScore,
          _pretestScore, _survey1Rating, _survey2Rating, _minatArray, _createdAt,
          _linkSertifikat, ...pub } = s;
  return pub;
}

function isDefaultLatestStudentsPage(q: StudentsQuery = {}): boolean {
  const page = q.page || 1;
  const pageSize = q.pageSize || 20;
  return (
    !q.bypassCache &&
    page >= 1 &&
    pageSize > 0 &&
    (q.channel || "all") === "all" &&
    (q.detailChannel || "all") === "all" &&
    (q.statusKuis || "all") === "all" &&
    (q.status || "all") === "all" &&
    (q.sortUsia || "default") === "default" &&
    !(q.search || "").trim()
  );
}



function rememberLatestEnrollment(
  byKey: Map<string, Enrollment & { id: string; _ts: number }>,
  id: string,
  data: any,
): void {
  if (!data || (data.courseId && data.courseId !== "course-main")) return;
  const ts =
    (data.updatedAt?.toMillis?.() as number) ||
    (data.certificateClaimedAt?.toMillis?.() as number) ||
    (data.createdAt?.toMillis?.() as number) ||
    0;
  const enrollment = { id, ...data, _ts: ts } as Enrollment & { id: string; _ts: number };
  const keys = new Set(
    [
      data.userId,
      normalizeEmail(data.email),
      id,
      normalizeEmail(id),
    ].filter((key) => String(key || "").trim()).map((key) => String(key).trim())
  );
  for (const key of keys) {
    const prev = byKey.get(key);
    if (!prev || ts > prev._ts) byKey.set(key, enrollment);
  }
}

async function countProfileCompletedUsers(): Promise<number> {
  const db = getAdminDb();
  const ref = db.collection("users").where("profileCompleted", "==", true);
  const aggregate = (ref as any).count;
  if (typeof aggregate === "function") {
    const snap = await (ref as any).count().get();
    return Number(snap.data().count || 0);
  }
  return (await ref.get()).size;
}

async function queryStudentsLatestDirect(q: StudentsQuery = {}): Promise<StudentsPage> {
  const db = getAdminDb();
  const page = Math.max(1, q.page || 1);
  const pageSize = Math.max(1, Math.min(200, q.pageSize || 50));
  const targetStart = (page - 1) * pageSize;
  const lookups = await loadLookups();

  const total = await countProfileCompletedUsers();
  const users: any[] = [];
  let scanned = 0;
  let accepted = 0;
  const scanLimit = Math.max(100, pageSize * 2);

  while (users.length < pageSize) {
    const snap = await db.collection("users")
      .orderBy("createdAt", "desc")
      .offset(scanned)
      .limit(scanLimit)
      .get();
    if (snap.empty) break;
    scanned += snap.size;

    for (const d of snap.docs) {
      const u = { uid: d.id, ...(d.data() as any) };
      if (u.role === "admin" || !u.profileCompleted || !normalizeEmail(u.email)) continue;
      if (accepted < targetStart) {
        accepted += 1;
        continue;
      }
      if (users.length < pageSize) users.push(u);
      accepted += 1;
      if (users.length >= pageSize) break;
    }

    if (snap.size < scanLimit) break;
  }

  const emails = Array.from(new Set(users.map((u: any) => normalizeEmail(u.email)).filter(Boolean)));
  const uids = Array.from(new Set(users.map((u: any) => String(u.uid || "").trim()).filter(Boolean)));
  const enrollmentByKey = new Map<string, Enrollment & { id: string; _ts: number }>();
  const seenDocs = new Set<string>();
  const rememberSnap = (docSnap: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot) => {
    if (!docSnap.exists || seenDocs.has(docSnap.id)) return;
    seenDocs.add(docSnap.id);
    rememberLatestEnrollment(enrollmentByKey, docSnap.id, docSnap.data() as any);
  };

  for (const batch of chunkArray(emails, 10)) {
    const snap = await db.collection("enrollments").where("email", "in", batch).get();
    snap.docs.forEach(rememberSnap);
  }
  for (const batch of chunkArray(uids, 10)) {
    const snap = await db.collection("enrollments").where("userId", "in", batch).get();
    snap.docs.forEach(rememberSnap);
  }
  await Promise.all(emails.map(async (email) => {
    const docSnap = await db.collection("enrollments").doc(email).get();
    rememberSnap(docSnap);
  }));

  const rows = users
    .map((u: any) => {
      const email = normalizeEmail(u.email);
      const enr = enrollmentByKey.get(u.uid) || enrollmentByKey.get(email) || null;
      return computeStudentRow({ ...u, email } as any, enr as any, lookups);
    })
    .sort((a, b) => {
      const ta = a._createdAt ? a._createdAt.getTime() : 0;
      const tb = b._createdAt ? b._createdAt.getTime() : 0;
      return tb - ta;
    });

  const channelSummary: Record<string, number> = { umum: 0, kemitraan: 0, beasiswa: 0, workshop: 0 };
  const detailCounts = new Map<string, number>();
  for (const s of rows) {
    const ch = (s.channelSource || s._channel || "").toLowerCase();
    if (ch in channelSummary) channelSummary[ch]++;
    if (s.detailChannel && s.detailChannel !== "-") {
      detailCounts.set(s.detailChannel, (detailCounts.get(s.detailChannel) || 0) + 1);
    }
  }

  return {
    students: rows.map(stripInternal),
    total,
    filteredTotal: total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    page,
    pageSize,
    channelSummary,
    detailChannelOptions: Array.from(detailCounts.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([value, count]) => ({ value, count })),
    generatedAt: toWIBString(new Date()),
  };
}

export async function queryStudents(q: StudentsQuery = {}): Promise<StudentsPage> {
  if (isDefaultLatestStudentsPage(q)) {
    return queryStudentsLatestDirect(q);
  }

  const raw = await getRawDatasetCached(q.bypassCache);
  const all = raw.allStudents;

  const page = Math.max(1, q.page || 1);
  const pageSize = Math.max(1, Math.min(200, q.pageSize || 20));
  const channel = q.channel || "all";
  const detailChannel = q.detailChannel || "all";
  const statusKuis = q.statusKuis || "all";
  const status = q.status || "all";
  const sortUsia = q.sortUsia || "default";
  const search = (q.search || "").trim().toLowerCase();

  // Channel summary — selalu dari SEMUA siswa (tidak terpengaruh filter)
  const channelSummary: Record<string, number> = { umum: 0, kemitraan: 0, beasiswa: 0, workshop: 0 };
  for (const s of all) {
    const ch = (s.channelSource || s._channel || "").toLowerCase();
    if (ch in channelSummary) channelSummary[ch]++;
  }

  // Filter channel induk dulu (dipakai juga untuk opsi detail channel)
  const byMainChannel = channel === "all"
    ? all
    : all.filter((s) => (s.channelSource || "").toLowerCase() === channel || (s.channel || "").toLowerCase() === channel);

  // Opsi detail channel + count, dari data yang sudah difilter channel induk
  const detailCounts = new Map<string, number>();
  for (const s of byMainChannel) {
    const dc = s.detailChannel;
    if (dc && dc !== "-") detailCounts.set(dc, (detailCounts.get(dc) || 0) + 1);
  }
  const detailChannelOptions = Array.from(detailCounts.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([value, count]) => ({ value, count }));

  // Filter sisanya
  let filtered = byMainChannel.filter((s) => {
    if (detailChannel !== "all" && s.detailChannel !== detailChannel) return false;
    if (statusKuis !== "all") {
      if (statusKuis === "Belum") {
        if (s.statusKuis && s.statusKuis !== "-") return false;
      } else if (s.statusKuis !== statusKuis) {
        return false;
      }
    }
    if (!matchStatusFilter(s.status, status)) return false;
    if (search) {
      const hay = `${s.namaLengkap || ""} ${s.email || ""} ${s.partnerCode || ""} ${s.detailChannel || ""}`.toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });

  // Sort — default terbaru→terlama (createdAt desc); Termuda/Tertua berdasarkan umur
  if (sortUsia === "Termuda") {
    filtered = [...filtered].sort((a, b) => (Number(a.umur) || 0) - (Number(b.umur) || 0));
  } else if (sortUsia === "Tertua") {
    filtered = [...filtered].sort((a, b) => (Number(b.umur) || 0) - (Number(a.umur) || 0));
  } else {
    filtered = [...filtered].sort((a, b) => {
      const ta = a._createdAt ? a._createdAt.getTime() : 0;
      const tb = b._createdAt ? b._createdAt.getTime() : 0;
      return tb - ta; // terbaru dulu
    });
  }

  const filteredTotal = filtered.length;
  const totalPages = Math.max(1, Math.ceil(filteredTotal / pageSize));
  const safePage = Math.min(page, totalPages);
  const slice = filtered.slice((safePage - 1) * pageSize, safePage * pageSize).map(stripInternal);

  return {
    students: slice,
    total: all.length,
    filteredTotal,
    totalPages,
    page: safePage,
    pageSize,
    channelSummary,
    detailChannelOptions,
    generatedAt: toWIBString(new Date()),
  };
}

// Kelompokkan siswa pending (belum tersertifikasi) per tanggal daftar — untuk fitur Luluskan Massal.
export async function groupPendingByDate(bypassCache = false): Promise<Array<{ date: string; students: DashboardStudent[] }>> {
  const raw = await getRawDatasetCached(bypassCache);
  const pending = raw.allStudents.filter((s) => s.status !== "Tersertifikasi");
  const byDate = new Map<string, DashboardStudent[]>();
  for (const s of pending) {
    const date = (s.tanggalDaftar || "-").slice(0, 10); // YYYY-MM-DD
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date)!.push(stripInternal(s));
  }
  return Array.from(byDate.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, students]) => ({ date, students }));
}

// ════════════════════════════════════════════════════════════════════════════
// studentsIndex — collection datar terindeks untuk pagination sejati (limit/cursor)
// di halaman admin Siswa. 1 dokumen per siswa kanonik (doc id = uid).
// ════════════════════════════════════════════════════════════════════════════

export const STUDENTS_INDEX = "studentsIndex";
const STUDENTS_META_DOC = "studentsMeta/detailChannels";

/** Normalisasi statusKuis "-" → "BELUM" supaya bisa difilter equality di Firestore. */
function normStatusKuis(s: string): "LULUS" | "TIDAK LULUS" | "BELUM" {
  return s === "LULUS" || s === "TIDAK LULUS" ? s : "BELUM";
}

/** Dokumen datar studentsIndex yang dibaca langsung untuk render tabel + query. */
export type StudentIndexDoc = DashboardStudent & {
  isStudent: true;
  namaLengkap_lower: string;
  umurNum: number;            // umur sebagai number untuk sort range
  statusKuisNorm: "LULUS" | "TIDAK LULUS" | "BELUM";
  channelKey: string;         // raw channel (umum/beasiswa/kemitraan/workshop)
  createdAtMs: number;        // epoch ms untuk sort default desc (stabil)
};

/** Bangun dokumen index datar dari FullStudent (hasil computeStudentRow). */
function buildIndexDoc(row: FullStudent): StudentIndexDoc {
  const pub = stripInternal(row);
  const umurNum = Number(row.umur) || 0;
  return {
    ...pub,
    isStudent: true,
    namaLengkap_lower: (row.namaLengkap || "").toLowerCase(),
    umurNum,
    statusKuisNorm: normStatusKuis(row.statusKuis),
    // channelKey HARUS sama dengan channel yang ditampilkan (label) — yaitu
    // _channel (prioritas enrollment.channelSource), bukan user.channelSource.
    // Kalau pakai user.channelSource, filter channel akan beda dari label.
    channelKey: (row._channel || row.channelSource || "umum").toLowerCase(),
    createdAtMs: row._createdAt ? row._createdAt.getTime() : 0,
  };
}

// ─── Lookups loader (cache in-memory; events/partners/topics/steps jarang berubah) ──

const LOOKUPS_TTL_MS = 10 * 60 * 1000; // 10 menit
let _lookupsCache: { data: StudentLookups; ts: number } | null = null;

export function invalidateLookupsCache(): void {
  _lookupsCache = null;
}

async function loadLookups(bypass = false): Promise<StudentLookups> {
  if (!bypass && _lookupsCache && Date.now() - _lookupsCache.ts < LOOKUPS_TTL_MS) {
    return _lookupsCache.data;
  }
  const db = getAdminDb();
  const [coursesSnap, eventsSnap, partnerCodesSnap, bonusTopicsSnap, settingsDoc] =
    await Promise.all([
      db.collection("courses").get(),
      db.collection("events").get(),
      db.collection("partnerCodes").get(),
      db.collection("bonusCourseTopics").get(),
      db.collection("settings").doc("app").get(),
    ]);

  const settings = (settingsDoc.exists ? settingsDoc.data() : {}) || {};
  const dashboardMapping = (settings.dashboardMapping as any) || {};
  const mainCourseId = settings.mainCourseId || "course-main";

  const eventsById = new Map<string, IodaEvent>();
  eventsSnap.docs.forEach((d) => eventsById.set(d.id, { id: d.id, ...(d.data() as any) }));
  const partnerByCode = new Map<string, PartnerCode>();
  partnerCodesSnap.docs.forEach((d) => {
    const data = d.data() as any;
    if (data.code) partnerByCode.set(data.code, { id: d.id, ...data });
  });
  const topicsById = new Map<string, BonusCourseTopic>();
  bonusTopicsSnap.docs.forEach((d) => topicsById.set(d.id, { id: d.id, ...(d.data() as any) }));

  const mainCourseDoc = coursesSnap.docs.find((d) => d.id === mainCourseId)
    || coursesSnap.docs.find((d) => (d.data() as any).isMainCourse === true);

  let mainSteps: CourseStep[] = [];
  if (mainCourseDoc) {
    const stepsSnap = await db.collection("courseSteps").where("courseId", "==", mainCourseDoc.id).get();
    mainSteps = stepsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
    mainSteps.sort((a, b) => (a.order || 0) - (b.order || 0));
  }
  const totalSteps = mainSteps.length;

  const surveys: StepWithSurvey[] = mainSteps
    .filter((s) => s.survey?.questions?.length)
    .map((s) => ({ stepId: s.id, stepTitle: s.title, questions: s.survey!.questions }));

  let quizStepId: string | null = dashboardMapping.quizStepId || null;
  if (!quizStepId) {
    const auto = detectQuizStep(mainSteps);
    if (auto) quizStepId = auto.stepId;
  }
  const resolveQ = (
    explicitId: string | undefined,
    detector: () => { id: string; text: string; stepTitle: string } | null
  ): { id: string | null; text: string | null } => {
    if (explicitId) {
      for (const sw of surveys) {
        const q = sw.questions.find((x) => x.id === explicitId);
        if (q) return { id: q.id, text: q.text };
      }
      return { id: explicitId, text: null };
    }
    const found = detector();
    return found ? { id: found.id, text: found.text } : { id: null, text: null };
  };
  const survey1 = resolveQ(dashboardMapping.survey1QuestionId, () => detectSurvey1(surveys));
  const feedback = resolveQ(dashboardMapping.feedbackQuestionId, () => detectFeedback(surveys));
  const survey2 = resolveQ(dashboardMapping.survey2QuestionId, () => detectSurvey2(surveys));

  const data: StudentLookups = {
    eventsById, partnerByCode, topicsById, quizStepId, survey1, feedback, survey2, totalSteps,
  };
  _lookupsCache = { data, ts: Date.now() };
  return data;
}

// ─── upsert / delete satu dokumen index ─────────────────────────────────────

/**
 * Hitung ulang & tulis dokumen studentsIndex untuk satu user (by uid).
 * Dipanggil non-fatal di tiap write path (di sebelah invalidateDashboardCache).
 * Jika user bukan siswa valid (admin / belum lengkapi profil / tidak ada) → hapus index.
 */
export async function upsertStudentIndex(uid: string): Promise<void> {
  if (!uid) return;
  const db = getAdminDb();
  const userSnap = await db.collection("users").doc(uid).get();
  if (!userSnap.exists) {
    await db.collection(STUDENTS_INDEX).doc(uid).delete().catch(() => {});
    return;
  }
  const u = { uid, ...(userSnap.data() as any) };
  if (u.role === "admin" || !u.profileCompleted) {
    await db.collection(STUDENTS_INDEX).doc(uid).delete().catch(() => {});
    return;
  }

  const lookups = await loadLookups();

  // Ambil enrollment mainCourse terbaru milik user ini (by userId, lalu by email).
  const email = normalizeEmail(u.email);
  let enr: (Enrollment & { id: string }) | null = null;
  let enrTs = -1;
  const candidateDocs: Array<{ id: string; data: any }> = [];
  const seenEnrollmentDocs = new Set<string>();
  const remember = (d: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot) => {
    if (!d.exists || seenEnrollmentDocs.has(d.id)) return;
    seenEnrollmentDocs.add(d.id);
    candidateDocs.push({ id: d.id, data: d.data() as any });
  };
  const consider = (d: { id: string; data: any }) => {
    const data = d.data || {};
    if (data.courseId && data.courseId !== "course-main") return;
    const ts = (data.updatedAt?.toMillis?.() as number) || (data.createdAt?.toMillis?.() as number) || 0;
    if (ts > enrTs) { enr = { id: d.id, ...data }; enrTs = ts; }
  };
  const byUid = await db.collection("enrollments").where("userId", "==", uid).get();
  byUid.docs.forEach(remember);
  if (email) {
    const byEmail = await db.collection("enrollments").where("email", "==", email).get();
    byEmail.docs.forEach(remember);
    const byDocEmail = await db.collection("enrollments").doc(email).get();
    remember(byDocEmail);
  }
  candidateDocs.forEach(consider);

  const row = computeStudentRow(u as any, enr, lookups);
  const doc = buildIndexDoc(row);
  await db.collection(STUDENTS_INDEX).doc(uid).set(doc, { merge: false });
}

/** Resolve uid dari email lalu upsert (untuk write path yang hanya punya email). */
export async function upsertStudentIndexByEmail(emailRaw: string): Promise<void> {
  const email = normalizeEmail(emailRaw);
  if (!email) return;
  const db = getAdminDb();
  // users biasanya doc id = uid; cari by field email (ambil terbaru).
  const snap = await db.collection("users").where("email", "==", email).get();
  if (snap.empty) {
    // fallback: dokumen users mungkin pakai email sebagai doc id (jalur meta/standalone)
    await upsertStudentIndex(email);
    return;
  }
  let bestUid = snap.docs[0].id, bestTs = -1;
  snap.docs.forEach((d) => {
    const data = d.data() as any;
    const ts = (data.updatedAt?.toMillis?.() as number) || (data.createdAt?.toMillis?.() as number) || 0;
    if (ts > bestTs) { bestUid = d.id; bestTs = ts; }
  });
  await upsertStudentIndex(bestUid);
}

export async function deleteStudentIndex(uid: string): Promise<void> {
  if (!uid) return;
  await getAdminDb().collection(STUDENTS_INDEX).doc(uid).delete().catch(() => {});
}

// ─── Query pagination sejati dari studentsIndex ─────────────────────────────

// Cache kecil untuk channelSummary (4 count) & detailChannelOptions (1 doc) — jarang berubah.
const SUMMARY_TTL_MS = 60 * 1000;
let _summaryCache: { channelSummary: Record<string, number>; ts: number } | null = null;

const CHANNEL_KEYS = ["umum", "kemitraan", "beasiswa", "workshop"] as const;

async function getChannelSummaryCached(): Promise<Record<string, number>> {
  if (_summaryCache && Date.now() - _summaryCache.ts < SUMMARY_TTL_MS) {
    return _summaryCache.channelSummary;
  }
  const db = getAdminDb();
  const base = db.collection(STUDENTS_INDEX).where("isStudent", "==", true);
  const counts = await Promise.all(
    CHANNEL_KEYS.map((ch) => base.where("channelKey", "==", ch).count().get())
  );
  const channelSummary: Record<string, number> = { umum: 0, kemitraan: 0, beasiswa: 0, workshop: 0 };
  CHANNEL_KEYS.forEach((ch, i) => { channelSummary[ch] = counts[i].data().count; });
  _summaryCache = { channelSummary, ts: Date.now() };
  return channelSummary;
}

async function getDetailChannelOptions(channel: string): Promise<Array<{ value: string; count: number }>> {
  const db = getAdminDb();
  const snap = await db.collection(STUDENTS_META_DOC.split("/")[0]).doc(STUDENTS_META_DOC.split("/")[1]).get();
  const map = (snap.exists ? (snap.data() as any) : {}) || {};
  // map: { [channelKey]: { [detailChannel]: count } }
  const result = new Map<string, number>();
  const addFrom = (obj: any) => {
    if (!obj) return;
    for (const [dc, c] of Object.entries(obj)) {
      if (dc && dc !== "-") result.set(dc, (result.get(dc) || 0) + (Number(c) || 0));
    }
  };
  if (channel === "all") {
    for (const ch of CHANNEL_KEYS) addFrom(map[ch]);
  } else {
    addFrom(map[channel]);
  }
  return Array.from(result.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([value, count]) => ({ value, count }));
}

/**
 * Versi pagination sejati dari queryStudents — membaca studentsIndex via query
 * Firestore ber-limit (≈pageSize read) + count() untuk total, BUKAN baca semua.
 * Kompatibel bentuk StudentsPage. Search = prefix nama (namaLengkap_lower).
 */
export async function queryStudentsPaged(q: StudentsQuery = {}): Promise<StudentsPage> {
  const db = getAdminDb();
  const page = Math.max(1, q.page || 1);
  const pageSize = Math.max(1, Math.min(200, q.pageSize || 20));
  const channel = (q.channel || "all").toLowerCase();
  const detailChannel = q.detailChannel || "all";
  const statusKuis = q.statusKuis || "all";
  const status = q.status || "all";
  const sortUsia = q.sortUsia || "default";
  const search = (q.search || "").trim().toLowerCase();

  // Sort umur (Termuda/Tertua) butuh composite index umurNum untuk tiap kombinasi
  // filter — dan varian DESC belum ada — sehingga orderBy("umurNum") bisa gagal
  // (FAILED_PRECONDITION → 500). Sort umur jarang dipakai; delegasikan ke jalur
  // in-memory queryStudents yang menangani semua kombinasi filter dengan aman.
  if (sortUsia === "Termuda" || sortUsia === "Tertua") {
    return queryStudents(q);
  }

  // Bangun query dasar dengan filter equality
  let base: FirebaseFirestore.Query = db.collection(STUDENTS_INDEX).where("isStudent", "==", true);
  if (channel !== "all") base = base.where("channelKey", "==", channel);
  if (detailChannel !== "all") base = base.where("detailChannel", "==", detailChannel);
  if (statusKuis !== "all") base = base.where("statusKuisNorm", "==", normStatusKuis(statusKuis));
  if (status !== "all") {
    const map: Record<string, string> = {
      "Tersertifikasi": "Tersertifikasi", "Selesai": "Selesai",
      "Sedang Belajar": "In Progress", "Belum Mulai": "Belum Start",
    };
    base = base.where("status", "==", map[status] || status);
  }

  // Sort + search. Search prefix memakai range field namaLengkap_lower (mutually exclusive
  // dengan sort umur — UI menonaktifkan sort saat search aktif).
  let ordered: FirebaseFirestore.Query;
  if (search) {
    ordered = base
      .where("namaLengkap_lower", ">=", search)
      .where("namaLengkap_lower", "<", search + "")
      .orderBy("namaLengkap_lower");
  } else if (sortUsia === "Termuda") {
    ordered = base.orderBy("umurNum", "asc");
  } else if (sortUsia === "Tertua") {
    ordered = base.orderBy("umurNum", "desc");
  } else {
    ordered = base.orderBy("createdAtMs", "desc");
  }

  // filteredTotal via count() (murah), channelSummary + detailChannelOptions paralel.
  const [countSnap, channelSummary, detailChannelOptions] = await Promise.all([
    ordered.count().get(),
    getChannelSummaryCached(),
    getDetailChannelOptions(channel),
  ]);
  const filteredTotal = countSnap.data().count;
  const totalPages = Math.max(1, Math.ceil(filteredTotal / pageSize));
  const safePage = Math.min(page, totalPages);

  // Ambil 1 halaman via offset (page-number UI). Offset boros sedikit tapi tetap
  // jauh lebih murah dari baca-semua; bisa dioptimasi ke cursor nanti.
  const pageSnap = await ordered.offset((safePage - 1) * pageSize).limit(pageSize).get();
  const students = pageSnap.docs.map((d) => {
    const data = d.data() as StudentIndexDoc;
    const { isStudent, namaLengkap_lower, umurNum, statusKuisNorm, channelKey, createdAtMs, ...pub } =
      data as any;
    return pub as DashboardStudent;
  });

  const total = Object.values(channelSummary).reduce((a, b) => a + b, 0);

  return {
    students,
    total,
    filteredTotal,
    totalPages,
    page: safePage,
    pageSize,
    channelSummary,
    detailChannelOptions,
    generatedAt: toWIBString(new Date()),
  };
}

/**
 * Bangun ulang SELURUH studentsIndex + studentsMeta/detailChannels dari sumber
 * kebenaran (buildRawDataset). Idempoten. Dipakai oleh backfill (sekali jalan)
 * dan cron penjaga (berkala) untuk menambal drift.
 */
export async function rebuildStudentsIndex(): Promise<{
  written: number; deleted: number; total: number;
}> {
  const db = getAdminDb();
  const raw = await buildRawDataset();
  
  // Simpan juga ke Storage Cache agar dashboard tetap super cepat
  saveToStorage(raw).catch(e => console.error("[Dashboard] Gagal sinkron cron ke Storage:", e));

  const rows = raw.allStudents;

  // Kumpulkan uid kanonik & dokumen index + agregat detailChannel per channel.
  const wantedUids = new Set<string>();
  const detailMap: Record<string, Record<string, number>> = {
    umum: {}, beasiswa: {}, kemitraan: {}, workshop: {},
  };

  let batch = db.batch();
  let ops = 0;
  let written = 0;
  for (const row of rows) {
    if (!row.uid) continue;
    wantedUids.add(row.uid);
    const doc = buildIndexDoc(row);
    batch.set(db.collection(STUDENTS_INDEX).doc(row.uid), doc, { merge: false });
    ops++; written++;
    // agregat detailChannel
    const ch = doc.channelKey;
    if (ch in detailMap && doc.detailChannel && doc.detailChannel !== "-") {
      detailMap[ch][doc.detailChannel] = (detailMap[ch][doc.detailChannel] || 0) + 1;
    }
    if (ops >= 450) { await batch.commit(); batch = db.batch(); ops = 0; }
  }
  if (ops > 0) await batch.commit();

  // Tulis dokumen agregat detailChannel (timpa penuh → tak ada sisa drift).
  const [metaCol, metaDoc] = STUDENTS_META_DOC.split("/");
  await db.collection(metaCol).doc(metaDoc).set(detailMap, { merge: false });

  // Hapus dokumen index yatim (uid yang tak lagi siswa valid).
  const existing = await db.collection(STUDENTS_INDEX).get();
  let delBatch = db.batch();
  let delOps = 0;
  let deleted = 0;
  for (const d of existing.docs) {
    if (!wantedUids.has(d.id)) {
      delBatch.delete(d.ref);
      delOps++; deleted++;
      if (delOps >= 450) { await delBatch.commit(); delBatch = db.batch(); delOps = 0; }
    }
  }
  if (delOps > 0) await delBatch.commit();

  // Reset cache ringkasan agar langsung mencerminkan hasil rebuild.
  _summaryCache = null;

  return { written, deleted, total: rows.length };
}
