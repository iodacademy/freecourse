/**
 * Aturan program sertifikat kehadiran (Bootcamp / Workshop).
 *
 * Satu-satunya tempat kompatibilitas event lama ditangani: dokumen lama tidak
 * punya `programs` maupun `detail`, detailnya tersimpan sebagai field datar di
 * akar dokumen. Semua pembaca harus lewat sini agar link lama tetap hidup.
 *
 * Certificate-of-attendance program rules (Bootcamp / Workshop).
 *
 * The single place legacy-event compatibility is handled: old documents have
 * neither `programs` nor `detail`, their details sit as flat root fields.
 * Every reader must go through here so old links keep working.
 */

export type CertProgram = "bootcamp" | "workshop";

export const CERT_PROGRAMS: readonly CertProgram[] = ["bootcamp", "workshop"];

export const PROGRAM_LABELS: Record<CertProgram, string> = {
  bootcamp: "Bootcamp",
  workshop: "Workshop",
};

export interface ProgramDetail {
  title: string;
  date: string;
  day: string;
  time: string;
  speakerName: string;
  speakerTitle: string;
  templateId: string;
  claimCount: number;
}

type EventData = Record<string, unknown>;

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

export function isCertProgram(v: unknown): v is CertProgram {
  return v === "bootcamp" || v === "workshop";
}

/**
 * Daftar program sebuah event, selalu berurutan sesuai CERT_PROGRAMS.
 * Dokumen tanpa `programs` yang sah dianggap event workshop lama.
 *
 * An event's programs, always ordered as in CERT_PROGRAMS.
 * A document without a valid `programs` is treated as a legacy workshop event.
 */
export function listPrograms(data: EventData): CertProgram[] {
  const raw = data?.programs;
  if (Array.isArray(raw)) {
    const found = CERT_PROGRAMS.filter((p) => raw.includes(p));
    if (found.length > 0) return found;
  }
  return ["workshop"];
}

/** Susun detail workshop dari field datar milik dokumen lama. / Build workshop detail from a legacy document's flat fields. */
function legacyDetail(data: EventData): ProgramDetail {
  return {
    title: str(data?.title),
    date: str(data?.workshopDate),
    day: str(data?.workshopDay),
    time: str(data?.workshopTime),
    speakerName: str(data?.speakerName),
    speakerTitle: str(data?.speakerTitle),
    // Kosong berarti pemanggil jatuh ke template global di Settings.
    // Empty means the caller falls back to the global template in Settings.
    templateId: "",
    claimCount: num(data?.claimCount),
  };
}

/**
 * Pilih program dan detailnya. Mengembalikan null bila program yang diminta
 * tidak tersedia pada event ini — pemanggil menjawab 400, bukan menebak.
 * Tanpa `requested`, program pertama dipakai agar klien lama tetap dilayani.
 *
 * Pick a program and its detail. Returns null when the requested program is
 * not available on this event — the caller answers 400 rather than guessing.
 * Without `requested`, the first program is used so old clients still work.
 */
export function resolveProgram(
  data: EventData,
  requested?: string,
): { program: CertProgram; detail: ProgramDetail } | null {
  const available = listPrograms(data);

  let program: CertProgram;
  if (requested) {
    if (!isCertProgram(requested) || !available.includes(requested)) return null;
    program = requested;
  } else {
    program = available[0];
  }

  const detailMap = (data?.detail ?? {}) as Record<string, unknown>;
  const raw = detailMap[program] as Record<string, unknown> | undefined;

  // Kelegasian ditentukan oleh BENTUK dokumen (tak ada `programs` yang sah),
  // bukan oleh ada-tidaknya `raw` — sebab rute klaim menulis
  // `detail.workshop.claimCount` lewat dotted-path update, yang membuat
  // Firestore memunculkan stub map itu pada dokumen lama begitu diklaim
  // sekali. Kalau kelegasian dites lewat `!raw`, klaim kedua akan lolos ke
  // cabang di bawah dan mengembalikan sertifikat kosong.
  //
  // Legacy-ness is decided by the document's SHAPE (no valid `programs`),
  // not by whether `raw` happens to exist — because the claim route writes
  // `detail.workshop.claimCount` via a dotted-path update, which makes
  // Firestore materialise that stub map on a legacy document as soon as it's
  // claimed once. If legacy-ness were tested via `!raw`, the second claim
  // would fall through to the branch below and return a blank certificate.
  const isLegacy = !Array.isArray(data?.programs);
  if (isLegacy && program === "workshop") {
    const legacy = legacyDetail(data);
    // Stub sudah ada -> claimCount per-program itu yang benar, bukan total
    // dokumen dari legacyDetail(). Stub exists -> that per-program count is
    // correct, not legacyDetail()'s document total.
    if (raw) return { program, detail: { ...legacy, claimCount: num(raw.claimCount) } };
    return { program, detail: legacy };
  }

  if (!raw) {
    return {
      program,
      detail: {
        title: str(data?.title), date: "", day: "", time: "",
        speakerName: "", speakerTitle: "", templateId: "", claimCount: 0,
      },
    };
  }

  return {
    program,
    detail: {
      title: str(raw.title) || str(data?.title),
      date: str(raw.date),
      day: str(raw.day),
      time: str(raw.time),
      speakerName: str(raw.speakerName),
      speakerTitle: str(raw.speakerTitle),
      templateId: str(raw.templateId),
      claimCount: num(raw.claimCount),
    },
  };
}

/**
 * Susun payload update untuk mengedit sebuah cert event.
 *
 * Bahaya utamanya: form admin tidak membawa `claimCount`, sedangkan dokumen
 * tersimpan sudah punya hitungan klaim yang terkumpul. Menulis `detail` mentah
 * dari form akan menghapusnya. Fungsi ini menambalkan kembali hitungan lama
 * per program, dan sengaja TIDAK menyentuh `slug` (link sudah beredar) maupun
 * total `claimCount` di akar.
 *
 * Build the update payload for editing a cert event.
 *
 * The main hazard: the admin form does not carry `claimCount`, while the
 * stored document already holds accumulated claims. Writing the form's
 * `detail` verbatim would wipe them. This re-attaches each program's existing
 * count, and deliberately leaves `slug` (links are already circulating) and
 * the root `claimCount` total untouched.
 *
 * @returns payload siap `update()`, atau null bila input tak sah.
 */
export function buildEventUpdate(
  stored: EventData,
  form: { title?: unknown; programs?: unknown; detail?: unknown },
): { title: string; programs: CertProgram[]; detail: Record<string, ProgramDetail> } | null {
  const title = str(form?.title).trim();
  if (!title) return null;

  const rawPrograms = Array.isArray(form?.programs) ? form.programs : [];
  const programs = CERT_PROGRAMS.filter((p) => rawPrograms.includes(p));
  if (programs.length === 0) return null;

  const storedDetail = (stored?.detail ?? {}) as Record<string, Record<string, unknown> | undefined>;
  const formDetail = (form?.detail ?? {}) as Record<string, Record<string, unknown> | undefined>;

  const detail: Record<string, ProgramDetail> = {};
  for (const p of programs) {
    const d = formDetail[p] || {};
    detail[p] = {
      title: str(d.title).trim() || title,
      date: str(d.date).trim(),
      day: str(d.day).trim(),
      time: str(d.time).trim(),
      speakerName: str(d.speakerName).trim(),
      speakerTitle: str(d.speakerTitle).trim(),
      templateId: str(d.templateId).trim(),
      claimCount: num(storedDetail[p]?.claimCount),
    };
  }

  return { title, programs, detail };
}
