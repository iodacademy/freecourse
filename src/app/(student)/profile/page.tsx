"use client";

import { Suspense, useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { CheckCircle2, ShieldCheck, Building2 } from "lucide-react";
import { WILAYAH_INDONESIA } from "@/lib/wilayah";
import { ageRangeFor, isDisabilitasValue } from "@/lib/regions";
import SearchableSelect from "@/components/SearchableSelect";
import type { DynamicForm, DynamicFormField, DynamicFormSection, SkipRule } from "@/lib/types";

// ─── Helpers ───
/** Given a section index, find the "page" it belongs to. Consecutive "merged" sections form one page. */
function buildPages(sections: DynamicFormSection[]): number[][] {
  const pages: number[][] = [];
  let current: number[] = [];

  for (let i = 0; i < sections.length; i++) {
    current.push(i);
    // If next section is NOT merged into this one, finalize the page
    const nextIsMerged = i + 1 < sections.length && sections[i + 1].displayMode === "merged";
    if (!nextIsMerged) {
      pages.push(current);
      current = [];
    }
  }
  if (current.length > 0) pages.push(current);
  return pages;
}

/** Check if a section qualifies for auto-advance: has autoAdvance=true AND exactly 1 radio field */
function canAutoAdvance(section: DynamicFormSection): boolean {
  if (!section.autoAdvance) return false;
  const radioFields = section.fields.filter(f => f.type === "radio");
  return radioFields.length === 1 && section.fields.length === 1;
}

/** Evaluate skip rules for a section given current answers */
function evaluateSkipRules(section: DynamicFormSection, answers: Record<string, any>): number | "end" | null {
  if (!section.skipRules || section.skipRules.length === 0) return null;
  for (const rule of section.skipRules) {
    const val = answers[rule.fieldName];
    if (String(val) === rule.fieldValue) {
      return rule.goToSection;
    }
  }
  return null;
}

function ProfileContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile, updateUserProfile, loading: authLoading } = useAuth();

  const channelType = searchParams.get("type") || "umum";
  const urlEventId = searchParams.get("eventId") || "";
  const urlPartnerCode = searchParams.get("partnerCode") || "";
  const isKemitraan = channelType === "kemitraan" || profile?.channelSource === "kemitraan";

  // Form State
  const [activeForm, setActiveForm] = useState<DynamicForm | null>(null);
  const [loadingForm, setLoadingForm] = useState(true);
  const [currentPageIdx, setCurrentPageIdx] = useState(0);
  const [blocked, setBlocked] = useState<string | null>(null); // non-null = form blocked (e.g. consent "Tidak")

  // Answers State
  const [answers, setAnswers] = useState<Record<string, any>>({});
  
  // Partner Code State
  const [partnerCode, setPartnerCode] = useState("");
  const [validatingCode, setValidatingCode] = useState(false);
  const [partnerCodeValid, setPartnerCodeValid] = useState(false);
  const [partnerEventId, setPartnerEventId] = useState("");

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);

  const userEmail = user?.email || "";
  const isEditMode = searchParams.get("edit") === "true";
  const autoAdvanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const redirectingRef = useRef(false);
  const resolvedEventId = profile?.eventId || urlEventId || partnerEventId || "";

  // Computed: pages
  const pages = activeForm ? buildPages(activeForm.sections) : [];
  const currentSectionIndices = pages[currentPageIdx] || [];
  const isLastPage = currentPageIdx === pages.length - 1;

  // 1. Redirect if not logged in or already completed (unless editing)
  useEffect(() => {
    if (!authLoading && !user) {
      if (!redirectingRef.current) {
        redirectingRef.current = true;
        router.push("/login");
      }
    }
    if (!authLoading && user && profile) {
      if (profile.profileCompleted && profile.channelSource && !isEditMode && !saved) {
        if (!redirectingRef.current) {
          redirectingRef.current = true;
          router.push("/learn");
        }
      }
    }
  }, [authLoading, user, profile, router, searchParams, isEditMode, saved]);

  // 2. Resolve form: event-specific custom form, falling back to global default.
  useEffect(() => {
    let cancelled = false;

    async function fetchForm() {
      setLoadingForm(true);
      try {
        const qs = resolvedEventId ? `?eventId=${encodeURIComponent(resolvedEventId)}` : "";
        const res = await fetch(`/api/forms/resolve${qs}`);
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) {
            setActiveForm(data);
            setCurrentPageIdx(0);
            setBlocked(null);
            setErrors({});
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoadingForm(false);
      }
    }
    fetchForm();
    return () => { cancelled = true; };
  }, [resolvedEventId]);

  // 3. Pre-fill existing data + auto-validate partnerCode jika sudah ada
  useEffect(() => {
    if (profile) {
      if (profile.profileData) {
        setAnswers(profile.profileData);
      }
      if (profile.partnerCode) {
        setPartnerCode(profile.partnerCode);
        setPartnerCodeValid(true);
      }
    }
  }, [profile]);

  // Auto-fill & auto-validasi partnerCode dari URL ?partnerCode=XXX
  useEffect(() => {
    if (!isKemitraan || !urlPartnerCode || partnerCodeValid) return;
    setPartnerCode(urlPartnerCode.toUpperCase());
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

  // Skip to correct page in edit mode (skip consent if already filled)
  useEffect(() => {
    if (isEditMode && profile?.profileCompleted && activeForm && pages.length > 1) {
      // Find first "data diri" page (skip consent sections)
      const dataPageIdx = pages.findIndex(page =>
        page.some(si => {
          const sec = activeForm.sections[si];
          return sec.fields.some(f => ["text", "tel", "date", "email", "province_city"].includes(f.type));
        })
      );
      if (dataPageIdx > 0) setCurrentPageIdx(dataPageIdx);
    }
  }, [isEditMode, profile, activeForm, pages.length]);

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

  const validateSectionsOnPage = () => {
    const errs: Record<string, string> = {};
    
    // Partner code validation (only on first page for kemitraan)
    if (currentPageIdx === 0 && isKemitraan && !partnerCodeValid && !profile?.partnerCode) {
      errs.partnerCode = "Kode mitra wajib divalidasi";
    }

    if (!activeForm) return errs;

    for (const sectionIdx of currentSectionIndices) {
      const section = activeForm.sections[sectionIdx];
      section.fields.forEach(field => {
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
            const arr: string[] = Array.isArray(val) ? val : [];
            const withoutOther = arr.filter(v => v !== '__other__');
            const hasOther = arr.includes('__other__');
            const otherText = (answers[`${field.name}__other`] || '').trim();
            if (arr.length === 0) errs[field.name] = `${field.label} wajib dipilih minimal satu`;
            else if (hasOther && !otherText) errs[field.name] = `Kolom "Lainnya" pada ${field.label} wajib diisi`;
            else if (withoutOther.length === 0 && !otherText) errs[field.name] = `${field.label} wajib dipilih minimal satu`;
          } else if (field.type === 'radio') {
            if (!val || String(val).trim() === '') errs[field.name] = `${field.label} wajib diisi`;
            else if (val === '__other__') {
              const otherText = (answers[`${field.name}__other`] || '').trim();
              if (!otherText) errs[field.name] = `Kolom "Lainnya" pada ${field.label} wajib diisi`;
            }
          } else {
            if (!val || String(val).trim() === "") {
              errs[field.name] = `${field.label} wajib diisi`;
            } else if (field.type === 'date') {
              if (typeof val === 'string' && val.startsWith('__display:')) {
                errs[field.name] = `Format ${field.label} belum lengkap (DD/MM/YYYY)`;
              } else if (field.name === 'tanggal_lahir' || field.label.toLowerCase().includes('lahir')) {
                const m = String(val).match(/^(\d{4})-(\d{2})-(\d{2})/);
                if (m) {
                   const birth = new Date(`${m[1]}-${m[2]}-${m[3]}`);
                   const now = new Date();
                   let age = now.getFullYear() - birth.getFullYear();
                   const md = now.getMonth() - birth.getMonth();
                   if (md < 0 || (md === 0 && now.getDate() < birth.getDate())) age--;

                   // Penyandang disabilitas boleh sampai 35 th; selain itu 29 th.
                   // Kalau jawaban disabilitas belum terisi (mis. data dipindah
                   // field-nya ke halaman berikutnya), pakai batas longgar dulu —
                   // biar orang tidak ditolak gara-gara urutan pengisian. Field
                   // disabilitas sendiri tetap wajib dan akan memunculkan error.
                   const disabilitasAnswered = answers.disabilitas !== undefined
                     && String(answers.disabilitas ?? '').trim() !== '';
                   const isDisabilitas = !disabilitasAnswered
                     || isDisabilitasValue(answers.disabilitas);
                   const [minAge, maxAge] = ageRangeFor(isDisabilitas);

                   if (age < minAge || age > maxAge) {
                     errs[field.name] = `Usia yang diperbolehkan adalah ${minAge}-${maxAge} tahun (Usia saat ini: ${age} tahun)`;
                   }
                }
              }
            }
          }
        }
      });
    }

    return errs;
  };

  const goToNextPage = useCallback(() => {
    if (!activeForm) return;

    // Check skip rules for current sections
    for (const sectionIdx of currentSectionIndices) {
      const section = activeForm.sections[sectionIdx];
      const skipTarget = evaluateSkipRules(section, answers);
      if (skipTarget === "end") {
        // Block the form
        setBlocked("Form tidak bisa dilanjutkan karena jawaban Anda. Anda bisa mengubah jawaban kapan saja.");
        return;
      }
      if (typeof skipTarget === "number") {
        // Jump to target section's page
        const targetPageIdx = pages.findIndex(page => page.includes(skipTarget));
        if (targetPageIdx >= 0) {
          setCurrentPageIdx(targetPageIdx);
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }
      }
    }

    // Normal next page
    if (currentPageIdx < pages.length - 1) {
      setCurrentPageIdx(prev => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [activeForm, currentPageIdx, currentSectionIndices, pages, answers]);

  const handleNext = () => {
    const errs = validateSectionsOnPage();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      document.querySelector("[data-field-error]")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setErrors({});
    setBlocked(null);
    goToNextPage();
  };

  const handlePrev = () => {
    if (currentPageIdx > 0) {
      setCurrentPageIdx(prev => prev - 1);
      setErrors({});
      setBlocked(null);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validateSectionsOnPage();
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

      // Resolve "Lainnya" answers sebelum disimpan
      const cleanAnswers: Record<string, any> = {};
      for (const [key, value] of Object.entries(answers)) {
        if (key.endsWith('__other')) continue;
        // Strip temp date display prefix
        if (typeof value === 'string' && value.startsWith('__display:')) continue; // incomplete date, skip
        if (value === '__other__') {
          cleanAnswers[key] = answers[`${key}__other`] || 'Lainnya';
        } else if (Array.isArray(value) && value.includes('__other__')) {
          cleanAnswers[key] = value.map((v: string) =>
            v === '__other__' ? (answers[`${key}__other`] || 'Lainnya') : v
          );
        } else {
          cleanAnswers[key] = value;
        }
      }

      // Hitung Nilai Pre-test dari field yang ditandai isPretest (pembobotan poin per-opsi).
      // Disimpan ke profileData.pretest_score agar dibaca dashboard & export.
      let pretestScore: number | null = null;
      if (activeForm) {
        for (const sec of activeForm.sections) {
          for (const f of sec.fields) {
            if (f.isPretest && f.usePoints && f.optionPoints) {
              const ans = cleanAnswers[f.name];
              if (typeof ans === "string" && ans in f.optionPoints) {
                pretestScore = (pretestScore ?? 0) + f.optionPoints[ans];
              }
            }
          }
        }
      }
      if (pretestScore != null) cleanAnswers.pretest_score = pretestScore;

      await updateUserProfile({
        profileCompleted: true,
        channelSource,
        eventId: profile?.eventId || urlEventId || partnerEventId || null,
        partnerCode: isKemitraan ? partnerCode : profile?.partnerCode,
        profileData: cleanAnswers,
        ...(newDisplayName && { displayName: newDisplayName }),
      });

      // Update enrollment dengan info channel/event (enrollment sudah dibuat saat SSO)
      try {
        const idToken = await user?.getIdToken();
        await fetch("/api/enrollments/auto-enroll", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            channelSource,
            eventId: profile?.eventId || urlEventId || partnerEventId || null,
          }),
        });
      } catch (enrollErr) {
        console.warn("[Profile] Enrollment update failed:", enrollErr);
      }

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

  const setAnswer = useCallback((key: string, value: any) => {
    setAnswers(prev => ({ ...prev, [key]: value }));
    setErrors(prev => { const next = {...prev}; delete next[key]; return next; });
    setBlocked(null); // Clear any block when user changes answer
  }, []);

  // ─── Auto-advance handler ───
  const handleAutoAdvanceAnswer = useCallback((field: DynamicFormField, value: string, section: DynamicFormSection) => {
    setAnswer(field.name, value);
    
    // Clear any existing timer
    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current);
    }

    // Check skip rules first
    const newAnswers = { ...answers, [field.name]: value };
    const skipTarget = evaluateSkipRules(section, newAnswers);
    
    if (skipTarget === "end") {
      autoAdvanceTimerRef.current = setTimeout(() => {
        setBlocked("Form tidak bisa dilanjutkan karena jawaban Anda. Anda bisa mengubah jawaban kapan saja.");
      }, 400);
      return;
    }

    // Auto-advance after short delay
    autoAdvanceTimerRef.current = setTimeout(() => {
      if (skipTarget !== null && typeof skipTarget === "number") {
        const targetPageIdx = pages.findIndex(page => page.includes(skipTarget));
        if (targetPageIdx >= 0) {
          setCurrentPageIdx(targetPageIdx);
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }
      }
      // Normal advance
      if (currentPageIdx < pages.length - 1) {
        setCurrentPageIdx(prev => prev + 1);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }, 400);
  }, [answers, currentPageIdx, pages, setAnswer]);

  // Cleanup timer
  useEffect(() => {
    return () => {
      if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current);
    };
  }, []);

  // ─── Progress percentage ───
  const getProgressPct = () => {
    if (!activeForm || pages.length === 0) return 0;
    return Math.round(((currentPageIdx + 1) / pages.length) * 100);
  };

  // ─── Opsi "Lainnya" aktif untuk peserta ini? ───
  // Jika field.otherForPartners diisi, "Lainnya" hanya tampil bila kode mitra
  // peserta saat ini termasuk di dalamnya. Kosong = tampil untuk semua.
  const otherEnabledFor = (field: DynamicFormField): boolean => {
    if (!field.allowOther) return false;
    const restrict = field.otherForPartners || [];
    if (restrict.length === 0) return true;
    const pc = (partnerCode || profile?.partnerCode || "").toUpperCase();
    return !!pc && restrict.map((c) => String(c).toUpperCase()).includes(pc);
  };

  // ─── Determine if a radio field should be segmented (2 options = segmented) ───
  const isSegmentedField = (field: DynamicFormField) => {
    if (field.type !== 'radio') return false;
    const opts = field.options || [];
    return opts.length === 2 && !otherEnabledFor(field);
  };

  // ─── Determine if a radio/checkbox field should be pill chips ───
  const isPillField = (field: DynamicFormField) => {
    if (field.type === 'radio' && !isSegmentedField(field)) return true;
    if (field.type === 'checkbox') return true;
    return false;
  };

  const renderField = (field: DynamicFormField, parentSection?: DynamicFormSection) => {
    const val = answers[field.name];
    const isAutoAdvanceSection = parentSection && canAutoAdvance(parentSection);

    // ── Email (SSO) ──
    if (field.type === 'email') {
      return (
        <div className="pf-gmail">
          <div className="pf-gmail__icon">
            <svg viewBox="0 0 48 48" width="20" height="20"><path fill="#EA4335" d="M24 23.5L4 12v28h40V12z"/><path fill="#FBBC04" d="M4 12l20 11.5L44 12"/><path fill="#34A853" d="M44 12v28H4"/><path fill="#4285F4" d="M4 40V12l20 11.5z"/><path fill="#1967D2" d="M24 23.5L44 12v28z"/></svg>
          </div>
          <div className="pf-gmail__info">
            <div className="pf-gmail__email">{userEmail || "—"}</div>
            <span className="pf-gmail__badge">✓ Terautentikasi via Google</span>
          </div>
        </div>
      );
    }

    // ── Province / City ──
    if (field.type === 'province_city') {
      const prov = val?.province || "";
      const city = val?.city || "";
      const isManual = field.regionSource === 'manual';
      const regionData = isManual ? (field.customRegions || []) : WILAYAH_INDONESIA;
      const provList = isManual ? regionData.map((r: any) => r.province).filter(Boolean) : regionData.map((r: any) => r.name);
      const selectedProvObj = regionData.find((w: any) => (isManual ? w.province : w.name) === prov);
      const kotaList = selectedProvObj ? (selectedProvObj.cities || []) : [];
      return (
        <div className="pf-field-row">
          <div className="pf-field-group" style={{ marginBottom: 0 }}>
            <label className="pf-label">Provinsi{field.required && <span className="yr-req">*</span>}</label>
            <SearchableSelect 
              className={`pf-input ${errors[field.name] ? 'pf-input--error' : ''}`}
              options={provList}
              value={prov}
              onChange={(val) => setAnswer(field.name, { province: val, city: "" })}
              placeholder="Cari atau pilih provinsi"
              error={!!errors[field.name]}
            />
          </div>
          <div className="pf-field-group" style={{ marginBottom: 0 }}>
            <label className="pf-label">Kota / Kabupaten{field.required && <span className="yr-req">*</span>}</label>
            <SearchableSelect 
              className={`pf-input ${errors[field.name] ? 'pf-input--error' : ''}`}
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

    // ── Segmented Control (radio with exactly 2 options, no "Lainnya") ──
    if (isSegmentedField(field)) {
      const opts = field.options || [];
      return (
        <div className="pf-segmented" role="radiogroup">
          {opts.map((opt) => (
            <button
              key={opt}
              type="button"
              className={`pf-segmented__opt ${val === opt ? 'pf-segmented__opt--active' : ''}`}
              onClick={() => {
                if (isAutoAdvanceSection && parentSection) {
                  handleAutoAdvanceAnswer(field, opt, parentSection);
                } else {
                  setAnswer(field.name, opt);
                }
              }}
            >
              {opt}
            </button>
          ))}
        </div>
      );
    }

    // ── Pill Chips for radio (3+ options) ──
    if (field.type === 'radio' && isPillField(field)) {
      const otherText = answers[`${field.name}__other`] || "";
      return (
        <>
          <div className={`pf-pills ${(field.options || []).length <= 9 ? 'pf-pills--grid3' : ''}`} role="radiogroup">
            {(field.options || []).map((opt) => (
              <button
                key={opt}
                type="button"
                className={`pf-pill ${val === opt ? 'pf-pill--active' : ''}`}
                onClick={() => {
                  if (isAutoAdvanceSection && parentSection) {
                    handleAutoAdvanceAnswer(field, opt, parentSection);
                  } else {
                    setAnswer(field.name, opt);
                  }
                }}
              >
                {val === opt && (
                  <svg className="pf-pill__check" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3,8.5 7,12 13,4" />
                  </svg>
                )}
                {opt}
              </button>
            ))}
            {otherEnabledFor(field) && (
              <button
                type="button"
                className={`pf-pill ${val === '__other__' ? 'pf-pill--active' : ''}`}
                onClick={() => setAnswer(field.name, '__other__')}
              >
                {val === '__other__' && (
                  <svg className="pf-pill__check" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3,8.5 7,12 13,4" />
                  </svg>
                )}
                Lainnya
              </button>
            )}
          </div>
          {val === '__other__' && (
            <div className="pf-other-input">
              <label>Tulis di sini</label>
              <input
                className="pf-input"
                type="text"
                placeholder="Sebutkan..."
                value={otherText}
                onChange={e => setAnswer(`${field.name}__other`, e.target.value)}
                autoFocus
              />
            </div>
          )}
        </>
      );
    }

    // ── Pill Chips for checkbox ──
    if (field.type === 'checkbox') {
      const selected = Array.isArray(val) ? val : [];
      const otherText = answers[`${field.name}__other`] || "";
      const toggleCheck = (opt: string) => {
        if (selected.includes(opt)) setAnswer(field.name, selected.filter((o: string) => o !== opt));
        else setAnswer(field.name, [...selected, opt]);
      };
      return (
        <>
          <div className={`pf-pills ${(field.options || []).length <= 9 ? 'pf-pills--grid3' : ''}`}>
            {(field.options || []).map((opt) => (
              <button
                key={opt}
                type="button"
                className={`pf-pill ${selected.includes(opt) ? 'pf-pill--active' : ''}`}
                onClick={() => toggleCheck(opt)}
              >
                {selected.includes(opt) && (
                  <svg className="pf-pill__check" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3,8.5 7,12 13,4" />
                  </svg>
                )}
                {opt}
              </button>
            ))}
            {otherEnabledFor(field) && (
              <button
                type="button"
                className={`pf-pill ${selected.includes('__other__') ? 'pf-pill--active' : ''}`}
                onClick={() => toggleCheck('__other__')}
              >
                {selected.includes('__other__') && (
                  <svg className="pf-pill__check" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3,8.5 7,12 13,4" />
                  </svg>
                )}
                Lainnya
              </button>
            )}
          </div>
          {selected.includes('__other__') && (
            <div className="pf-other-input">
              <label>Tulis di sini</label>
              <input
                className="pf-input"
                type="text"
                placeholder="Sebutkan..."
                value={otherText}
                onChange={e => setAnswer(`${field.name}__other`, e.target.value)}
                autoFocus
              />
            </div>
          )}
        </>
      );
    }

    // ── Select dropdown ──
    if (field.type === 'select') {
      return (
        <select className={`pf-input ${errors[field.name] ? 'pf-input--error' : ''}`} value={val || ""} onChange={(e) => setAnswer(field.name, e.target.value)}>
          <option value="">-- Pilih --</option>
          {(field.options || []).map((opt) => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      );
    }

    // ── Textarea ──
    if (field.type === 'textarea') {
      return (
        <textarea className={`pf-input ${errors[field.name] ? 'pf-input--error' : ''}`} placeholder={field.placeholder} rows={4} value={val || ""} onChange={(e) => setAnswer(field.name, e.target.value)} />
      );
    }

    // ── WhatsApp / Tel (special: +62 prefix) ──
    if (field.type === 'tel') {
      return (
        <div className={`pf-wa-affix ${errors[field.name] ? 'pf-wa-affix--error' : ''}`}>
          <div className="pf-wa-prefix">+62</div>
          <input
            className="pf-input"
            type="tel"
            inputMode="numeric"
            maxLength={13}
            placeholder=""
            value={val || ""}
            onChange={(e) => setAnswer(field.name, e.target.value.replace(/\D/g, "").replace(/^0+/, "").slice(0, 13))}
          />
        </div>
      );
    }

    // ── Date (dd/mm/yyyy text input) ──
    if (field.type === 'date') {
      // Internal storage = yyyy-mm-dd, display = dd/mm/yyyy
      const isoToDisplay = (iso: string) => {
        if (!iso) return '';
        const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
      };
      const displayToIso = (display: string) => {
        const m = display.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
      };
      const handleDateInput = (raw: string) => {
        // Strip non-digits
        let digits = raw.replace(/\D/g, '');
        if (digits.length > 8) digits = digits.slice(0, 8);
        // Auto-insert slashes
        let formatted = '';
        if (digits.length > 4) {
          formatted = digits.slice(0, 2) + '/' + digits.slice(2, 4) + '/' + digits.slice(4);
        } else if (digits.length > 2) {
          formatted = digits.slice(0, 2) + '/' + digits.slice(2);
        } else {
          formatted = digits;
        }
        // If complete dd/mm/yyyy, save as ISO
        const iso = displayToIso(formatted);
        if (iso) {
          setAnswer(field.name, iso);
        } else {
          // Store temp display value
          setAnswer(field.name, '__display:' + formatted);
        }
      };
      const currentDisplay = val?.startsWith?.('__display:') ? val.slice(10) : isoToDisplay(val || '');
      return (
        <input
          type="text"
          inputMode="numeric"
          className={`pf-input ${errors[field.name] ? 'pf-input--error' : ''}`}
          placeholder="dd/mm/yyyy"
          value={currentDisplay}
          onChange={(e) => handleDateInput(e.target.value)}
          maxLength={10}
        />
      );
    }

    // ── Default: text, number, etc ──
    return (
      <input 
        type={field.type} 
        className={`pf-input ${errors[field.name] ? 'pf-input--error' : ''}`} 
        placeholder={field.placeholder || "Jawaban Anda..."} 
        value={val || ""} 
        onChange={(e) => setAnswer(field.name, e.target.value)} 
      />
    );
  };

  if (authLoading || loadingForm || !user) {
    return (
      <div className="pf-page">
        <div style={{ textAlign: "center", marginTop: "100px" }}>
           <div className="pf-spinner" style={{width: 40, height: 40, borderTopColor: "#cc0000", margin: "0 auto 20px"}}/>
           <p>Memuat profil...</p>
        </div>
      </div>
    );
  }

  if (!activeForm) {
    return (
      <div className="pf-page">
        <div style={{ textAlign: "center", marginTop: "100px", color: "#666" }}>
           <h2>Mohon Maaf</h2>
           <p>Formulir pendaftaran sedang tidak tersedia atau belum dikonfigurasi oleh tim IODA.</p>
        </div>
      </div>
    );
  }

  const progressPct = getProgressPct();

  // Render fields for a single section (no card wrapper)
  const renderSectionFields = (sectionIdx: number) => {
    const section = activeForm!.sections[sectionIdx];
    return (
      <div key={section.id}>
        {/* Partner Code — selalu tampil di section pertama untuk kemitraan */}
        {sectionIdx === 0 && isKemitraan && (
          <div className="pf-partner-block">
            <label className="pf-label">
              <Building2 size={18} color="#64748b" />
              <span>Kode Mitra Kampus / Institusi <span className="yr-req">*</span></span>
            </label>
            <div className="pf-partner-row">
              <div className="pf-partner-input-wrap">
                <input 
                  className={`pf-input ${errors.partnerCode ? 'pf-input--error' : ''}`} 
                  type="text" 
                  placeholder="Contoh: UNJ2024" 
                  value={partnerCode} 
                  onChange={(e) => { setPartnerCode(e.target.value.toUpperCase()); setPartnerCodeValid(false); setErrors((p) => ({ ...p, partnerCode: "" })); }} 
                  disabled={partnerCodeValid}
                  style={partnerCodeValid ? { backgroundColor: "#f1f5f9", color: "#737373", borderColor: "#cbd5e1" } : undefined}
                />
                {partnerCodeValid && (
                  <div className="pf-partner-check">
                    <CheckCircle2 size={20} color="#10b981" />
                  </div>
                )}
              </div>
              {!partnerCodeValid ? (
                <button type="button" className="pf-partner-validate-btn" onClick={validatePartnerCode} disabled={validatingCode || !partnerCode}>
                  {validatingCode ? "Memeriksa..." : "Validasi"}
                </button>
              ) : (
                <div className="pf-partner-verified">
                  <ShieldCheck size={18} />
                  Terverifikasi
                </div>
              )}
            </div>
            {errors.partnerCode && <div className="pf-error" data-field-error>{errors.partnerCode}</div>}
            {partnerCodeValid && <div className="pf-partner-msg pf-partner-msg--success">✨ Bagus! Kamu telah terhubung dengan mitra yang sah.</div>}
            {!partnerCodeValid && partnerCode && !errors.partnerCode && <div className="pf-partner-msg pf-partner-msg--info">ℹ️ Pastikan untuk menekan tombol &quot;Validasi&quot; agar kodemu diverifikasi.</div>}
          </div>
        )}

        {section.fields.map((field) => {
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

          if (field.dependsOn) {
            const dependentVal = answers[field.dependsOn];
            if (Array.isArray(dependentVal)) {
              if (!dependentVal.includes(field.dependsOnValue)) return null;
            } else {
              if (dependentVal !== field.dependsOnValue) return null;
            }
          }

          const isConditional = !!field.dependsOn;

          return (
            <div key={field.id} className="pf-field-group">
              {isConditional ? (
                <div className="pf-reveal">
                  <div className="pf-reveal__head">
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M8 13.5s-5-3-5-7a3 3 0 0 1 5-2.2A3 3 0 0 1 13 6.5c0 4-5 7-5 7z" />
                    </svg>
                    {field.label} {field.required && <span className="yr-req">*</span>}
                  </div>
                  {field.description && (
                    <div className="pf-field-desc" dangerouslySetInnerHTML={{ __html: field.description }} />
                  )}
                  {renderField(field, section)}
                  {field.note && <div className="pf-field-note">{field.note}</div>}
                  {errors[field.name] && <div className="pf-error" data-field-error>{errors[field.name]}</div>}
                </div>
              ) : (
                <>
                  <label className="pf-label">
                    {field.label} {field.required && <span className="yr-req">*</span>}
                  </label>
                  {field.description && (
                    <div className="pf-field-desc" dangerouslySetInnerHTML={{ __html: field.description }} />
                  )}
                  {renderField(field, section)}
                  {field.note && <div className="pf-field-note">{field.note}</div>}
                  {errors[field.name] && <div className="pf-error" data-field-error>{errors[field.name]}</div>}
                </>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // Render current page — all sections in ONE card
  const renderCurrentPage = () => {
    if (currentSectionIndices.length === 0) return null;
    const firstSection = activeForm!.sections[currentSectionIndices[0]];

    return (
      <div className="pf-card" style={{ marginBottom: 16 }}>
        <div className="pf-card__head">
          <h2>{firstSection.title}</h2>
          {firstSection.description && <p>{firstSection.description}</p>}
        </div>
        
        <div className="pf-card__body">
          {saved && (
            <div className="pf-success">
              ✅ Data berhasil disimpan! Mengarahkan ke kursus...
            </div>
          )}

          {currentSectionIndices.map(sectionIdx => renderSectionFields(sectionIdx))}

          {/* Blocked info — inline inside card */}
          {blocked && (
            <div className="pf-blocked-inline">
              <p className="pf-blocked-inline__title">Form tidak bisa dilanjutkan</p>
              <p className="pf-blocked-inline__body">
                Tidak apa-apa. Kami butuh persetujuanmu dulu sebelum lanjut. Kamu bisa balik kapan saja.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Check if current page is auto-advance (all sections on this page must be auto-advance)
  const isCurrentPageAutoAdvance = currentSectionIndices.length === 1 && 
    canAutoAdvance(activeForm.sections[currentSectionIndices[0]]);

  return (
    <div className="pf-page">
      {/* ─── Progress Bar ─── */}
      <div className="pf-progress">
        <span className="pf-progress__bar"><span style={{ width: `${progressPct}%` }} /></span>
        <span className="pf-progress__label">{progressPct}%</span>
      </div>

      <div className="pf-header">
        <h1 className="pf-title">
          {profile?.profileCompleted ? "Perbarui Informasi Data Diri" : "Lengkapi Pendaftaran"}
        </h1>
        {currentPageIdx === 0 && !profile?.profileCompleted && (
          <p className="pf-subtitle" style={{ fontSize: "12px", color: "var(--color-gray-500)", marginTop: 4 }}>
            Isi formulir di bawah ini. ~30 detik.
          </p>
        )}
      </div>

      {/* ═══ FORM SECTIONS ═══ */}
      <form onSubmit={isLastPage ? handleSubmit : (e) => { e.preventDefault(); handleNext(); }} noValidate>
        {renderCurrentPage()}

        {errors.submit && <div className="pf-error" style={{ display: "block", marginTop: "12px", maxWidth: 600, width: "100%" }}>{errors.submit}</div>}

        {/* Navigation buttons — hide for auto-advance sections or when blocked */}
        {!isCurrentPageAutoAdvance && !blocked && (
          <div className="pf-btn-row" style={{ maxWidth: 600, width: "100%" }}>
            {currentPageIdx > 0 && (
              <button type="button" className="pf-back-btn" onClick={handlePrev}>
                Kembali
              </button>
            )}
            <button className="pf-submit-btn" type="submit" disabled={submitting}>
              {submitting ? (<><div className="pf-spinner" />Menyimpan...</>) : (
                <>{isLastPage ? (profile?.profileCompleted ? "Simpan Perubahan" : "Simpan & Mulai Belajar") : "Selanjutnya"} <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="18" height="18"><path d="M5 12h14M12 5l7 7-7 7" /></svg></>
              )}
            </button>
          </div>
        )}
      </form>

      {/* Page indicator dots */}
      {pages.length > 1 && (
        <div className="pf-step-progress">
          {pages.map((_, idx) => (
            <div key={idx} className="pf-step-pill">
              <div className={`pf-step-bar ${idx <= currentPageIdx ? 'pf-step-bar--active' : ''}`} />
              <span className={`pf-step-num ${idx <= currentPageIdx ? 'pf-step-num--active' : ''}`}>
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
      <div className="pf-page">
        <div style={{ textAlign: "center", marginTop: "100px" }}>
          <div className="pf-spinner" style={{width: 40, height: 40, borderTopColor: "#cc0000", margin: "0 auto 20px"}}/>
          <p>Memuat halaman...</p>
        </div>
      </div>
    }>
      <ProfileContent />
    </Suspense>
  );
}
