import React, { useState } from "react";
import { X } from "lucide-react";
import styles from "./preview.module.css";
import { DynamicForm, DynamicFormField } from "@/lib/types";
import { WILAYAH_INDONESIA } from "@/lib/wilayah";
import SearchableSelect from "@/components/SearchableSelect";

interface PreviewModalProps {
  form: DynamicForm;
  onClose: () => void;
}

export default function PreviewModal({ form, onClose }: PreviewModalProps) {
  const [currentSectionIdx, setCurrentSectionIdx] = useState(0);
  const [previewAnswers, setPreviewAnswers] = useState<Record<string, any>>({});
  const section = form.sections[currentSectionIdx];

  const handleNext = () => {
    if (currentSectionIdx < form.sections.length - 1) {
      setCurrentSectionIdx(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentSectionIdx > 0) {
      setCurrentSectionIdx(prev => prev - 1);
    }
  };

  const setAnswer = (key: string, value: any) => {
    setPreviewAnswers(prev => ({ ...prev, [key]: value }));
  };

  const renderField = (field: DynamicFormField) => {
    const val = previewAnswers[field.name];
    
    // For preview, we don't need real state binding for inputs, just UI look
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
              className={styles.fieldInput}
              options={provList}
              value={prov}
              onChange={(v) => setPreviewAnswers(prev => ({ ...prev, [field.name]: { province: v, city: "" } }))}
              placeholder="Cari atau pilih provinsi"
            />
          </div>
          <div className={styles.fieldGroup} style={{ marginBottom: 0 }}>
            <label className={styles.fieldLabel}>Kota / Kabupaten{field.required && <span className={styles.req}>*</span>}</label>
            <SearchableSelect 
              className={styles.fieldInput}
              options={kotaList}
              value={city}
              onChange={(v) => setPreviewAnswers(prev => ({ ...prev, [field.name]: { province: prov, city: v } }))}
              placeholder="Pilih dulu provinsi"
              disabled={!prov}
            />
          </div>
        </div>
      );
    }

    if (field.type === 'radio') {
      const otherText = previewAnswers[`${field.name}__other`] || "";
      return (
        <div className={styles.radioGroup}>
          {(field.options || []).map((opt) => (
            <div 
              key={opt} 
              className={`${styles.radioOpt} ${val === opt ? styles.radioSel : ""}`} 
              onClick={() => setAnswer(field.name, opt)}
            >
              <div className={styles.radioCircle}><div className={styles.radioDot} /></div>
              <span className={styles.radioLabel}>{opt}</span>
              {field.usePoints && field.optionPoints?.[opt] != null && (
                <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, color: "#059669" }}>
                  {field.optionPoints[opt]} poin
                </span>
              )}
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
                  className={styles.otherInput}
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
      const otherText = previewAnswers[`${field.name}__other`] || "";
      const toggleCheck = (opt: string) => {
        if (selected.includes(opt)) setAnswer(field.name, selected.filter((o: string) => o !== opt));
        else setAnswer(field.name, [...selected, opt]);
      };
      return (
        <div className={styles.checkboxList}>
          {(field.options || []).map((opt) => (
            <div 
              key={opt} 
              className={`${styles.chkItem} ${selected.includes(opt) ? styles.chkSel : ""}`} 
              onClick={() => toggleCheck(opt)}
            >
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
                  className={styles.otherInput}
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
        <select className={styles.fieldInput} value={val || ""} onChange={(e) => setAnswer(field.name, e.target.value)}>
          <option value="">-- Pilih --</option>
          {(field.options || []).map((opt) => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      );
    }

    if (field.type === 'textarea') {
      return <textarea className={styles.fieldInput} placeholder={field.placeholder || "Ketik jawaban Anda..."} rows={4} value={val || ""} onChange={(e) => setAnswer(field.name, e.target.value)} />;
    }

    return (
      <input 
        type={field.type} 
        className={styles.fieldInput} 
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

  if (!section) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
        <button className={styles.closeBtn} onClick={onClose}>
          <X size={18} />
        </button>

        <div className={styles.cardHead}>
          <h2>{section.title}</h2>
          {section.description && <p>{section.description}</p>}
        </div>

        <div className={styles.cardBody}>
          <div className={styles.reqNote}><span className={styles.req}>*</span> Menunjukkan pertanyaan yang wajib diisi</div>
          
          {section.fields
            .filter((field) => !field.dependsOn || previewAnswers[field.dependsOn] === field.dependsOnValue)
            .map((field) => (
            <div key={field.id} className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>
                {field.label}
                {field.required && <span className={styles.req}>*</span>}
              </label>
              {field.description && (
                <div
                  className={styles.fieldHint}
                  dangerouslySetInnerHTML={{ __html: field.description }}
                />
              )}
              {renderField(field)}
            </div>
          ))}

          <div style={{ display: "flex", gap: "10px", marginTop: "30px" }}>
            {currentSectionIdx > 0 && (
              <button 
                type="button" 
                onClick={handlePrev}
                className={styles.submitBtn} 
                style={{ background: "#f0f0f0", color: "#333", flex: 1 }}
              >
                Kembali
              </button>
            )}
            {currentSectionIdx < form.sections.length - 1 ? (
              <button type="button" onClick={handleNext} className={styles.submitBtn} style={{ flex: 1, margin: 0 }}>
                Lanjut
              </button>
            ) : (
              <button type="button" className={styles.submitBtn} style={{ flex: 1, margin: 0 }} onClick={onClose}>
                Tutup Preview
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
