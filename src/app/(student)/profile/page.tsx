"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/contexts/AuthContext";
import { CheckCircle2, ShieldCheck, Building2 } from "lucide-react";
import { WILAYAH_INDONESIA } from "@/lib/wilayah";
import SearchableSelect from "@/components/SearchableSelect";
import styles from "./page.module.css";
import type { DynamicForm, DynamicFormSection, DynamicFormField } from "@/lib/types";

function ProfileContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile, updateUserProfile, loading: authLoading } = useAuth();

  const channelType = searchParams.get("type") || "beasiswa";
  const urlEventId = searchParams.get("eventId") || "";
  const urlPartnerCode = searchParams.get("partnerCode") || "";
  const isKemitraan = channelType === "kemitraan" || profile?.channelSource === "kemitraan";

  // Form State
  const [activeForm, setActiveForm] = useState<DynamicForm | null>(null);
  const [loadingForm, setLoadingForm] = useState(true);
  const [currentSectionIdx, setCurrentSectionIdx] = useState(0);
  
  // Answers State
  const [answers, setAnswers] = useState<Record<string, any>>({});
  
  // Partner Code State (Hardcoded logic)
  const [partnerCode, setPartnerCode] = useState("");
  const [validatingCode, setValidatingCode] = useState(false);
  const [partnerCodeValid, setPartnerCodeValid] = useState(false);
  const [partnerEventId, setPartnerEventId] = useState("");

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);

  const userEmail = user?.email || "";
  const isEditMode = searchParams.get("edit") === "true";

  // 1. Redirect if not logged in or already completed (unless editing)
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
    if (!authLoading && user && profile) {
      if (profile.role === "admin") {
        router.push("/admin");
      } else if (profile.profileCompleted && profile.channelSource && !isEditMode) {
        // Jika profile sudah lengkap dan bukan sedang mode edit, arahkan ke /learn
        router.push("/learn");
      }
    }
  }, [authLoading, user, profile, router, searchParams]);

  // 2. Fetch Active Form
  useEffect(() => {
    async function fetchForm() {
      try {
        const res = await fetch("/api/forms/active");
        if (res.ok) {
          const data = await res.json();
          setActiveForm(data);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingForm(false);
      }
    }
    fetchForm();
  }, []);

  // 3. Pre-fill existing data + auto-validate partnerCode jika sudah ada
  useEffect(() => {
    if (profile) {
      if (profile.profileData) {
        setAnswers(profile.profileData);
      }
      // Jika partnerCode sudah tersimpan di profil, langsung anggap valid
      if (profile.partnerCode) {
        setPartnerCode(profile.partnerCode);
        setPartnerCodeValid(true);
      }
    }
    // CATATAN: partnerCode TIDAK di-auto-fill dari URL atau eventId.
    // User harus memasukkan sendiri kode mitra dari institusi mereka.
  }, [profile]);

  // Auto-fill & auto-validasi partnerCode dari URL ?partnerCode=XXX
  useEffect(() => {
    if (!isKemitraan || !urlPartnerCode || partnerCodeValid) return;
    // Isi field dulu
    setPartnerCode(urlPartnerCode.toUpperCase());
    // Langsung validasi otomatis
    const autoValidate = async () => {
      setValidatingCode(true);
      try {
        const res = await fetch("/api/partner-codes/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: urlPartnerCode }),
        });
        const data = await res.json();
        if (res.ok && data.valid) {
          setPartnerCodeValid(true);
          setPartnerEventId(data.eventId || "");
          setErrors((p) => { const next = {...p}; delete next.partnerCode; return next; });
        } else {
          // Kode dari URL tidak valid — biarkan user isi manual
          setPartnerCode("");
          setErrors((p) => ({ ...p, partnerCode: data.error || "Kode mitra dari URL tidak valid" }));
        }
      } catch {
        setPartnerCode("");
      } finally {
        setValidatingCode(false);
      }
    };
    autoValidate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlPartnerCode, isKemitraan]);

  // Auto-fill email dynamic fields
  useEffect(() => {
    if (activeForm && userEmail) {
      let changed = false;
      const nextAnswers = { ...answers };
      activeForm.sections.forEach(s => {
        s.fields.forEach(f => {
          if (f.type === 'email' && !nextAnswers[f.name]) {
            nextAnswers[f.name] = userEmail;
            changed = true;
          }
        });
      });
      if (changed) setAnswers(nextAnswers);
    }
  }, [activeForm, userEmail, answers]);

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

  const validateCurrentSection = () => {
    const errs: Record<string, string> = {};
    
    // Partner code validation on first section if kemitraan
    if (currentSectionIdx === 0 && isKemitraan && !partnerCodeValid && !profile?.partnerCode) {
      errs.partnerCode = "Kode mitra wajib divalidasi";
    }

    if (!activeForm) return errs;
    const section = activeForm.sections[currentSectionIdx];
    
    section.fields.forEach(field => {
      // ── Skip field yang tersembunyi (dependsOn tidak terpenuhi) ──
      if (field.dependsOn) {
        const depVal = answers[field.dependsOn];
        if (Array.isArray(depVal)) {
          if (!depVal.includes(field.dependsOnValue)) return;
        } else {
          if (depVal !== field.dependsOnValue) return;
        }
      }

      if (field.required) {
        const val = answers[field.name];
        if (field.type === 'province_city') {
          if (!val?.province) errs[field.name] = `${field.label} (Provinsi) wajib diisi`;
          else if (!val?.city) errs[field.name] = `${field.label} (Kota) wajib diisi`;
        } else if (field.type === 'checkbox') {
          // Checkbox: minimal satu dipilih, dan jika "Lainnya" dipilih → teks wajib diisi
          const arr: string[] = Array.isArray(val) ? val : [];
          const withoutOther = arr.filter(v => v !== '__other__');
          const hasOther = arr.includes('__other__');
          const otherText = (answers[`${field.name}__other`] || '').trim();

          if (arr.length === 0) {
            errs[field.name] = `${field.label} wajib dipilih minimal satu`;
          } else if (hasOther && !otherText) {
            errs[field.name] = `Kolom "Lainnya" pada ${field.label} wajib diisi`;
          } else if (withoutOther.length === 0 && !otherText) {
            errs[field.name] = `${field.label} wajib dipilih minimal satu`;
          }
        } else if (field.type === 'radio') {
          // Radio: jika __other__ dipilih → teks wajib diisi
          if (!val || String(val).trim() === '') {
            errs[field.name] = `${field.label} wajib diisi`;
          } else if (val === '__other__') {
            const otherText = (answers[`${field.name}__other`] || '').trim();
            if (!otherText) errs[field.name] = `Kolom "Lainnya" pada ${field.label} wajib diisi`;
          }
        } else {
          if (!val || String(val).trim() === "") errs[field.name] = `${field.label} wajib diisi`;
        }
      }
    });

    return errs;
  };

  const handleNext = () => {
    const errs = validateCurrentSection();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      document.querySelector("[data-field-error]")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setErrors({});
    if (activeForm && currentSectionIdx < activeForm.sections.length - 1) {
      setCurrentSectionIdx(prev => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrev = () => {
    if (currentSectionIdx > 0) {
      setCurrentSectionIdx(prev => prev - 1);
      setErrors({});
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validateCurrentSection();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      document.querySelector("[data-field-error]")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    
    setSubmitting(true);
    try {
      const channelSource = profile?.channelSource || (
        channelType === "workshop"  ? "workshop"  :
        channelType === "kemitraan" ? "kemitraan" :
        channelType === "beasiswa"  ? "beasiswa"  : "umum"
      );
      
      let newDisplayName = profile?.displayName;
      if (answers["nama_lengkap"]) newDisplayName = answers["nama_lengkap"];
      else if (answers["nama"]) newDisplayName = answers["nama"];
      else if (answers["name"]) newDisplayName = answers["name"];
      else if (answers["full_name"]) newDisplayName = answers["full_name"];

      // ── Resolve "Lainnya" answers sebelum disimpan ──
      const cleanAnswers: Record<string, any> = {};
      for (const [key, value] of Object.entries(answers)) {
        if (key.endsWith('__other')) continue; // skip helper keys
        if (value === '__other__') {
          // radio: replace dengan teks yang diketik
          cleanAnswers[key] = answers[`${key}__other`] || 'Lainnya';
        } else if (Array.isArray(value) && value.includes('__other__')) {
          // checkbox: replace __other__ di array dengan teks yang diketik
          cleanAnswers[key] = value.map((v: string) =>
            v === '__other__' ? (answers[`${key}__other`] || 'Lainnya') : v
          );
        } else {
          cleanAnswers[key] = value;
        }
      }

      await updateUserProfile({
        profileCompleted: true,
        channelSource,
        eventId: profile?.eventId || urlEventId || partnerEventId || null,
        partnerCode: isKemitraan ? partnerCode : profile?.partnerCode,
        profileData: cleanAnswers,
        ...(newDisplayName && { displayName: newDisplayName }),
      });
      
      setSaved(true);
      setTimeout(() => {
        router.push("/learn");
      }, 1500);
    } catch (err: any) {
      const msg = err?.message || "Unknown error";
      console.error("[Profile Submit Error]", msg, err);
      setErrors({ submit: `Gagal menyimpan data: ${msg}` });
    } finally {
      setSubmitting(false);
    }
  };

  const setAnswer = (key: string, value: any) => {
    setAnswers(prev => ({ ...prev, [key]: value }));
    setErrors(prev => { const next = {...prev}; delete next[key]; return next; });
  };

  const renderField = (field: DynamicFormField) => {
    const val = answers[field.name];

    if (field.type === 'email') {
      return (
        <div className={styles.gmailField}>
          <div className={styles.gmailIco}>
            <svg viewBox="0 0 48 48" width="20" height="20"><path fill="#EA4335" d="M24 23.5L4 12v28h40V12z"/><path fill="#FBBC04" d="M4 12l20 11.5L44 12"/><path fill="#34A853" d="M44 12v28H4"/><path fill="#4285F4" d="M4 40V12l20 11.5z"/><path fill="#1967D2" d="M24 23.5L44 12v28z"/></svg>
          </div>
          <div className={styles.gmailInfo}>
            <div className={styles.gmailEmail}>{userEmail || "—"}</div>
            <span className={styles.gmailBadge}>✓ Terautentikasi via Google</span>
          </div>
        </div>
      );
    }

    if (field.type === 'province_city') {
      const prov = val?.province || "";
      const city = val?.city || "";
      
      const isManual = field.regionSource === 'manual';
      const regionData = isManual ? (field.customRegions || []) : WILAYAH_INDONESIA;
      
      const provList = isManual ? regionData.map((r: any) => r.province).filter(Boolean) : regionData.map((r: any) => r.name);
      const selectedProvObj = regionData.find((w: any) => (isManual ? w.province : w.name) === prov);
      const kotaList = selectedProvObj ? (selectedProvObj.cities || []) : [];

      return (
        <div className={styles.fieldRow}>
          <div className={styles.fieldGroup} style={{ marginBottom: 0 }}>
            <label className={styles.fieldLabel}>Provinsi{field.required && <span className={styles.req}>*</span>}</label>
            <SearchableSelect 
              className={`${styles.fieldInput} ${errors[field.name] ? styles.fieldError : ""}`}
              options={provList}
              value={prov}
              onChange={(val) => setAnswer(field.name, { province: val, city: "" })}
              placeholder="Cari atau pilih provinsi"
              error={!!errors[field.name]}
            />
          </div>
          <div className={styles.fieldGroup} style={{ marginBottom: 0 }}>
            <label className={styles.fieldLabel}>Kota / Kabupaten{field.required && <span className={styles.req}>*</span>}</label>
            <SearchableSelect 
              className={`${styles.fieldInput} ${errors[field.name] ? styles.fieldError : ""}`}
              options={kotaList}
              value={city}
              onChange={(val) => setAnswer(field.name, { province: prov, city: val })}
              placeholder={prov ? "Cari atau pilih kota" : "Pilih dulu provinsi"}
              disabled={!prov}
              error={!!errors[field.name]}
            />
          </div>
        </div>
      );
    }

    if (field.type === 'radio') {
      const otherText = answers[`${field.name}__other`] || "";
      return (
        <div className={styles.radioGroup}>
          {(field.options || []).map((opt) => (
            <div key={opt} className={`${styles.radioOpt} ${val === opt ? styles.radioSel : ""}`} onClick={() => setAnswer(field.name, opt)}>
              <div className={styles.radioCircle}><div className={styles.radioDot} /></div>
              <span className={styles.radioLabel}>{opt}</span>
            </div>
          ))}
          {field.allowOther && (
            <div
              className={`${styles.radioOpt} ${val === '__other__' ? styles.radioSel : ""}`}
              onClick={() => setAnswer(field.name, '__other__')}
            >
              <div className={styles.radioCircle}><div className={styles.radioDot} /></div>
              {val === '__other__' ? (
                <input
                  type="text"
                  className={styles.otherInlineInput}
                  placeholder="Sebutkan..."
                  value={otherText}
                  onClick={e => e.stopPropagation()}
                  onChange={e => setAnswer(`${field.name}__other`, e.target.value)}
                  autoFocus
                />
              ) : (
                <span className={styles.radioLabel}>Lainnya</span>
              )}
            </div>
          )}
        </div>
      );
    }

    if (field.type === 'checkbox') {
      const selected = Array.isArray(val) ? val : [];
      const otherText = answers[`${field.name}__other`] || "";
      const toggleCheck = (opt: string) => {
        if (selected.includes(opt)) setAnswer(field.name, selected.filter((o: string) => o !== opt));
        else setAnswer(field.name, [...selected, opt]);
      };
      return (
        <div className={styles.checkboxList}>
          {(field.options || []).map((opt) => (
            <div key={opt} className={`${styles.chkItem} ${selected.includes(opt) ? styles.chkSel : ""}`} onClick={() => toggleCheck(opt)}>
              <div className={styles.chkBox}><svg className={styles.chkTick} viewBox="0 0 12 12"><polyline points="1.5 6 4.5 9 10.5 3" /></svg></div>
              <span className={styles.chkLabel}>{opt}</span>
            </div>
          ))}
          {field.allowOther && (
            <div
              className={`${styles.chkItem} ${selected.includes('__other__') ? styles.chkSel : ""}`}
              onClick={() => toggleCheck('__other__')}
            >
              <div className={styles.chkBox}><svg className={styles.chkTick} viewBox="0 0 12 12"><polyline points="1.5 6 4.5 9 10.5 3" /></svg></div>
              {selected.includes('__other__') ? (
                <input
                  type="text"
                  className={styles.otherInlineInput}
                  placeholder="Sebutkan..."
                  value={otherText}
                  onClick={e => e.stopPropagation()}
                  onChange={e => setAnswer(`${field.name}__other`, e.target.value)}
                  autoFocus
                />
              ) : (
                <span className={styles.chkLabel}>Lainnya</span>
              )}
            </div>
          )}
        </div>
      );
    }

    if (field.type === 'select') {
      return (
        <select className={`${styles.fieldInput} ${errors[field.name] ? styles.fieldError : ""}`} value={val || ""} onChange={(e) => setAnswer(field.name, e.target.value)}>
          <option value="">-- Pilih --</option>
          {(field.options || []).map((opt) => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      );
    }

    if (field.type === 'textarea') {
      return (
        <textarea className={`${styles.fieldInput} ${errors[field.name] ? styles.fieldError : ""}`} placeholder={field.placeholder} rows={4} value={val || ""} onChange={(e) => setAnswer(field.name, e.target.value)} />
      );
    }

    return (
      <input 
        type={field.type} 
        className={`${styles.fieldInput} ${errors[field.name] ? styles.fieldError : ""}`} 
        placeholder={field.placeholder || "Jawaban Anda..."} 
        value={val || ""} 
        onChange={(e) => setAnswer(field.name, e.target.value)} 
        onClick={(e) => {
          if (field.type === 'date' && 'showPicker' in HTMLInputElement.prototype) {
            try { (e.target as HTMLInputElement).showPicker(); } catch(err) {}
          }
        }}
      />
    );
  };

  if (authLoading || loadingForm || !user) {
    return (
      <div className={styles.page}>
        <div style={{ textAlign: "center", marginTop: "100px" }}>
           <div className={styles.spinner} style={{width: 40, height: 40, borderTopColor: "#cc0000", margin: "0 auto 20px"}}/>
           <p>Memuat profil...</p>
        </div>
      </div>
    );
  }

  if (!activeForm) {
    return (
      <div className={styles.page}>
        <div style={{ textAlign: "center", marginTop: "100px", color: "#666" }}>
           <h2>Mohon Maaf</h2>
           <p>Formulir pendaftaran sedang tidak tersedia atau belum dikonfigurasi oleh Admin.</p>
        </div>
      </div>
    );
  }

  const currentSection = activeForm.sections[currentSectionIdx];
  const isLastSection = currentSectionIdx === activeForm.sections.length - 1;

  return (
    <div className={styles.page}>
      <div className={styles.regHeader}>
        <h1 className={styles.regTitle}>
          {profile?.profileCompleted ? "Perbarui informasi data diri Anda" : "Lengkapi data diri untuk memulai program"}
        </h1>
      </div>

      <form className={styles.card} onSubmit={isLastSection ? handleSubmit : (e) => { e.preventDefault(); handleNext(); }} noValidate>
        <div className={styles.cardHead}>
          <h2>{currentSection.title}</h2>
          {currentSection.description && <p>{currentSection.description}</p>}
        </div>
        
        <div className={styles.cardBody}>
          {saved && (
            <div style={{ padding: "12px", backgroundColor: "#dcfce7", color: "#166534", borderRadius: "8px", marginBottom: "20px", fontWeight: 600 }}>
              ✅ Data berhasil disimpan! Mengarahkan ke kursus...
            </div>
          )}

          {/* Partner Code — selalu tampil di section 1 untuk kemitraan */}
          {/* Partner Code — selalu tampil di section 1 untuk kemitraan */}
          {currentSectionIdx === 0 && isKemitraan && (
            <div className={styles.fieldGroup} style={{ backgroundColor: "#f8fafc", padding: "24px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
              <label className={styles.fieldLabel} style={{ display: "flex", alignItems: "center", gap: "8px", color: "#334155", marginBottom: "12px" }}>
                <Building2 size={18} color="#64748b" />
                <span>Kode Mitra Kampus / Institusi <span className={styles.req}>*</span></span>
              </label>
              <div style={{ display: "flex", gap: "12px", alignItems: "stretch" }}>
                <div style={{ position: "relative", flex: 1 }}>
                  <input 
                    className={`${styles.fieldInput} ${errors.partnerCode ? styles.fieldError : ""}`} 
                    type="text" 
                    placeholder="Contoh: UNJ2024" 
                    value={partnerCode} 
                    onChange={(e) => { setPartnerCode(e.target.value.toUpperCase()); setPartnerCodeValid(false); setErrors((p) => ({ ...p, partnerCode: "" })); }} 
                    disabled={partnerCodeValid}
                    style={{ 
                      width: "100%", 
                      height: "48px", 
                      fontSize: "16px",
                      textTransform: "uppercase", 
                      letterSpacing: "1px",
                      fontWeight: 600,
                      backgroundColor: partnerCodeValid ? "#f1f5f9" : "white",
                      color: partnerCodeValid ? "#737373" : "#171717",
                      border: partnerCodeValid ? "1px solid #cbd5e1" : undefined
                    }}
                  />
                  {partnerCodeValid && (
                    <div style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)" }}>
                      <CheckCircle2 size={20} color="#10b981" />
                    </div>
                  )}
                </div>
                {!partnerCodeValid ? (
                  <button type="button" onClick={validatePartnerCode} disabled={validatingCode || !partnerCode} 
                    style={{ 
                      padding: "0 24px", 
                      backgroundColor: (validatingCode || !partnerCode) ? "#94a3b8" : "#CC0000", 
                      color: "white", 
                      borderRadius: "8px", 
                      fontWeight: 600, 
                      border: "none", 
                      cursor: (validatingCode || !partnerCode) ? "not-allowed" : "pointer",
                      height: "48px",
                      transition: "all 0.2s",
                      whiteSpace: "nowrap"
                    }}>
                    {validatingCode ? "Memeriksa..." : "Validasi"}
                  </button>
                ) : (
                  <div style={{ 
                    display: "flex", 
                    alignItems: "center", 
                    gap: "6px", 
                    padding: "0 20px", 
                    backgroundColor: "#ecfdf5", 
                    color: "#059669", 
                    borderRadius: "8px", 
                    fontWeight: 600,
                    border: "1px solid #a7f3d0",
                    height: "48px",
                    whiteSpace: "nowrap"
                  }}>
                    <ShieldCheck size={18} />
                    Terverifikasi
                  </div>
                )}
              </div>
              {errors.partnerCode && <div className={styles.errMsg} data-field-error style={{ marginTop: "8px" }}>{errors.partnerCode}</div>}
              {partnerCodeValid && <div style={{ fontSize: "13px", color: "#059669", marginTop: "12px", display: "flex", alignItems: "center", gap: "6px" }}>✨ Bagus! Kamu telah terhubung dengan mitra yang sah.</div>}
              {!partnerCodeValid && partnerCode && !errors.partnerCode && <div style={{ fontSize: "13px", color: "#64748b", marginTop: "10px" }}>ℹ️ Pastikan untuk menekan tombol "Validasi" agar kodemu diverifikasi.</div>}
            </div>
          )}

          <div className={styles.sectionBody}>
          {activeForm.sections[currentSectionIdx].fields.map((field) => {
            // Check if edit mode and filter fields
            if (isEditMode) {
              const allowedEditFields = [
                "nama_lengkap", "nama", "name", "full_name",
                "jenis_kelamin", 
                "tanggal_lahir", 
                "alamat_email", "email",
                "nomor_whatsapp", "whatsapp", "phone",
                "asal_daerah", "provinsi", "kota",
                "disabilitas",
                "jenis_disabilitas", "kategori_disabilitas"
              ];
              if (!allowedEditFields.includes(field.name)) return null;
            }

            // Check conditional logic
            if (field.dependsOn) {
              const dependentVal = answers[field.dependsOn];
              // If it's an array (checkboxes), check if value is included
              if (Array.isArray(dependentVal)) {
                if (!dependentVal.includes(field.dependsOnValue)) return null;
              } else {
                if (dependentVal !== field.dependsOnValue) return null;
              }
            }

            return (
              <div key={field.id} className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>
                  {field.label} {field.required && <span className={styles.req}>*</span>}
                </label>
                {field.description && (
                  <div
                    className={styles.fieldDesc}
                    dangerouslySetInnerHTML={{ __html: field.description }}
                  />
                )}
                {renderField(field)}
                {errors[field.name] && <div className={styles.errorMsg} data-field-error>{errors[field.name]}</div>}
              </div>
            );
          })}
        </div>   {errors.submit && <div className={styles.errMsg} style={{ display: "block", marginTop: "12px" }}>{errors.submit}</div>}

          <div style={{ display: 'flex', gap: '15px', marginTop: '30px' }}>
            {currentSectionIdx > 0 && (
              <button type="button" className={styles.backBtn} onClick={handlePrev} style={{ flex: 1 }}>
                Kembali
              </button>
            )}
            <button className={styles.submitBtn} type="submit" disabled={submitting} style={{ flex: 2 }}>
              {submitting ? (<><div className={styles.spinner} />Menyimpan...</>) : (
                <>{isLastSection ? (profile?.profileCompleted ? "Simpan Perubahan" : "Simpan & Mulai Belajar") : "Selanjutnya"} <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="18" height="18"><path d="M5 12h14M12 5l7 7-7 7" /></svg></>
              )}
            </button>
          </div>
        </div>
      </form>

      {activeForm.sections.length > 1 && (
        <div className={styles.stepProgress}>
          {activeForm.sections.map((sec, idx) => (
            <div key={idx} className={styles.stepPill}>
              <div className={`${styles.stepBar} ${idx <= currentSectionIdx ? styles.stepBarActive : ''}`} />
              <span className={`${styles.stepNum} ${idx <= currentSectionIdx ? styles.stepNumActive : ''}`}>
                {idx + 1}
              </span>
            </div>
          ))}
        </div>
      )}
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
