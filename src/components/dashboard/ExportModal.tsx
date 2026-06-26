"use client";

import { useState } from "react";
import { Download, Sparkles, Database, AlertTriangle, Loader2 } from "lucide-react";
import Modal from "@/components/Modal";
import styles from "./exportModal.module.css";

export type ExportMode = "clean" | "raw" | "mismatch";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** Lakukan download untuk mode terpilih. Modal menampilkan loading hingga promise selesai. */
  onExport: (mode: ExportMode) => Promise<void>;
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
    desc: "Hanya peserta Tersertifikasi, usia maks. 29 tahun, dan domisili Jabodetabek.",
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
    desc: "Peserta Selesai/Tersertifikasi yang di luar Jabodetabek atau berusia di atas 29 tahun.",
    icon: <AlertTriangle size={20} strokeWidth={1.75} />,
  },
];

export default function ExportModal({ isOpen, onClose, onExport }: Props) {
  const [busy, setBusy] = useState<ExportMode | null>(null);

  async function handlePick(mode: ExportMode) {
    if (busy) return;
    setBusy(mode);
    try {
      await onExport(mode);
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      alert("Gagal export: " + msg);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={busy ? () => {} : onClose}
      title="Export Data"
      size="md"
    >
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
      {busy && (
        <p className={styles.hint}>Menyiapkan file, mohon tunggu…</p>
      )}
    </Modal>
  );
}
