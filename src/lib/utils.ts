export function createSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

export function isSuspiciousName(name: string | null | undefined): boolean {
  if (!name) return true;
  const n = name.trim().toLowerCase();
  
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
  
  return false;
}
