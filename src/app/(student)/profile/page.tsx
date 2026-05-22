"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/contexts/AuthContext";
import { WILAYAH_INDONESIA } from "@/lib/wilayah";
import styles from "./page.module.css";

const DISABILITY_CATEGORIES = [
  "Disabilitas Fisik",
  "Disabilitas Sensorik Netra",
  "Disabilitas Sensorik Tuli",
  "Disabilitas Sensorik Wicara",
  "Disabilitas Mental",
  "Disabilitas Intelektual",
  "Disabilitas Ganda",
  "Lainnya",
];

function ProfileContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile, updateUserProfile, loading } = useAuth();

  const channelType = searchParams.get("type") || "beasiswa";
  const urlEventId = searchParams.get("eventId") || "";
  const isKemitraan = channelType === "kemitraan" || profile?.channelSource === "b2b_campus";

  const [partnerCode, setPartnerCode] = useState("");
  const [validatingCode, setValidatingCode] = useState(false);
  const [partnerCodeValid, setPartnerCodeValid] = useState(false);
  const [partnerEventId, setPartnerEventId] = useState("");
  
  const [namaLengkap, setNamaLengkap] = useState("");
  const [jenisKelamin, setJenisKelamin] = useState<"Laki-laki" | "Perempuan" | "">("");
  const [tanggalLahir, setTanggalLahir] = useState("");
  const [nomorWA, setNomorWA] = useState("");
  const [provinsi, setProvinsi] = useState("");
  const [kotaKabupaten, setKotaKabupaten] = useState("");
  const [disabilitas, setDisabilitas] = useState<"Ya" | "Tidak" | "">("");
  const [disabilitasKategori, setDisabilitasKategori] = useState<string[]>([]);
  const [disabilitasLainnya, setDisabilitasLainnya] = useState("");

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);

  const userEmail = user?.email || "";
  const kotaList = WILAYAH_INDONESIA.find((w) => w.name === provinsi)?.cities || [];

  // Redirect if not logged in
  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
    // Kalau profil sudah lengkap & sudah punya channel → tidak bisa ganti channel
    if (!loading && user && profile?.profileCompleted && profile?.channelSource) {
      router.push("/learn");
    }
  }, [loading, user, profile, router]);

  // Pre-fill existing data
  useEffect(() => {
    if (profile) {
      if (profile.profileData?.namaLengkap) setNamaLengkap(profile.profileData.namaLengkap as string);
      else if (profile.displayName) setNamaLengkap(profile.displayName);

      if (profile.profileData?.jenisKelamin) setJenisKelamin(profile.profileData.jenisKelamin as any);
      if (profile.profileData?.tanggalLahir) setTanggalLahir(profile.profileData.tanggalLahir as string);
      if (profile.profileData?.nomorWA) setNomorWA(profile.profileData.nomorWA as string);
      if (profile.profileData?.provinsi) setProvinsi(profile.profileData.provinsi as string);
      if (profile.profileData?.kotaKabupaten) setKotaKabupaten(profile.profileData.kotaKabupaten as string);
      if (profile.profileData?.disabilitas) setDisabilitas(profile.profileData.disabilitas as any);
      
      const kat = profile.profileData?.kategoriDisabilitas;
      if (Array.isArray(kat)) setDisabilitasKategori(kat as string[]);
      
      if (profile.profileData?.kategoriDisabilitasLainnya) {
        setDisabilitasLainnya(profile.profileData.kategoriDisabilitasLainnya as string);
      }

      if (profile.partnerCode) {
        setPartnerCode(profile.partnerCode);
        setPartnerCodeValid(true);
      }
    }
    
    // Pre-fill kode mitra dari URL (kalau dari /partner/KAMPUS-X)
    if (isKemitraan && urlEventId && !partnerCode) {
      setPartnerCode(urlEventId);
    }
  }, [profile]);

  useEffect(() => { setKotaKabupaten((prev) => prev ? prev : ""); }, [provinsi]);

  const toggleKategori = (kat: string) => {
    setDisabilitasKategori((prev) =>
      prev.includes(kat) ? prev.filter((k) => k !== kat) : [...prev, kat]
    );
  };

  const validatePartnerCode = async () => {
    if (!partnerCode.trim()) {
      setErrors((p) => ({ ...p, partnerCode: "Kode mitra wajib diisi" }));
      return false;
    }
    
    setValidatingCode(true);
    try {
      const res = await fetch("/api/partner-codes/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: partnerCode })
      });
      const data = await res.json();
      
      if (!data.valid) {
        setErrors((p) => ({ ...p, partnerCode: data.error || "Kode Mitra tidak valid" }));
        setPartnerCodeValid(false);
        return false;
      }
      
      setErrors((p) => { const next = {...p}; delete next.partnerCode; return next; });
      setPartnerCodeValid(true);
      setPartnerEventId(data.eventId);
      return true;
    } catch (e) {
      setErrors((p) => ({ ...p, partnerCode: "Gagal memvalidasi kode mitra" }));
      return false;
    } finally {
      setValidatingCode(false);
    }
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (isKemitraan && !partnerCodeValid && !profile?.partnerCode) errs.partnerCode = "Kode mitra wajib divalidasi";
    if (!namaLengkap.trim()) errs.namaLengkap = "Nama lengkap wajib diisi";
    if (!jenisKelamin) errs.jenisKelamin = "Jenis kelamin wajib dipilih";
    if (!tanggalLahir) errs.tanggalLahir = "Tanggal lahir wajib diisi";
    if (!nomorWA.trim()) errs.nomorWA = "Nomor WhatsApp wajib diisi";
    if (!provinsi) errs.provinsi = "Provinsi wajib dipilih";
    if (!kotaKabupaten) errs.kotaKabupaten = "Kota/Kabupaten wajib dipilih";
    if (!disabilitas) errs.disabilitas = "Status disabilitas wajib dipilih";
    if (disabilitas === "Ya" && disabilitasKategori.length === 0)
      errs.disabilitasKategori = "Pilih minimal satu kategori disabilitas";
    if (disabilitas === "Ya" && disabilitasKategori.includes("Lainnya") && !disabilitasLainnya.trim())
      errs.disabilitasLainnya = "Sebutkan jenis disabilitas lainnya";
    return errs;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      document.querySelector("[data-field-error]")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    
    setSubmitting(true);
    try {
      const channelSource = profile?.channelSource || (
        channelType === "workshop" ? "b2c_workshop" :
        channelType === "kemitraan" ? "b2b_campus" : "b2c_ads"
      );
      
      await updateUserProfile({
        profileCompleted: true,
        channelSource,
        eventId: profile?.eventId || urlEventId || partnerEventId || null,
        partnerCode: isKemitraan ? partnerCode : profile?.partnerCode,
        profileData: {
          namaLengkap, jenisKelamin, tanggalLahir, nomorWA, provinsi, kotaKabupaten, disabilitas,
          kategoriDisabilitas: disabilitas === "Ya" ? disabilitasKategori : [],
          kategoriDisabilitasLainnya: disabilitas === "Ya" && disabilitasKategori.includes("Lainnya") ? disabilitasLainnya : "",
        },
      });
      
      setSaved(true);
      setTimeout(() => {
        router.push("/learn");
      }, 1500);
    } catch {
      setErrors({ submit: "Gagal menyimpan data. Silakan coba lagi." });
    } finally {
      setSubmitting(false);
    }
  };

  const today = new Date().toISOString().split("T")[0];

  if (loading || !user) {
    return (
      <div className={styles.page}>
        <div style={{ textAlign: "center", marginTop: "100px" }}>
           <div className={styles.spinner} style={{width: 40, height: 40, borderTopColor: "#cc0000", margin: "0 auto 20px"}}/>
           <p>Memuat profil...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.regHeader}>
        <div className={styles.regLogos}>
          <Image src="/logos/plan-international.png" alt="Plan Indonesia" width={100} height={40} style={{ objectFit: "contain" }} />
          <span className={styles.logoSep}>×</span>
          <Image src="/logos/dbs-foundation.png" alt="DBS Foundation" width={80} height={34} style={{ objectFit: "contain" }} />
        </div>
        <p className={styles.regSubtitle}>
          {profile?.profileCompleted ? "Perbarui informasi data diri Anda" : "Lengkapi data diri untuk memulai program"}
        </p>
      </div>

      <form className={styles.card} onSubmit={handleSubmit} noValidate>
        <div className={styles.cardHead}>
          <h2>{profile?.profileCompleted ? "Profil Identitas Diri" : "Formulir Identitas Diri"}</h2>
          <p>Isikan data diri Anda dengan benar sesuai identitas resmi</p>
        </div>
        
        <div className={styles.cardBody}>
          {saved && (
            <div style={{ padding: "12px", backgroundColor: "#dcfce7", color: "#166534", borderRadius: "8px", marginBottom: "20px", fontWeight: 600 }}>
              ✅ Data berhasil disimpan! Mengarahkan ke kursus...
            </div>
          )}

          <p className={styles.reqNote}>Kolom bertanda <span className={styles.req}>*</span> wajib diisi</p>

          {/* Partner Code (Kemitraan) */}
          {isKemitraan && !profile?.partnerCode && (
            <div className={styles.fieldGroup} style={{ backgroundColor: "#fff5f5", padding: "16px", borderRadius: "8px", border: "1px solid #ffe5e5" }}>
              <label className={styles.fieldLabel}>Kode Mitra Kampus / Institusi<span className={styles.req}>*</span></label>
              <div style={{ display: "flex", gap: "8px" }}>
                <input 
                  className={`${styles.fieldInput} ${errors.partnerCode ? styles.fieldError : ""}`} 
                  type="text" 
                  placeholder="Masukkan kode mitra..." 
                  value={partnerCode} 
                  onChange={(e) => { setPartnerCode(e.target.value.toUpperCase()); setPartnerCodeValid(false); setErrors((p) => ({ ...p, partnerCode: "" })); }} 
                  disabled={partnerCodeValid}
                />
                {!partnerCodeValid ? (
                  <button type="button" onClick={validatePartnerCode} disabled={validatingCode || !partnerCode} style={{ padding: "0 16px", backgroundColor: "#cc0000", color: "white", borderRadius: "8px", fontWeight: 600, border: "none", cursor: "pointer" }}>
                    {validatingCode ? "Cek..." : "Validasi"}
                  </button>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", padding: "0 16px", backgroundColor: "#dcfce7", color: "#166534", borderRadius: "8px", fontWeight: 600 }}>
                    Valid ✓
                  </div>
                )}
              </div>
              {errors.partnerCode && <div className={styles.errMsg} data-field-error>{errors.partnerCode}</div>}
              {partnerCodeValid && <div style={{ fontSize: "12px", color: "#166534", marginTop: "6px" }}>Kode mitra berhasil divalidasi.</div>}
            </div>
          )}

          {/* Nama Lengkap */}
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Nama Lengkap (sesuai KTP/Kartu Identitas)<span className={styles.req}>*</span></label>
            <input className={`${styles.fieldInput} ${errors.namaLengkap ? styles.fieldError : ""}`} type="text" placeholder="Contoh: Ahmad Farhan Rizaldi" value={namaLengkap} onChange={(e) => { setNamaLengkap(e.target.value); setErrors((p) => ({ ...p, namaLengkap: "" })); }} autoComplete="name" />
            {errors.namaLengkap && <div className={styles.errMsg} data-field-error>{errors.namaLengkap}</div>}
          </div>

          {/* Jenis Kelamin */}
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Jenis Kelamin<span className={styles.req}>*</span></label>
            <div className={styles.radioGroup}>
              {(["Laki-laki", "Perempuan"] as const).map((jk) => (
                <div key={jk} className={`${styles.radioOpt} ${jenisKelamin === jk ? styles.radioSel : ""}`} onClick={() => { setJenisKelamin(jk); setErrors((p) => ({ ...p, jenisKelamin: "" })); }}>
                  <div className={styles.radioCircle}><div className={styles.radioDot} /></div>
                  <span className={styles.radioLabel}>{jk}</span>
                </div>
              ))}
            </div>
            {errors.jenisKelamin && <div className={styles.errMsg} data-field-error>{errors.jenisKelamin}</div>}
          </div>

          {/* Tanggal Lahir */}
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Tanggal Lahir<span className={styles.req}>*</span></label>
            <input className={`${styles.fieldInput} ${errors.tanggalLahir ? styles.fieldError : ""}`} type="date" min="1950-01-01" max={today} value={tanggalLahir} onChange={(e) => { setTanggalLahir(e.target.value); setErrors((p) => ({ ...p, tanggalLahir: "" })); }} />
            {errors.tanggalLahir && <div className={styles.errMsg} data-field-error>{errors.tanggalLahir}</div>}
          </div>

          {/* Email (readonly) */}
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Alamat Email</label>
            <div className={styles.gmailField}>
              <div className={styles.gmailIco}>
                <svg viewBox="0 0 48 48" width="20" height="20"><path fill="#EA4335" d="M24 23.5L4 12v28h40V12z"/><path fill="#FBBC04" d="M4 12l20 11.5L44 12"/><path fill="#34A853" d="M44 12v28H4"/><path fill="#4285F4" d="M4 40V12l20 11.5z"/><path fill="#1967D2" d="M24 23.5L44 12v28z"/></svg>
              </div>
              <div className={styles.gmailInfo}>
                <div className={styles.gmailEmail}>{userEmail || "—"}</div>
                <span className={styles.gmailBadge}>✓ Terautentikasi via Google</span>
              </div>
            </div>
            <div className={styles.fieldHint}>Email diambil otomatis dari akun Google Anda</div>
          </div>

          {/* Nomor WA */}
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Nomor WhatsApp / Telepon Aktif<span className={styles.req}>*</span></label>
            <input className={`${styles.fieldInput} ${errors.nomorWA ? styles.fieldError : ""}`} type="tel" placeholder="Contoh: 08123456789" inputMode="numeric" value={nomorWA} onChange={(e) => { setNomorWA(e.target.value); setErrors((p) => ({ ...p, nomorWA: "" })); }} />
            {errors.nomorWA && <div className={styles.errMsg} data-field-error>{errors.nomorWA}</div>}
          </div>

          <div className={styles.divider}><div className={styles.dividerLine} /><span className={styles.dividerText}>Asal Daerah</span><div className={styles.dividerLine} /></div>

          {/* Provinsi & Kota */}
          <div className={styles.fieldRow}>
            <div className={styles.fieldGroup} style={{ marginBottom: 0 }}>
              <label className={styles.fieldLabel}>Provinsi<span className={styles.req}>*</span></label>
              <select className={`${styles.fieldInput} ${errors.provinsi ? styles.fieldError : ""}`} value={provinsi} onChange={(e) => { setProvinsi(e.target.value); setErrors((p) => ({ ...p, provinsi: "" })); }}>
                <option value="">-- Pilih Provinsi --</option>
                {WILAYAH_INDONESIA.map((w) => <option key={w.name} value={w.name}>{w.name}</option>)}
              </select>
              {errors.provinsi && <div className={styles.errMsg} data-field-error>{errors.provinsi}</div>}
            </div>
            <div className={styles.fieldGroup} style={{ marginBottom: 0 }}>
              <label className={styles.fieldLabel}>Kota / Kabupaten<span className={styles.req}>*</span></label>
              <select className={`${styles.fieldInput} ${errors.kotaKabupaten ? styles.fieldError : ""}`} value={kotaKabupaten} disabled={!provinsi} onChange={(e) => { setKotaKabupaten(e.target.value); setErrors((p) => ({ ...p, kotaKabupaten: "" })); }}>
                <option value="">{provinsi ? "-- Pilih Kota/Kab --" : "-- Pilih dulu Provinsi --"}</option>
                {kotaList.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
              {errors.kotaKabupaten && <div className={styles.errMsg} data-field-error>{errors.kotaKabupaten}</div>}
            </div>
          </div>

          <div style={{ height: "18px" }} />
          <div className={styles.divider}><div className={styles.dividerLine} /><span className={styles.dividerText}>Informasi Disabilitas</span><div className={styles.dividerLine} /></div>

          {/* Disabilitas */}
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Apakah Anda merupakan penyandang disabilitas?<span className={styles.req}>*</span></label>
            <div className={styles.radioGroup}>
              {(["Tidak", "Ya"] as const).map((val) => (
                <div key={val} className={`${styles.radioOpt} ${disabilitas === val ? styles.radioSel : ""}`} onClick={() => { setDisabilitas(val); setDisabilitasKategori([]); setErrors((p) => ({ ...p, disabilitas: "", disabilitasKategori: "" })); }}>
                  <div className={styles.radioCircle}><div className={styles.radioDot} /></div>
                  <span className={styles.radioLabel}>{val}</span>
                </div>
              ))}
            </div>
            {errors.disabilitas && <div className={styles.errMsg} data-field-error>{errors.disabilitas}</div>}
          </div>

          {disabilitas === "Ya" && (
            <div className={styles.disabBox}>
              <label className={styles.fieldLabel} style={{ marginBottom: "10px" }}>Kategori disabilitas yang Anda miliki<span className={styles.req}>*</span></label>
              <div className={styles.checkboxList}>
                {DISABILITY_CATEGORIES.map((kat) => {
                  const isSel = disabilitasKategori.includes(kat);
                  return (
                    <div key={kat} className={`${styles.chkItem} ${isSel ? styles.chkSel : ""}`} onClick={() => { toggleKategori(kat); setErrors((p) => ({ ...p, disabilitasKategori: "" })); }}>
                      <div className={styles.chkBox}><svg className={styles.chkTick} viewBox="0 0 12 12"><polyline points="1.5 6 4.5 9 10.5 3" /></svg></div>
                      <span className={styles.chkLabel}>{kat}</span>
                    </div>
                  );
                })}
                {disabilitasKategori.includes("Lainnya") && (
                  <input className={styles.otherInput} type="text" placeholder="Sebutkan jenis disabilitas lainnya..." value={disabilitasLainnya} onChange={(e) => { setDisabilitasLainnya(e.target.value); setErrors((p) => ({ ...p, disabilitasLainnya: "" })); }} />
                )}
              </div>
              {errors.disabilitasKategori && <div className={styles.errMsg} data-field-error>{errors.disabilitasKategori}</div>}
              {errors.disabilitasLainnya && <div className={styles.errMsg} data-field-error>{errors.disabilitasLainnya}</div>}
            </div>
          )}

          {errors.submit && <div className={styles.errMsg} style={{ display: "block", marginTop: "12px" }}>{errors.submit}</div>}

          <button className={styles.submitBtn} type="submit" disabled={submitting}>
            {submitting ? (<><div className={styles.spinner} />Menyimpan...</>) : (<>{profile?.profileCompleted ? "Simpan Perubahan" : "Simpan & Mulai Belajar"} <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="18" height="18"><path d="M5 12h14M12 5l7 7-7 7" /></svg></>)}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={
      <div className={styles.page}>
        <div style={{ textAlign: "center", marginTop: "100px" }}>
          <div className={styles.spinner} style={{width: 40, height: 40, borderTopColor: "#cc0000", margin: "0 auto 20px"}}/>
          <p>Memuat halaman...</p>
        </div>
      </div>
    }>
      <ProfileContent />
    </Suspense>
  );
}
