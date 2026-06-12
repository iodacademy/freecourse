"use client";

import { useState } from "react";

interface StandaloneIdentityFormProps {
  onSubmit: (data: any) => void;
  isLoading: boolean;
}

export default function StandaloneIdentityForm({ onSubmit, isLoading }: StandaloneIdentityFormProps) {
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const setAnswer = (key: string, value: any) => {
    setAnswers(prev => ({ ...prev, [key]: value }));
    setErrors(prev => { const next = { ...prev }; delete next[key]; return next; });
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    const requiredFields = [
      "apakah_anda_setuju_dan_bersedia_untuk_mengisi_data_pada_form_ini",
      "nama_lengkap",
      "jenis_kelamin",
      "tanggal_lahir",
      "alamat_email",
      "nomor_whatsapp",
      "asal_daerah",
      "disabilitas",
      "jika_diberikan_kesempatan_pelatihan_bidang_apa_yang_paling_anda_minati"
    ];

    if (answers.apakah_anda_setuju_dan_bersedia_untuk_mengisi_data_pada_form_ini === "Tidak") {
      errs.apakah_anda_setuju_dan_bersedia_untuk_mengisi_data_pada_form_ini = "Anda harus menyetujui untuk melanjutkan";
    }

    requiredFields.forEach(f => {
      if (!answers[f] || (typeof answers[f] === "string" && answers[f].trim() === "")) {
        errs[f] = "Wajib diisi";
      }
    });

    if (answers.tanggal_lahir) {
      const m = String(answers.tanggal_lahir).match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (m) {
        const birth = new Date(`${m[1]}-${m[2]}-${m[3]}`);
        const now = new Date();
        let age = now.getFullYear() - birth.getFullYear();
        const md = now.getMonth() - birth.getMonth();
        if (md < 0 || (md === 0 && now.getDate() < birth.getDate())) age--;
        
        if (age < 18 || age > 29) {
          errs.tanggal_lahir = `Usia yang diperbolehkan adalah 18-29 tahun (Usia saat ini: ${age} tahun)`;
        }
      }
    }

    if (answers.disabilitas === "Ya") {
      if (!answers.kategori_disabilitas_yang_anda_miliki) {
        errs.kategori_disabilitas_yang_anda_miliki = "Wajib dipilih";
      } else if (answers.kategori_disabilitas_yang_anda_miliki === "__other__" && !answers.kategori_disabilitas_yang_anda_miliki__other) {
        errs.kategori_disabilitas_yang_anda_miliki = "Kolom lainnya wajib diisi";
      }
    }

    // Minat khusus handling (checkbox)
    if (!answers.jika_diberikan_kesempatan_pelatihan_bidang_apa_yang_paling_anda_minati || answers.jika_diberikan_kesempatan_pelatihan_bidang_apa_yang_paling_anda_minati.length === 0) {
      errs.jika_diberikan_kesempatan_pelatihan_bidang_apa_yang_paling_anda_minati = "Wajib dipilih minimal satu";
    } else if (
      answers.jika_diberikan_kesempatan_pelatihan_bidang_apa_yang_paling_anda_minati.includes("__other__") && 
      !answers.jika_diberikan_kesempatan_pelatihan_bidang_apa_yang_paling_anda_minati__other
    ) {
      errs.jika_diberikan_kesempatan_pelatihan_bidang_apa_yang_paling_anda_minati = "Kolom lainnya wajib diisi";
    }

    return errs;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      document.querySelector(".pf-error")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    // Resolusi "__other__" sebelum disubmit
    const payload = { ...answers };
    
    if (payload.kategori_disabilitas_yang_anda_miliki === "__other__") {
      payload.kategori_disabilitas_yang_anda_miliki = payload.kategori_disabilitas_yang_anda_miliki__other;
    }
    
    if (Array.isArray(payload.jika_diberikan_kesempatan_pelatihan_bidang_apa_yang_paling_anda_minati)) {
      payload.jika_diberikan_kesempatan_pelatihan_bidang_apa_yang_paling_anda_minati = payload.jika_diberikan_kesempatan_pelatihan_bidang_apa_yang_paling_anda_minati.map((v: string) => 
        v === "__other__" ? payload.jika_diberikan_kesempatan_pelatihan_bidang_apa_yang_paling_anda_minati__other : v
      );
    }

    onSubmit(payload);
  };

  // Helper untuk Checkbox Pills
  const toggleMinat = (opt: string) => {
    const selected = answers.jika_diberikan_kesempatan_pelatihan_bidang_apa_yang_paling_anda_minati || [];
    if (selected.includes(opt)) {
      setAnswer("jika_diberikan_kesempatan_pelatihan_bidang_apa_yang_paling_anda_minati", selected.filter((o: string) => o !== opt));
    } else {
      setAnswer("jika_diberikan_kesempatan_pelatihan_bidang_apa_yang_paling_anda_minati", [...selected, opt]);
    }
  };

  return (
    <div className="pf-page" style={{ padding: 0, minHeight: "auto", background: "transparent" }}>
      <form onSubmit={handleSubmit} noValidate>
        
        {/* SECTION: Persetujuan */}
        <div className="pf-card" style={{ marginBottom: 24 }}>
          <div className="pf-card__head">
            <h2>Pernyataan Persetujuan Mengisi Form</h2>
          </div>
          <div className="pf-card__body">
            <div className="pf-field-group">
              <label className="pf-label">
                Apakah Anda setuju dan bersedia untuk mengisi data pada form ini? <span className="yr-req">*</span>
              </label>
              <div className="pf-field-desc">
                <div>Dengan memberikan persetujuan, Anda memahami bahwa:</div>
                <ol style={{ paddingLeft: 20, margin: 0 }}>
                  <li>Data yang diberikan akan digunakan untuk keperluan pelatihan dan pengembangan kompetensi.</li>
                  <li>Data ini bersifat rahasia dan tidak akan dibagikan kepada pihak lain tanpa izin.</li>
                  <li>Anda berhak untuk tidak menjawab pertanyaan tertentu jika merasa tidak nyaman.</li>
                  <li>Anda dapat mengundurkan diri dari form ini kapan saja tanpa konsekuensi apa pun.</li>
                </ol>
              </div>
              <div className="pf-segmented" role="radiogroup">
                {["Ya", "Tidak"].map(opt => (
                  <button
                    key={opt}
                    type="button"
                    className={`pf-segmented__opt ${answers.apakah_anda_setuju_dan_bersedia_untuk_mengisi_data_pada_form_ini === opt ? 'pf-segmented__opt--active' : ''}`}
                    onClick={() => setAnswer("apakah_anda_setuju_dan_bersedia_untuk_mengisi_data_pada_form_ini", opt)}
                  >
                    {opt}
                  </button>
                ))}
              </div>
              {errors.apakah_anda_setuju_dan_bersedia_untuk_mengisi_data_pada_form_ini && <div className="pf-error">{errors.apakah_anda_setuju_dan_bersedia_untuk_mengisi_data_pada_form_ini}</div>}
            </div>
            {answers.apakah_anda_setuju_dan_bersedia_untuk_mengisi_data_pada_form_ini === "Tidak" && (
              <div className="pf-blocked-inline">
                <p className="pf-blocked-inline__title">Form tidak bisa dilanjutkan</p>
                <p className="pf-blocked-inline__body">
                  Tidak apa-apa. Kami butuh persetujuanmu dulu sebelum lanjut. Kamu bisa balik kapan saja.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* SECTION: Data Diri */}
        {answers.apakah_anda_setuju_dan_bersedia_untuk_mengisi_data_pada_form_ini === "Ya" && (
          <div className="pf-card" style={{ marginBottom: 24 }}>
            <div className="pf-card__head">
              <h2>Data diri</h2>
              <p>Mohon lengkapi data diri Anda di bawah ini.</p>
            </div>
            <div className="pf-card__body">
              
              <div className="pf-field-group">
                <label className="pf-label">Nama Lengkap (sesuai KTP/Kartu Identitas) <span className="yr-req">*</span></label>
                <input 
                  type="text" 
                  className={`pf-input ${errors.nama_lengkap ? 'pf-input--error' : ''}`}
                  value={answers.nama_lengkap || ""}
                  onChange={e => setAnswer("nama_lengkap", e.target.value)}
                />
                <div className="pf-field-note">Mohon pastikan nama benar karena akan digunakan di sertifikat.</div>
                {errors.nama_lengkap && <div className="pf-error">{errors.nama_lengkap}</div>}
              </div>

              <div className="pf-field-group">
                <label className="pf-label">Jenis Kelamin <span className="yr-req">*</span></label>
                <div className="pf-segmented" role="radiogroup">
                  {["Laki-laki", "Perempuan"].map(opt => (
                    <button
                      key={opt}
                      type="button"
                      className={`pf-segmented__opt ${answers.jenis_kelamin === opt ? 'pf-segmented__opt--active' : ''}`}
                      onClick={() => setAnswer("jenis_kelamin", opt)}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
                {errors.jenis_kelamin && <div className="pf-error">{errors.jenis_kelamin}</div>}
              </div>

              <div className="pf-field-group">
                <label className="pf-label">Tanggal Lahir <span className="yr-req">*</span></label>
                <input 
                  type="date" 
                  className={`pf-input ${errors.tanggal_lahir ? 'pf-input--error' : ''}`}
                  value={answers.tanggal_lahir || ""}
                  onChange={e => setAnswer("tanggal_lahir", e.target.value)}
                />
                {errors.tanggal_lahir && <div className="pf-error">{errors.tanggal_lahir}</div>}
              </div>

              <div className="pf-field-group">
                <label className="pf-label">Alamat Email <span className="yr-req">*</span></label>
                <input 
                  type="email" 
                  className={`pf-input ${errors.alamat_email ? 'pf-input--error' : ''}`}
                  value={answers.alamat_email || ""}
                  onChange={e => setAnswer("alamat_email", e.target.value)}
                />
                {errors.alamat_email && <div className="pf-error">{errors.alamat_email}</div>}
              </div>

              <div className="pf-field-group">
                <label className="pf-label">Nomor WhatsApp / Telepon Aktif <span className="yr-req">*</span></label>
                <div className={`pf-wa-affix ${errors.nomor_whatsapp ? 'pf-wa-affix--error' : ''}`}>
                  <div className="pf-wa-prefix">+62</div>
                  <input
                    className="pf-input"
                    type="tel"
                    inputMode="numeric"
                    maxLength={13}
                    value={answers.nomor_whatsapp || ""}
                    onChange={e => setAnswer("nomor_whatsapp", e.target.value.replace(/\D/g, "").replace(/^0+/, "").slice(0, 13))}
                  />
                </div>
                {errors.nomor_whatsapp && <div className="pf-error">{errors.nomor_whatsapp}</div>}
              </div>

              <div className="pf-field-group">
                <label className="pf-label">Asal Daerah <span className="yr-req">*</span></label>
                <div className="pf-pills">
                  {[
                    "Jakarta Pusat", "Jakarta Timur", "Jakarta Barat", 
                    "Jakarta Selatan", "Jakarta Utara", "Bekasi", 
                    "Bogor", "Depok", "Tangerang", "Tangerang Selatan"
                  ].map(opt => (
                    <button
                      key={opt}
                      type="button"
                      className={`pf-pill ${answers.asal_daerah === opt ? 'pf-pill--active' : ''}`}
                      onClick={() => setAnswer("asal_daerah", opt)}
                    >
                      {answers.asal_daerah === opt && (
                        <svg className="pf-pill__check" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3,8.5 7,12 13,4" />
                        </svg>
                      )}
                      {opt}
                    </button>
                  ))}
                </div>
                {errors.asal_daerah && <div className="pf-error">{errors.asal_daerah}</div>}
              </div>

              <div className="pf-field-group">
                <label className="pf-label">Apakah Anda merupakan penyandang disabilitas? <span className="yr-req">*</span></label>
                <div className="pf-segmented" role="radiogroup">
                  {["Ya", "Tidak"].map(opt => (
                    <button
                      key={opt}
                      type="button"
                      className={`pf-segmented__opt ${answers.disabilitas === opt ? 'pf-segmented__opt--active' : ''}`}
                      onClick={() => {
                        setAnswer("disabilitas", opt);
                        if (opt === "Tidak") setAnswer("kategori_disabilitas_yang_anda_miliki", "");
                      }}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
                {errors.disabilitas && <div className="pf-error">{errors.disabilitas}</div>}
              </div>

              {answers.disabilitas === "Ya" && (
                <div className="pf-reveal">
                  <div className="pf-reveal__head">Kategori disabilitas yang Anda miliki <span className="yr-req">*</span></div>
                  <div className="pf-pills" role="radiogroup">
                    {[
                      "Disabilitas Fisik", "Disabilitas Sensorik Netra", 
                      "Disabilitas Sensorik Tuli", "Disabilitas Sensorik Wicara", 
                      "Disabilitas Mental", "Disabilitas Intelektual", "Disabilitas Ganda"
                    ].map(opt => (
                      <button
                        key={opt}
                        type="button"
                        className={`pf-pill ${answers.kategori_disabilitas_yang_anda_miliki === opt ? 'pf-pill--active' : ''}`}
                        onClick={() => setAnswer("kategori_disabilitas_yang_anda_miliki", opt)}
                      >
                        {answers.kategori_disabilitas_yang_anda_miliki === opt && (
                          <svg className="pf-pill__check" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3,8.5 7,12 13,4" />
                          </svg>
                        )}
                        {opt}
                      </button>
                    ))}
                    
                    {/* Allow Other */}
                    <button
                      type="button"
                      className={`pf-pill ${answers.kategori_disabilitas_yang_anda_miliki === "__other__" ? 'pf-pill--active' : ''}`}
                      onClick={() => setAnswer("kategori_disabilitas_yang_anda_miliki", "__other__")}
                    >
                      {answers.kategori_disabilitas_yang_anda_miliki === "__other__" && (
                        <svg className="pf-pill__check" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3,8.5 7,12 13,4" />
                        </svg>
                      )}
                      Lainnya
                    </button>
                  </div>
                  
                  {answers.kategori_disabilitas_yang_anda_miliki === "__other__" && (
                    <div className="pf-other-input">
                      <label>Tulis di sini</label>
                      <input
                        className="pf-input"
                        type="text"
                        placeholder="Sebutkan..."
                        value={answers.kategori_disabilitas_yang_anda_miliki__other || ""}
                        onChange={e => setAnswer("kategori_disabilitas_yang_anda_miliki__other", e.target.value)}
                        autoFocus
                      />
                    </div>
                  )}

                  {errors.kategori_disabilitas_yang_anda_miliki && <div className="pf-error">{errors.kategori_disabilitas_yang_anda_miliki}</div>}
                </div>
              )}

              <hr style={{ margin: "32px 0", border: "none", borderTop: "1px dashed var(--color-gray-200)" }} />

              <div className="pf-field-group">
                <label className="pf-label">Jika diberikan kesempatan pelatihan, bidang apa yang paling Anda minati? <span className="yr-req">*</span></label>
                <div className="pf-pills">
                  {[
                    "Hospitality", "Retail", "Desain Grafis", "UI/UX", "Social Media Marketing"
                  ].map(opt => {
                    const isSelected = (answers.jika_diberikan_kesempatan_pelatihan_bidang_apa_yang_paling_anda_minati || []).includes(opt);
                    return (
                      <button
                        key={opt}
                        type="button"
                        className={`pf-pill ${isSelected ? 'pf-pill--active' : ''}`}
                        onClick={() => toggleMinat(opt)}
                      >
                        {isSelected && (
                          <svg className="pf-pill__check" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3,8.5 7,12 13,4" />
                          </svg>
                        )}
                        {opt}
                      </button>
                    );
                  })}
                  
                  {/* Allow Other untuk Minat */}
                  <button
                    type="button"
                    className={`pf-pill ${(answers.jika_diberikan_kesempatan_pelatihan_bidang_apa_yang_paling_anda_minati || []).includes("__other__") ? 'pf-pill--active' : ''}`}
                    onClick={() => toggleMinat("__other__")}
                  >
                    {(answers.jika_diberikan_kesempatan_pelatihan_bidang_apa_yang_paling_anda_minati || []).includes("__other__") && (
                      <svg className="pf-pill__check" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3,8.5 7,12 13,4" />
                      </svg>
                    )}
                    Lainnya
                  </button>
                </div>

                {(answers.jika_diberikan_kesempatan_pelatihan_bidang_apa_yang_paling_anda_minati || []).includes("__other__") && (
                  <div className="pf-other-input">
                    <label>Tulis di sini</label>
                    <input
                      className="pf-input"
                      type="text"
                      placeholder="Sebutkan..."
                      value={answers.jika_diberikan_kesempatan_pelatihan_bidang_apa_yang_paling_anda_minati__other || ""}
                      onChange={e => setAnswer("jika_diberikan_kesempatan_pelatihan_bidang_apa_yang_paling_anda_minati__other", e.target.value)}
                      autoFocus
                    />
                  </div>
                )}

                {errors.jika_diberikan_kesempatan_pelatihan_bidang_apa_yang_paling_anda_minati && <div className="pf-error">{errors.jika_diberikan_kesempatan_pelatihan_bidang_apa_yang_paling_anda_minati}</div>}
              </div>

            </div>
          </div>
        )}

        {/* SUBMIT BUTTON */}
        {answers.apakah_anda_setuju_dan_bersedia_untuk_mengisi_data_pada_form_ini === "Ya" && (
          <div className="pf-btn-row">
            <button className="pf-submit-btn" type="submit" disabled={isLoading} style={{ width: "100%" }}>
              {isLoading ? (
                <><div className="pf-spinner" /> Menyimpan...</>
              ) : (
                <>Selanjutnya <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="18" height="18"><path d="M5 12h14M12 5l7 7-7 7" /></svg></>
              )}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
