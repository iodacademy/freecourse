/**
 * Firestore palsu untuk uji aggregator. Tidak menyentuh jaringan/produksi.
 *
 * Bentuk data:
 *   - array  -> koleksi biasa; id diambil dari `id` atau `uid`
 *   - object -> koleksi ber-dokumen bernama, mis. settings: { app: {...} }
 */
// Disimpan di globalThis, bukan variabel modul: loader hook bisa membuat
// lebih dari satu instance modul ini, dan keduanya harus melihat data yang sama.
const KEY = Symbol.for("freecourse.fakeFirestore");

export function setFakeData(d) {
  globalThis[KEY] = d;
}

const data = () => globalThis[KEY] || {};

const mkDoc = (id, data) => ({ id, exists: data != null, data: () => data });

function rowsOf(name) {
  const bag = data()[name];
  if (bag == null) return [];
  if (Array.isArray(bag)) return bag.map((r) => mkDoc(r.id ?? r.uid, r));
  return Object.entries(bag).map(([id, r]) => mkDoc(id, r));
}

const snap = (docs) => ({ docs, size: docs.length });

function makeQuery(docs) {
  return {
    where(field, op, val) {
      if (op !== "==") throw new Error("stub hanya mendukung operator ==");
      return makeQuery(docs.filter((d) => d.data()?.[field] === val));
    },
    get: async () => snap(docs),
  };
}

export function getAdminDb() {
  return {
    collection(name) {
      const docs = rowsOf(name);
      return {
        ...makeQuery(docs),
        doc(id) {
          const found = docs.find((d) => d.id === id);
          return { get: async () => found ?? mkDoc(id, undefined) };
        },
      };
    },
  };
}

export function getAdminAuth() {
  throw new Error("getAdminAuth tidak dipakai di uji ini");
}
export function getAdminStorage() {
  throw new Error("getAdminStorage tidak dipakai di uji ini");
}
