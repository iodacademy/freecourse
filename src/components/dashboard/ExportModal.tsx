"use client";

import { useState } from "react";
import { Download, Sparkles, Database, AlertTriangle, Loader2, ArrowLeft } from "lucide-react";
import Modal from "@/components/Modal";
import { AREAS, type AreaKey } from "@/lib/regions";
import styles from "./exportModal.module.css";

export type ExportMode = "clean" | "raw" | "mismatch";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /**
   * Lakukan download untuk mode terpilih. Modal menampilkan loading hingga
   * promise selesai. `areas` hanya terisi untuk mode "clean"; `undefined`
   * berarti seluruh area.
   */
  onExport: (mode: ExportMode, areas?: AreaKey[]) => Promise<void>;
  /**
   * Tampilkan pemilihan area untuk mode Clean. Dashboard publik memakai
   * modal yang sama tanpa fitur ini.
   */
  allowAreaSelect?: boolean;
}

const OPTIONS: Array<{
  mode: ExportMode;
  title: string;
  desc: string;
  icon: React.ReactNode;
}> = [
  {
    mode: "clean",
    title: "Data Clean",
    desc: "Hanya peserta Tersertifikasi di area program, usia maks. 29 tahun (35 tahun untuk penyandang disabilitas).",
    icon: <Sparkles size={20} strokeWidth={1.75} />,
  },
  {
    mode: "raw",
    title: "Data Raw",
    desc: "Semua peserta yang Selesai/Tersertifikasi — seluruh daerah & seluruh usia (termasuk 30+).",
    icon: <Database size={20} strokeWidth={1.75} />,
  },
  {
    mode: "mismatch",
    title: "Data Tidak Sesuai",
    desc: "Peserta Selesai/Tersertifikasi yang di luar area program atau usianya melewati batas.",
    icon: <AlertTriangle size={20} strokeWidth={1.75} />,
  },
];

const ALL_AREAS: AreaKey[] = AREAS.map((a) => a.key);

/**
 * Isi modal dipisah supaya bisa di-*remount* lewat `key={String(isOpen)}`.
 * Dengan begitu state langkah & centang area otomatis kembali ke awal tiap
 * modal dibuka — tanpa perlu useEffect yang menyetel state.
 */
function ExportModalBody({ isOpen, onClose, onExport, allowAreaSelect }: Props) {
  const [busy, setBusy] = useState<ExportMode | null>(null);
  // false = langkah pilih mode. true = langkah pilih area (khusus Clean).
  const [pickingAreas, setPickingAreas] = useState(false);
  const [selected, setSelected] = useState<AreaKey[]>(ALL_AREAS);

  async function runExport(mode: ExportMode, areas?: AreaKey[]) {
    if (busy) return;
    setBusy(mode);
    try {
      await onExport(mode, areas);
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      alert("Gagal export: " + msg);
    } finally {
      setBusy(null);
    }
  }

  function handlePick(mode: ExportMode) {
    if (busy) return;
    // Clean + pemilihan area aktif → masuk langkah 2 dulu.
    if (mode === "clean" && allowAreaSelect) {
      setPickingAreas(true);
      return;
    }
    void runExport(mode);
  }

  function toggleArea(key: AreaKey) {
    setSelected((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  const allSelected = selected.length === ALL_AREAS.length;
  const loadingClean = busy === "clean";

  return (
    <Modal
      isOpen={isOpen}
      onClose={busy ? () => {} : onClose}
      title={pickingAreas ? "Export Data Clean" : "Export Data"}
      size="md"
    >
      {!pickingAreas ? (
        <>
          <p className={styles.lead}>Pilih jenis data yang ingin diunduh:</p>
          <div className={styles.options}>
            {OPTIONS.map((opt) => {
              const loading = busy === opt.mode;
              const disabled = busy != null && !loading;
              return (
                <button
                  key={opt.mode}
                  type="button"
                  className={styles.card}
                  onClick={() => handlePick(opt.mode)}
                  disabled={busy != null}
                  data-loading={loading || undefined}
                  data-dim={disabled || undefined}
                >
                  <span className={styles.cardIcon}>{opt.icon}</span>
                  <span className={styles.cardBody}>
                    <span className={styles.cardTitle}>{opt.title}</span>
                    <span className={styles.cardDesc}>{opt.desc}</span>
                  </span>
                  <span className={styles.cardAction}>
                    {loading ? (
                      <Loader2 size={18} className={styles.spin} />
                    ) : (
                      <Download size={18} />
                    )}
                  </span>
                </button>
              );
            })}
          </div>
          {busy && <p className={styles.hint}>Menyiapkan file, mohon tunggu…</p>}
        </>
      ) : (
        <div className={styles.step2}>
          <button
            type="button"
            className={styles.backBtn}
            onClick={() => setPickingAreas(false)}
            disabled={busy != null}
          >
            <ArrowLeft size={14} />
            Kembali
          </button>

          <p className={styles.lead}>
            Centang daerah yang ingin disertakan. Hanya peserta Tersertifikasi
            dengan usia yang memenuhi syarat yang akan diunduh.
          </p>

          <div className={styles.areaList}>
            {AREAS.map((area) => {
              const on = selected.includes(area.key);
              return (
                <label
                  key={area.key}
                  className={[styles.areaOption, on ? styles.areaOptionOn : ""]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => toggleArea(area.key)}
                    disabled={busy != null}
                  />
                  <span className={styles.areaOptionBody}>
                    <span className={styles.areaOptionTitle}>{area.label}</span>
                    <span className={styles.areaOptionDesc}>{area.desc}</span>
                  </span>
                </label>
              );
            })}
          </div>

          <div className={styles.step2Foot}>
            {selected.length === 0 ? (
              <p className={styles.warn}>Pilih minimal satu daerah.</p>
            ) : (
              <span className={styles.areaOptionDesc}>
                {allSelected
                  ? "Semua area program disertakan."
                  : `${selected.length} dari ${ALL_AREAS.length} area dipilih.`}
              </span>
            )}
            <button
              type="button"
              className={styles.downloadBtn}
              disabled={selected.length === 0 || busy != null}
              onClick={() =>
                // Semua area tercentang → kirim undefined agar URL tetap bersih.
                void runExport("clean", allSelected ? undefined : selected)
              }
            >
              {loadingClean ? (
                <>
                  <Loader2 size={16} className={styles.spin} />
                  Menyiapkan…
                </>
              ) : (
                <>
                  <Download size={16} />
                  Unduh
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

export default function ExportModal(props: Props) {
  // `key` berubah tiap modal dibuka/ditutup → body remount dengan state awal.
  return <ExportModalBody key={String(props.isOpen)} {...props} />;
}
