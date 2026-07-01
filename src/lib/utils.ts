export function createSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

// Token gelar/singkatan akademik & honorifik yang wajar (lowercase, tanpa titik).
// Nama bergelar seperti "Haris Darmawan, S.T., M.T." tidak boleh dianggap aneh.
const TITLE_TOKENS = new Set([
  // Gelar akademik
  "st", "se", "sh", "si", "sp", "skom", "spd", "spt", "ssi", "ssos", "skm",
  "sked", "sik", "sfarm", "sgz", "spsi", "sag", "sthi", "shut", "spar", "ssn",
  "mt", "mm", "msi", "mkom", "mpd", "mh", "mba", "msc", "ma", "mkes", "mfarm",
  "dr", "drs", "dra", "ir", "prof", "phd", "amd", "amdkeb", "amdkep",
  // Honorifik
  "h", "hj", "kh", "rr", "r", "raden", "tuan", "nyonya",
]);

export function isSuspiciousName(name: string | null | undefined): boolean {
  if (!name) return true;
  // Normalisasi tanda kutip keriting (’ ‘ ´ `) → apostrof lurus, agar nama
  // seperti "Muhammad Ma’ruf" tidak salah terdeteksi.
  const raw = name.trim().replace(/[‘’ʼ`´]/g, "'");
  const n = raw.toLowerCase();

  // Terlalu pendek
  if (n.length < 3) return true;

  // Mengandung angka
  if (/\d/.test(n)) return true;

  // Mengandung kata-kata testing atau kata umum yang tidak valid
  if (/\b(test|coba|asal|asdf|qwer|qwerty)\b/.test(n)) return true;

  // Mengandung karakter berulang 3 kali berturut-turut (misal: aaa)
  if (/(.)\1{2,}/.test(n)) return true;

  // Nama anonim umum
  if (["hamba allah", "nn", "anonim", "user", "admin", "unknown", "tidak ada", "kosong", "nama"].includes(n)) return true;

  // Hanya 1 kata dan lebih dari 15 karakter (biasanya ketikan keyboard asal)
  if (!n.includes(" ") && n.length > 15) return true;

  // ── Deteksi tambahan ──

  // Karakter di luar huruf latin + spasi + tanda baca nama yang wajar
  // (titik, koma, tanda hubung, apostrof). Menangkap font unicode aneh
  // (𝓨𝓸𝓶𝓪), emoji, aksara non-latin, simbol. Koma & titik diizinkan agar
  // nama bergelar ("..., S.T., M.T.") tidak salah tuduh.
  if (/[^a-zA-ZÀ-ÿ\s.,'-]/.test(raw)) return true;

  // Mengandung underscore / karakter pemisah tidak wajar (mis. "symll_")
  if (/[_|~^=+*/\\<>{}[\]@#$%]/.test(raw)) return true;

  // Ada "kata" tanpa huruf vokal sama sekali & panjang ≥4 (mis. "xkzq", "symll")
  // — indikasi ketikan keyboard asal. Token gelar (S.T., M.T., dll) dilewati.
  const words = n.split(/[\s.,]+/).filter(Boolean);
  for (const w of words) {
    const letters = w.replace(/[^a-zà-ÿ]/g, "");
    if (TITLE_TOKENS.has(letters)) continue;
    if (letters.length >= 4 && !/[aeiouàáâãäåèéêëìíîïòóôõöùúûü]/.test(letters)) return true;
  }

  // Semua kata (di luar token gelar) sangat pendek (≤1 huruf) — mis. "a b c"
  const nameWords = words.filter((w) => !TITLE_TOKENS.has(w.replace(/[^a-zà-ÿ]/g, "")));
  if (nameWords.length > 0 && nameWords.every((w) => w.replace(/[^a-zà-ÿ]/g, "").length <= 1)) return true;

  return false;
}
