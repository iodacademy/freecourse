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
  usia?: "18-23" | "24-29" | ">29" | null;
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
  statusKuis: "LULUS" | "TIDAK LULUS" | "-"; // status kelulusan kuis
  nilaiQuiz: string;
  nilaiSurvei1: string;
  feedbackMateri: string;
  nilaiSurvei2: string;
  linkSertifikat: string | null;
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
  rerata: number; // 0-100
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
  return ">29";
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

// ─── Main aggregator ────────────────────────────────────────────────────────

export async function aggregateDashboard(
  filter: DashboardFilter = {},
  options: { includeStudents?: boolean; exportOnlyCertified?: boolean } = {}
): Promise<DashboardResult> {
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
    const userId = data.userId || data.email || d.id;
    const prev = enrollmentByUser.get(userId);
    if (!prev || ts > prev._ts) {
      enrollmentByUser.set(userId, { id: d.id, ...data, _ts: ts });
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

  // Helper: convert Firestore timestamp ke Date
  const tsToDate = (t: any): Date | null => {
    if (!t) return null;
    if (t instanceof Date) return t;
    if (typeof t.toDate === "function") return t.toDate();
    return new Date(t);
  };

  // Build student rows
  type FullStudent = DashboardStudent & {
    // raw values untuk agregasi
    _gender: string;
    _disabilitas: string;
    _kota: string;
    _ageBucket: string | null;
    _channel: string; // raw enrollments.channelSource
    _quizScore: number | null;
    _survey1Rating: number | null;
    _survey2Rating: number | null;
    _minatArray: string[];
    _createdAt: Date | null;
    _linkSertifikat: string | null;
  };

  const allStudents: FullStudent[] = [];

  for (const [email, u] of userByEmail) {
    const enr = enrollmentByUser.get(u.uid) || enrollmentByUser.get(email) || null;
    const profileData: any = u.profileData || {};

    // Tanggal Daftar — pakai createdAt user
    const createdAt = tsToDate(u.createdAt);
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
    if (rawChannel === "beasiswa" || rawChannel === "workshop") {
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

    const ageBucket = ageToBucket(umur);

    allStudents.push({
      tanggalDaftar,
      persetujuan,
      channel,
      detailChannel,
      email: u.email,
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
      statusKuis,
      nilaiQuiz: quizScore != null ? String(quizScore) : "-",
      nilaiSurvei1: rawSurvey1 != null ? String(rawSurvey1) : "-",
      feedbackMateri: rawFeedback != null ? String(rawFeedback) : "-",
      nilaiSurvei2: rawSurvey2 != null ? String(rawSurvey2) : "-",
      linkSertifikat: enr?.certificateDriveUrl || null,
      
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
      _survey1Rating: parseRating(rawSurvey1),
      _survey2Rating: parseRating(rawSurvey2),
      _minatArray: minatArray,
      _createdAt: createdAt,
      _linkSertifikat: enr?.certificateDriveUrl || null,
    });
  }

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
    // Source bisa = eventId (b2c/workshop), partnerCode (kemitraan), atau channel key
    filtered = filtered.filter((s) => {
      // Match by channel
      if (s._channel === filter.source) return true;
      // Match by eventId (cek di original enrollment via userByEmail not available here, simplified)
      // Untuk simplicity, kita allow filter source = nama detail channel
      // Atau bisa di-tweak nanti
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
    ? Math.round(quizScores.reduce((a, b) => a + b, 0) / quizScores.length)
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
  const usiaCount: Record<string, number> = { "18-23": 0, "24-29": 0, ">29": 0 };
  for (const s of certifiedFiltered) {
    if (s._ageBucket) usiaCount[s._ageBucket]++;
  }
  const usia: Array<[string, number]> = [
    ["18-23", usiaCount["18-23"]],
    ["24-29", usiaCount["24-29"]],
    [">29", usiaCount[">29"]],
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
  // Export HANYA peserta yang sudah tersertifikasi JIKA flag exportOnlyCertified diset true
  const sourceArray = options.exportOnlyCertified ? certifiedFiltered : filtered;
  
  // Sort sourceArray by _createdAt (oldest to newest)
  sourceArray.sort((a, b) => {
    const timeA = a._createdAt ? a._createdAt.getTime() : 0;
    const timeB = b._createdAt ? b._createdAt.getTime() : 0;
    return timeA - timeB;
  });

  const students: DashboardStudent[] = options.includeStudents
    ? sourceArray.map((s) => {
        const { _gender, _disabilitas, _kota, _ageBucket, _channel, _quizScore,
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
  "Status Kuis",
  "Nilai Quiz",
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
    s.statusKuis,
    s.nilaiQuiz,
    s.nilaiSurvei1,
    s.feedbackMateri,
    s.nilaiSurvei2,
    s.linkSertifikat || "-",
  ];
}
