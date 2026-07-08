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
import { getAdminDb } from "./firebase-admin";
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
  if (enr.certificateClaimed) return "Tersertifikasi";
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
    kemitraan: "Mitra",
    workshop: "Workshop",
  };
  const channel = channelLabel[rawChannel] || rawChannel;
  let detailChannel = "-";
  // Prioritaskan detailChannel yang tersimpan langsung di data (mis. peserta
  // standalone/Meta yang ditandai "All Beasiswa - Facebook Instant Forms").
  const storedDetail = ((enr as any)?.detailChannel || (u as any).detailChannel || "").toString().trim();
  if (storedDetail) {
    detailChannel = storedDetail;
  } else if (rawChannel === "beasiswa" || rawChannel === "workshop") {
    const evId = enr?.eventId || u.eventId;
    if (evId) {
      detailChannel = eventsById.get(evId)?.name || "-";
    }
  } else if (rawChannel === "kemitraan") {
    const code = u.partnerCode || "";
    if (code) detailChannel = partnerByCode.get(code)?.partnerName || "-";
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

  const disabilitas =
    getProfileString(profileData, "disabilitas") ||
    getProfileString(profileData, "isDisabilitas") || "";
  const jenisDisabilitas =
    (disabilitas === "Ya" || disabilitas === "Penyandang Disabilitas")
      ? getProfileString(profileData, "jenis_disabilitas") ||
        getProfileString(profileData, "jenisDisabilitas") ||
        getProfileString(profileData, "kategori_disabilitas_yang_anda_miliki") ||
        getProfileString(profileData, "kategori_disabilitas") ||
        getProfileString(profileData, "kategoriDisabilitas") || "-"
      : "-";

  let minatArray: string[] = [];
  const rawMinatData = profileData?.["jika_diberikan_kesempatan_pelatihan_bidang_apa_yang_paling_anda_minati"];
  if (Array.isArray(rawMinatData)) {
    minatArray = rawMinatData.filter((x) => typeof x === "string" && x.trim());
  } else if (typeof rawMinatData === "string" && rawMinatData.trim() !== "") {
    minatArray = [rawMinatData.trim()];
  } else if (enr?.bonusCourseTopicId) {
    const tName = topicsById.get(enr.bonusCourseTopicId)?.name;
    if (tName) minatArray = [tName];
  }
  const minat = minatArray.length > 0 ? minatArray.join("; ") : "Belum Pilih";

  const status = deriveStatus(enr, totalSteps);

  // Nilai Quiz + statusKuis
  let quizScore: number | null = null;
  let statusKuis: DashboardStudent["statusKuis"] = "-";
  if (quizStepId && enr?.stepProgress) {
    const sp: StepProgress | undefined = enr.stepProgress[quizStepId];
    if (sp?.assessmentResult) {
      // Ambil firstPassScore jika ada, fallback ke score
      quizScore = sp.assessmentResult.firstPassScore ?? sp.assessmentResult.score ?? null;
      if (sp.assessmentResult.passed === true || sp.assessmentResult.firstPassScore != null || (quizScore != null && quizScore >= 60)) {
        statusKuis = "LULUS";
      } else if (sp.assessmentResult.attempts > 0) {
        statusKuis = "TIDAK LULUS";
      }
    }
  }

  // Survey ratings
  function findAnswer(qId: string | null): string | number | null {
    if (!qId || !enr?.stepProgress) return null;
    for (const sp of Object.values(enr.stepProgress as Record<string, StepProgress>)) {
      const sr = sp?.surveyResult as any;
      if (!sr) continue;
      const ans = sr[qId] ?? sr.answers?.[qId];
      if (ans != null && ans !== "") return ans as any;
    }
    return null;
  }

  const rawSurvey1 = findAnswer(survey1.id);
  const rawFeedback = findAnswer(feedback.id);
  const rawSurvey2 = findAnswer(survey2.id);

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

const RAW_TTL_MS = 45_000;
let _rawCache: { data: RawDataset; ts: number } | null = null;
let _rawInflight: Promise<RawDataset> | null = null;

/** Hapus cache — panggil setelah mutasi data admin agar perubahan langsung tampak. */
export function invalidateDashboardCache(): void {
  _rawCache = null;
}

function rebuildRawDataset(): Promise<RawDataset> {
  if (_rawInflight) return _rawInflight;
  _rawInflight = buildRawDataset()
    .then((data) => {
      _rawCache = { data, ts: Date.now() };
      return data;
    })
    .finally(() => {
      _rawInflight = null;
    });
  return _rawInflight;
}

/**
 * Ambil dataset mentah dengan pola stale-while-revalidate:
 * - bypass=true → rebuild & tunggu (tombol Refresh).
 * - ada cache & masih segar → kembalikan cache.
 * - ada cache & basi → kembalikan cache (stale) lalu rebuild di background.
 * - belum ada cache (cold) → tunggu rebuild.
 */
async function getRawDatasetCached(bypass = false): Promise<RawDataset> {
  if (bypass) return rebuildRawDataset();
  if (_rawCache) {
    const age = Date.now() - _rawCache.ts;
    if (age > RAW_TTL_MS && !_rawInflight) {
      // refresh background — jangan await, error tidak menghapus cache lama
      rebuildRawDataset().catch((e) => console.error("[Dashboard] background rebuild gagal:", e));
    }
    return _rawCache.data;
  }
  return rebuildRawDataset();
}

// ─── Main aggregator ────────────────────────────────────────────────────────

export async function aggregateDashboard(
  filter: DashboardFilter = {},
  options: { includeStudents?: boolean; exportOnlyCertified?: boolean; cleanExport?: boolean; rawExport?: boolean; mismatchExport?: boolean; bypassCache?: boolean } = {}
): Promise<DashboardResult> {
  const raw = await getRawDatasetCached(options.bypassCache);
  return applyFiltersAndAggregate(raw, filter, options);
}

// ─── Build dataset mentah (mahal: fetch semua collection + bangun students) ──

async function buildRawDataset(): Promise<RawDataset> {
  const db = getAdminDb();

  // Fetch paralel — semua collection sekali jalan
  const [
    usersSnap,
    enrollmentsSnap,
    coursesSnap,
    eventsSnap,
    partnerCodesSnap,
    bonusTopicsSnap,
    settingsDoc,
  ] = await Promise.all([
    db.collection("users").get(),
    db.collection("enrollments").get(),
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

  // Fetch steps untuk main course (koleksi root "courseSteps")
  let mainSteps: CourseStep[] = [];
  if (mainCourseDoc) {
    const stepsSnap = await db
      .collection("courseSteps")
      .where("courseId", "==", mainCourseDoc.id)
      .get();
      
    mainSteps = stepsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
    // Sort in memory
    mainSteps.sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  const totalSteps = mainSteps.length;

  // Build mapping (Approach 1 admin, fallback Approach 2 text-match)
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
      // Cari di mainSteps
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

// ─── Filter + agregasi + paginate (murah, per request) ──────────────────────

function applyFiltersAndAggregate(
  raw: RawDataset,
  filter: DashboardFilter = {},
  options: { includeStudents?: boolean; exportOnlyCertified?: boolean; cleanExport?: boolean; rawExport?: boolean; mismatchExport?: boolean } = {}
): DashboardResult {
  const { allStudents, totalSteps, targets, quizStepId, quizStepTitle, survey1, feedback, survey2 } = raw;

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

  // ─── Agregasi ─────────────────────────────────────────────────────────────

  // Ambil hanya yang tersertifikasi (Completion) untuk metrik dashboard utama
  const certifiedFiltered = filtered.filter((s) => s.status === "Tersertifikasi");

  const total = certifiedFiltered.length;
  const totalCompleted = filtered.length;
  
  const perempuanFiltered = filtered.filter((s) => s._gender === "Perempuan");
  const perempuan = perempuanFiltered.filter((s) => s.status === "Tersertifikasi").length;
  const perempuanCompleted = perempuanFiltered.length;
  
  const disabilitasFiltered = filtered.filter((s) => s._disabilitas === "Ya" || s._disabilitas === "Penyandang Disabilitas");
  const disabilitas = disabilitasFiltered.filter((s) => s.status === "Tersertifikasi").length;
  const disabilitasCompleted = disabilitasFiltered.length;

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
  for (const s of certifiedFiltered) {
    if (s._ageBucket) usiaCount[s._ageBucket]++;
  }
  const usia: Array<[string, number]> = [
    ["18-23", usiaCount["18-23"]],
    ["24-29", usiaCount["24-29"]],
    ["30+", usiaCount["30+"]],
  ];

  // Channel breakdown — pakai ALL students (sebelum filter) supaya bisa lihat distribusi global
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
        label: ({ umum: "Umum", beasiswa: "Beasiswa", kemitraan: "Mitra", workshop: "Workshop" } as any)[ch],
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
  };

  // Strip internal fields kalau includeStudents
  // Pilih sumber baris export:
  //  - rawExport / mismatchExport → semua peserta yang sudah menyelesaikan kursus
  //    (Selesai + Tersertifikasi). raw ambil semua; mismatch disaring komplemen Clean.
  //  - exportOnlyCertified → hanya yang Tersertifikasi (dipakai export Clean).
  //  - selain itu → seluruh hasil filter.
  const jabodetabek = ["jakarta", "bogor", "depok", "tangerang", "bekasi"];
  const isJabodetabekCity = (s: FullStudent) => {
    const kota = (s._kota || "").toLowerCase();
    return jabodetabek.some((k) => kota.includes(k));
  };
  // Peserta dianggap "sesuai" (Clean) jika usia ≤29 DAN domisili Jabodetabek.
  const isCleanEligible = (s: FullStudent) => s._ageBucket !== "30+" && isJabodetabekCity(s);

  let sourceArray =
    options.rawExport || options.mismatchExport
      ? filtered.filter((s) => s.status === "Selesai" || s.status === "Tersertifikasi")
      : options.exportOnlyCertified
      ? certifiedFiltered
      : filtered;

  if (options.mismatchExport) {
    // Data Tidak Sesuai: non-Jabodetabek ATAU usia >29 (komplemen dari Clean).
    sourceArray = sourceArray.filter((s) => !isCleanEligible(s));
  } else if (options.cleanExport && !options.rawExport) {
    // Data Clean: usia ≤29 & Jabodetabek.
    sourceArray = sourceArray.filter(isCleanEligible);
  }
  
  // Sort sourceArray by _createdAt (oldest to newest)
  sourceArray.sort((a, b) => {
    const timeA = a._createdAt ? a._createdAt.getTime() : 0;
    const timeB = b._createdAt ? b._createdAt.getTime() : 0;
    return timeA - timeB;
  });

  const students: DashboardStudent[] = options.includeStudents
    ? sourceArray.map((s) => {
        const { _gender, _disabilitas, _kota, _ageBucket, _channel, _quizScore, _pretestScore,
                _survey1Rating, _survey2Rating, _minatArray, _createdAt, _linkSertifikat, ...pub } = s;
        return pub;
      })
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

// ─── Query siswa untuk halaman /admin/students (server-side filter+paginate) ─

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

function stripInternal(s: FullStudent): DashboardStudent {
  const { _gender, _disabilitas, _kota, _ageBucket, _channel, _quizScore, _pretestScore,
          _survey1Rating, _survey2Rating, _minatArray, _createdAt, _linkSertifikat, ...pub } = s;
  return pub;
}

export async function queryStudents(q: StudentsQuery = {}): Promise<StudentsPage> {
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
