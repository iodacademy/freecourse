export function createSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

export function isSuspiciousName(name: string | null | undefined): boolean {
  if (!name) return true;
  const raw = name.trim();
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

  // Karakter di luar huruf latin + spasi/tanda hubung/apostrof/titik yang wajar.
  // Menangkap font unicode aneh (𝓨𝓸𝓶𝓪), emoji, aksara non-latin, simbol.
  // Catatan: huruf beraksen (é, ñ, dll) tetap diperbolehkan via rentang Latin-1.
  if (/[^a-zA-ZÀ-ÿ\s.'-]/.test(raw)) return true;

  // Mengandung underscore / karakter pemisah tidak wajar (mis. "symll_")
  if (/[_|~^`=+*/\\<>{}[\]@#$%]/.test(raw)) return true;

  // Ada "kata" tanpa huruf vokal sama sekali & panjang ≥4 (mis. "xkzq", "symll")
  // — indikasi kuat ketikan keyboard asal.
  const words = n.split(/\s+/).filter(Boolean);
  for (const w of words) {
    const letters = w.replace(/[^a-zà-ÿ]/g, "");
    if (letters.length >= 4 && !/[aeiouàáâãäåèéêëìíîïòóôõöùúûü]/.test(letters)) return true;
  }

  // Semua kata sangat pendek (≤1 huruf) — mis. "a b c"
  if (words.length > 0 && words.every((w) => w.replace(/[^a-zà-ÿ]/g, "").length <= 1)) return true;

  return false;
}
