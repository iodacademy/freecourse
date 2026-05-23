"use client";

import { useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
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
}

export default function ProfileDrawer({ open, onClose }: ProfileDrawerProps) {
  const router = useRouter();
  const { user, profile } = useAuth();

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

  // Extract data from Firestore profile or fallback to user
  const namaLengkap = profile?.displayName || user?.displayName || "Pengguna";
  const email = profile?.email || user?.email || "Tidak ada email";
  const photoURL = profile?.photoURL || user?.photoURL || null;
  const partnerCode = profile?.partnerCode || null;
  const profileData = profile?.profileData || {};

  const jenisKelamin = profileData.jenis_kelamin || "—";
  const tanggalLahir = (Array.isArray(profileData.tanggal_lahir) ? profileData.tanggal_lahir[0] : profileData.tanggal_lahir) || "";
  const whatsapp = profileData.nomor_whatsapp || "—";
  const asalDaerah = typeof profileData.asal_daerah === "object" && profileData.asal_daerah !== null ? profileData.asal_daerah as { province?: string; city?: string } : null;
  const provinsi = asalDaerah?.province || (typeof profileData.asal_daerah === "string" ? profileData.asal_daerah : "—");
  const kota = asalDaerah?.city || "—";
  const disabilitas = profileData.disabilitas || "—";
  // The disabilitas options from dynamic forms might be different, just handle "Ya" vs "Tidak"
  // For disabKategori, currently profileData might not have it as an array if it wasn't requested, we will skip it or use a default if it's there
  
  const initials = getInitials(namaLengkap);

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
            {photoURL ? (
              <Image src={photoURL} alt="Avatar" width={80} height={80} style={{ borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
              <div className={styles.avInitials}>{initials}</div>
            )}
            <div className={styles.avOnline} />
          </div>
        </div>

        {/* Body */}
        <div className={styles.body}>
          <div className={styles.profName}>{namaLengkap}</div>
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
              { icon: "user", label: "Nama Lengkap", val: namaLengkap },
              { icon: "gender", label: "Jenis Kelamin", val: jenisKelamin },
              { icon: "cal", label: "Tanggal Lahir", val: getAge(tanggalLahir) },
              { icon: "mail", label: "Email", val: email },
              { icon: "phone", label: "WhatsApp / Telepon", val: whatsapp },
            ].map(({ label, val }) => (
              <div key={label} className={styles.infoRow}>
                <div>
                  <div className={styles.infoLbl}>{label}</div>
                  <div className={styles.infoVal}>{val || "—"}</div>
                </div>
              </div>
            ))}
            {partnerCode && (
              <div className={styles.infoRow}>
                <div>
                  <div className={styles.infoLbl}>Kode Mitra</div>
                  <div className={styles.infoVal} style={{ fontFamily: "monospace", fontWeight: "bold", background: "#f0f4f8", padding: "2px 6px", borderRadius: "4px", color: "#10507a" }}>{partnerCode}</div>
                </div>
              </div>
            )}
          </div>

          {/* Asal Daerah */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Asal Daerah</div>
            <div className={styles.infoRow}>
              <div>
                <div className={styles.infoLbl}>Provinsi</div>
                <div className={styles.infoVal}>{provinsi}</div>
              </div>
            </div>
            <div className={styles.infoRow}>
              <div>
                <div className={styles.infoLbl}>Kota / Kabupaten</div>
                <div className={styles.infoVal}>{kota}</div>
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
                  {disabilitas === "Tidak" || disabilitas === "Bukan Penyandang Disabilitas" ? (
                    <span className={styles.badgeNo}>✓ Bukan Penyandang Disabilitas</span>
                  ) : disabilitas === "Ya" || disabilitas === "Penyandang Disabilitas" ? (
                    <>
                      <span className={styles.badgeYes}>⚡ Penyandang Disabilitas</span>
                    </>
                  ) : <span>{disabilitas}</span>}
                </div>
              </div>
            </div>
          </div>

          <button 
            className={styles.editBtn} 
            onClick={() => {
              onClose();
              router.push("/profile?edit=true");
            }}
          >
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
