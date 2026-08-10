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

  if (!raw) {
    // Dokumen lama menyimpan detail workshop-nya sebagai field datar di akar.
    // Untuk kasus lain (mis. `programs` menyebut program yang detailnya belum
    // ditulis) hanya judul event yang bisa dipercaya.
    //
    // Legacy documents keep their workshop detail as flat root fields. For any
    // other case (e.g. `programs` lists a program whose detail was never
    // written) only the event title can be trusted.
    const isLegacy = !Array.isArray(data?.programs);
    if (isLegacy && program === "workshop") return { program, detail: legacyDetail(data) };
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
