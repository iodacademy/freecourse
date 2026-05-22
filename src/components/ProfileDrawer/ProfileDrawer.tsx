"use client";

import { useEffect } from "react";
import styles from "./ProfileDrawer.module.css";

// Dummy profile data — will be replaced by Firestore data later
const DUMMY_PROFILE = {
  namaLengkap: "Ahmad Farhan Rizaldi",
  jenisKelamin: "Laki-laki",
  tanggalLahir: "2000-05-15",
  email: "ahmad.farhan@gmail.com",
  whatsapp: "08123456789",
  provinsi: "Jawa Barat",
  kota: "Kota Bandung",
  disabilitas: "Tidak",
  disabKategori: [] as string[],
  kursusSelesai: 2,
  rataScore: 82,
  sertifikat: 1,
  progress: 67,
};

function getInitials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0] || "").join("").toUpperCase();
}

function getAge(ttlStr: string): string {
  if (!ttlStr) return "—";
  const d = new Date(ttlStr + "T00:00:00");
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  if (today.getMonth() < d.getMonth() || (today.getMonth() === d.getMonth() && today.getDate() < d.getDate())) age--;
  const formatted = d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  return `${formatted} (${age} tahun)`;
}

interface ProfileDrawerProps {
  open: boolean;
  onClose: () => void;
  // In future these will come from Firestore; for now use dummy
  displayName?: string;
  email?: string;
  photoURL?: string;
}

export default function ProfileDrawer({ open, onClose, displayName, email, photoURL }: ProfileDrawerProps) {
  // Close on Escape
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // Lock body scroll when open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const profile = {
    ...DUMMY_PROFILE,
    namaLengkap: displayName || DUMMY_PROFILE.namaLengkap,
    email: email || DUMMY_PROFILE.email,
  };

  const initials = getInitials(profile.namaLengkap);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`${styles.backdrop} ${open ? styles.backdropOpen : ""}`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div className={`${styles.drawer} ${open ? styles.drawerOpen : ""}`}>
        {/* Cover Banner */}
        <div className={styles.cover}>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Tutup">
            <svg viewBox="0 0 24 24" fill="none" strokeWidth="2.5" stroke="white">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
          <div className={styles.avWrap}>
            <div className={styles.avInitials}>{initials}</div>
            <div className={styles.avOnline} />
          </div>
        </div>

        {/* Body */}
        <div className={styles.body}>
          <div className={styles.profName}>{profile.namaLengkap}</div>
          <div style={{ marginBottom: 6 }}>
            <span className={styles.roleBadge}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <rect x="2" y="7" width="20" height="14" rx="2" />
                <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
              </svg>
              Peserta Modul
            </span>
          </div>
          <div className={styles.onlinePill}>
            <div className={styles.onlineDot} />
            Online Sekarang
          </div>

          {/* Data Diri */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Data Diri</div>
            {[
              { icon: "user", label: "Nama Lengkap", val: profile.namaLengkap },
              { icon: "gender", label: "Jenis Kelamin", val: profile.jenisKelamin },
              { icon: "cal", label: "Tanggal Lahir", val: getAge(profile.tanggalLahir) },
              { icon: "mail", label: "Email", val: profile.email },
              { icon: "phone", label: "WhatsApp / Telepon", val: profile.whatsapp },
            ].map(({ label, val }) => (
              <div key={label} className={styles.infoRow}>
                <div>
                  <div className={styles.infoLbl}>{label}</div>
                  <div className={styles.infoVal}>{val || "—"}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Asal Daerah */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Asal Daerah</div>
            <div className={styles.infoRow}>
              <div>
                <div className={styles.infoLbl}>Provinsi</div>
                <div className={styles.infoVal}>{profile.provinsi || "—"}</div>
              </div>
            </div>
            <div className={styles.infoRow}>
              <div>
                <div className={styles.infoLbl}>Kota / Kabupaten</div>
                <div className={styles.infoVal}>{profile.kota || "—"}</div>
              </div>
            </div>
          </div>

          {/* Status Disabilitas */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Status Disabilitas</div>
            <div className={styles.infoRow}>
              <div>
                <div className={styles.infoLbl}>Penyandang Disabilitas</div>
                <div style={{ marginTop: 4 }}>
                  {profile.disabilitas === "Tidak" ? (
                    <span className={styles.badgeNo}>✓ Bukan Penyandang Disabilitas</span>
                  ) : profile.disabilitas === "Ya" ? (
                    <>
                      <span className={styles.badgeYes}>⚡ Penyandang Disabilitas</span>
                      {profile.disabKategori.map((k) => (
                        <span key={k} className={styles.disabCat}>{k}</span>
                      ))}
                    </>
                  ) : <span>—</span>}
                </div>
              </div>
            </div>
          </div>

          <button className={styles.editBtn} onClick={() => alert("Fitur edit profil segera hadir!")}>
            <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" stroke="currentColor" width="16" height="16">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            Edit Profil
          </button>
        </div>
      </div>
    </>
  );
}
