"use client";

import { useState, useEffect, useRef, use } from "react";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";
import { ArrowLeft, Plus, Trash2, GripVertical, Settings2, Save, Circle, ChevronDown, ChevronUp, AlignLeft } from "lucide-react";
import RichTextEditor from "@/components/RichTextEditor/RichTextEditor";
import { useAuth } from "@/contexts/AuthContext";
import type { DynamicForm, DynamicFormSection, DynamicFormField } from "@/lib/types";
import Link from "next/link";
import { ConfirmDialog, AlertDialog } from "@/components/Modal/Dialogs";

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

function slugify(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '');
}
/* ─── Custom Condition Select ─── */
type CondOption = { value: string; label: string };
function CondSelect({
  value, onChange, options, placeholder = '-- Selalu Tampil --'
}: {
  value: string;
  onChange: (v: string) => void;
  options: CondOption[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected = options.find(o => o.value === value);
  const displayLabel = selected?.label || placeholder;

  return (
    <div ref={ref} className={styles.condDropWrap}>
      <button
        type="button"
        className={`${styles.condTrigger} ${open ? styles.condTriggerOpen : ''}`}
        onClick={() => setOpen(p => !p)}
      >
        <span className={styles.condTriggerText}>{displayLabel}</span>
        <ChevronDown size={12} className={styles.condChev} />
      </button>
      {open && (
        <div className={styles.condPanel}>
          <button
            type="button"
            className={`${styles.condOpt} ${!value ? styles.condOptActive : ''}`}
            onClick={() => { onChange(''); setOpen(false); }}
          >
            {placeholder}
          </button>
          {options.map(opt => (
            <button
              key={opt.value}
              type="button"
              className={`${styles.condOpt} ${opt.value === value ? styles.condOptActive : ''}`}
              onClick={() => { onChange(opt.value); setOpen(false); }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function FormBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  
  const [form, setForm] = useState<DynamicForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [alertMsg, setAlertMsg] = useState("");
  const [confirmDeleteSecId, setConfirmDeleteSecId] = useState<string | null>(null);

  const [minimizedSections, setMinimizedSections] = useState<Set<string>>(new Set());
  const [draggedSectionIdx, setDraggedSectionIdx] = useState<number | null>(null);
  const [draggedField, setDraggedField] = useState<{sIdx: number, fIdx: number} | null>(null);

  const toggleMinimize = (secId: string) => {
    const next = new Set(minimizedSections);
    if (next.has(secId)) next.delete(secId);
    else next.add(secId);
    setMinimizedSections(next);
  };

  const handleSectionDragStart = (e: React.DragEvent, sIdx: number) => {
    e.dataTransfer.effectAllowed = "move";
    setDraggedSectionIdx(sIdx);
  };
  
  const handleSectionDrop = (e: React.DragEvent, targetSIdx: number) => {
    e.preventDefault();
    if (draggedSectionIdx === null || draggedSectionIdx === targetSIdx) return;
    if (!form) return;
    
    const newSections = [...form.sections];
    const [moved] = newSections.splice(draggedSectionIdx, 1);
    newSections.splice(targetSIdx, 0, moved);
    setForm({...form, sections: newSections});
    setDraggedSectionIdx(null);
  };

  const handleFieldDragStart = (e: React.DragEvent, sIdx: number, fIdx: number) => {
    e.stopPropagation();
    e.dataTransfer.effectAllowed = "move";
    setDraggedField({ sIdx, fIdx });
  };

  const handleFieldDrop = (e: React.DragEvent, targetSIdx: number, targetFIdx: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedField || !form) return;
    const { sIdx: sourceSIdx, fIdx: sourceFIdx } = draggedField;
    if (sourceSIdx === targetSIdx && sourceFIdx === targetFIdx) return;

    const newSections = JSON.parse(JSON.stringify(form.sections)) as DynamicFormSection[];
    const [movedField] = newSections[sourceSIdx].fields.splice(sourceFIdx, 1);
    newSections[targetSIdx].fields.splice(targetFIdx, 0, movedField);

    setForm({...form, sections: newSections});
    setDraggedField(null);
  };

  const getAllPreviousFields = (currentSIdx: number, currentFIdx: number) => {
    if (!form) return [];
    const fields: DynamicFormField[] = [];
    for (let i = 0; i <= currentSIdx; i++) {
      const sec = form.sections[i];
      const limit = i === currentSIdx ? currentFIdx : sec.fields.length;
      for (let j = 0; j < limit; j++) {
        fields.push(sec.fields[j]);
      }
    }
    return fields;
  };

  useEffect(() => {
    if (!user) return;
    fetchForm();
  }, [user]);

  async function fetchForm() {
    try {
      const idToken = await user?.getIdToken();
      // We don't have a GET /api/admin/forms/[id] yet, let's fetch all and filter for now
      // Or I can just write it. Wait, actually I didn't write GET [id]...
      const res = await fetch("/api/admin/forms", {
        headers: { Authorization: `Bearer ${idToken}` }
      });
      if (!res.ok) throw new Error("Gagal mengambil form");
      const data: DynamicForm[] = await res.json();
      const current = data.find(f => f.id === id);
      if (current) {
        setForm(current);
      } else {
        setAlertMsg("Form tidak ditemukan");
        router.push("/admin/settings/forms");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function saveForm() {
    if (!form) return;
    setSaving(true);
    try {
      const idToken = await user?.getIdToken();
      const res = await fetch(`/api/admin/forms/${form.id}`, {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}` 
        },
        body: JSON.stringify({
          title: form.title,
          sections: form.sections
        })
      });
      if (!res.ok) throw new Error("Gagal menyimpan form");
      setAlertMsg("Form berhasil disimpan!");
    } catch (e) {
      console.error(e);
      setAlertMsg("Gagal menyimpan form");
    } finally {
      setSaving(false);
    }
  }

  const addSection = () => {
    if (!form) return;
    const newSection: DynamicFormSection = {
      id: generateId(),
      title: "Seksi Baru",
      fields: []
    };
    setForm({ ...form, sections: [...form.sections, newSection] });
  };

  const updateSection = (secId: string, updates: Partial<DynamicFormSection>) => {
    if (!form) return;
    setForm({
      ...form,
      sections: form.sections.map(s => s.id === secId ? { ...s, ...updates } : s)
    });
  };

  const confirmDeleteSection = (secId: string) => {
    setConfirmDeleteSecId(secId);
  };

  const deleteSection = () => {
    if (!form || !confirmDeleteSecId) return;
    setForm({
      ...form,
      sections: form.sections.filter(s => s.id !== confirmDeleteSecId)
    });
    setConfirmDeleteSecId(null);
  };

  const addField = (secId: string) => {
    if (!form) return;
    const newField: DynamicFormField = {
      id: generateId(),
      name: `field_${generateId()}`,
      label: "Pertanyaan Baru",
      type: "text",
      required: false
    };
    setForm({
      ...form,
      sections: form.sections.map(s => 
        s.id === secId ? { ...s, fields: [...s.fields, newField] } : s
      )
    });
  };

  const updateField = (secId: string, fieldId: string, updates: Partial<DynamicFormField>) => {
    if (!form) return;
    setForm({
      ...form,
      sections: form.sections.map(s => 
        s.id === secId 
          ? { ...s, fields: s.fields.map(f => f.id === fieldId ? { ...f, ...updates } : f) } 
          : s
      )
    });
  };

  const updateFieldLabel = (secId: string, fieldId: string, newLabel: string, currentName: string, currentLabel: string) => {
    if (!form) return;
    const updates: Partial<DynamicFormField> = { label: newLabel };
    
    // Auto-update variable name (ID) if it's default or if it perfectly matches the slugified previous label
    if (currentName.startsWith('field_') || currentName === slugify(currentLabel) || !currentName) {
      updates.name = slugify(newLabel) || currentName;
    }
    
    updateField(secId, fieldId, updates);
  };

  const deleteField = (secId: string, fieldId: string) => {
    if (!form) return;
    setForm({
      ...form,
      sections: form.sections.map(s => 
        s.id === secId 
          ? { ...s, fields: s.fields.filter(f => f.id !== fieldId) } 
          : s
      )
    });
  };

  if (loading) return <div className={styles.page}>Memuat...</div>;
  if (!form) return null;

  return (
    <>
      <div className={styles.page}>
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <Link href="/admin/settings/forms" className={styles.backBtn}>
              <ArrowLeft size={20} />
            </Link>
            <div>
              <input 
                type="text"
                className={styles.titleInput}
                value={form.title}
                onChange={e => setForm({...form, title: e.target.value})}
                placeholder="Judul Form"
              />
              <p className={styles.subtitle}>
                ID: {form.id} {form.isActive && " • Aktif"}
              </p>
            </div>
          </div>
        </header>

        <div className={styles.saveAction}>
          <button 
            className={`btn btn-primary ${styles.saveBtn}`}
            onClick={saveForm} 
            disabled={saving}
          >
            <Save size={20} style={{ marginRight: 8, display: 'inline' }} />
            {saving ? "Menyimpan..." : "Simpan Form"}
          </button>
        </div>

        <div className={styles.builder}>
          {form.sections.map((section, sIdx) => {
            const isMinimized = minimizedSections.has(section.id);
            return (
            <div 
              key={section.id} 
              className={`${styles.sectionCard} ${isMinimized ? styles.minimized : ""}`}
              draggable
              onDragStart={(e) => handleSectionDragStart(e, sIdx)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleSectionDrop(e, sIdx)}
            >
              <div className={styles.sectionHeader}>
                <div className={styles.sectionDragHandle} style={{ cursor: 'grab', padding: '10px 10px 0 0', color: '#aaa' }}>
                  <GripVertical size={20} />
                </div>
                <div className={styles.sectionTitleBlock}>
                  <div className={styles.sectionBadge}>Seksi {sIdx + 1}</div>
                  <input
                    type="text"
                    className={styles.sectionTitleInput}
                    value={section.title}
                    onChange={e => updateSection(section.id, { title: e.target.value })}
                    placeholder="Judul Seksi"
                  />
                  <input
                    type="text"
                    className={styles.sectionDescInput}
                    value={section.description || ""}
                    onChange={e => updateSection(section.id, { description: e.target.value })}
                    placeholder="Deskripsi seksi (opsional)"
                  />
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className={styles.iconBtn} onClick={() => toggleMinimize(section.id)}>
                    {isMinimized ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
                  </button>
                  <button className={styles.iconBtn} onClick={() => confirmDeleteSection(section.id)}>
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              {!isMinimized && (
              <>
              <div className={styles.fieldsContainer}>
                {section.fields.map((field, fIdx) => {
                  const prevFields = getAllPreviousFields(sIdx, fIdx);
                  return (
                  <div 
                    key={field.id} 
                    className={styles.fieldRow}
                    draggable
                    onDragStart={(e) => handleFieldDragStart(e, sIdx, fIdx)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => handleFieldDrop(e, sIdx, fIdx)}
                  >
                    <div className={styles.fieldDrag}>
                      <GripVertical size={16} color="#aaa" />
                    </div>
                    <div className={styles.fieldBody}>
                      <div className={styles.fieldTop}>
                        <input
                          type="text"
                          className={styles.fieldLabelInput}
                          value={field.label}
                          onChange={e => updateFieldLabel(section.id, field.id, e.target.value, field.name, field.label)}
                          placeholder="Pertanyaan"
                        />
                        <select 
                          className={styles.typeSelect}
                          value={field.type}
                          onChange={e => updateField(section.id, field.id, { type: e.target.value as any })}
                        >
                          <option value="text">Teks Pendek</option>
                          <option value="textarea">Paragraf</option>
                          <option value="radio">Pilihan Ganda</option>
                          <option value="checkbox">Kotak Centang</option>
                          <option value="select">Dropdown</option>
                          <option value="date">Tanggal</option>
                          <option value="email">Email</option>
                          <option value="number">Angka</option>
                          <option value="tel">No. Telepon</option>
                          <option value="province_city">Provinsi & Kota</option>
                        </select>
                      </div>

                      {/* ── Deskripsi pertanyaan (tepat di bawah input label) ── */}
                      {field.description !== undefined && (
                        <div className={styles.descriptionBlock}>
                          <RichTextEditor
                            value={field.description}
                            onChange={val => updateField(section.id, field.id, { description: val })}
                            placeholder="Tulis deskripsi, instruksi, atau keterangan tambahan untuk pertanyaan ini..."
                          />
                        </div>
                      )}

                      <div className={styles.fieldSettings}>

                        <div className={styles.settingItem}>
                          <label>
                            <input
                              type="checkbox"
                              checked={field.required}
                              onChange={e => updateField(section.id, field.id, { required: e.target.checked })}
                            /> Wajib Diisi
                          </label>
                        </div>

                        <div className={styles.settingItem}>
                          <label style={{ color: '#374151', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <input
                              type="checkbox"
                              checked={field.description !== undefined}
                              onChange={e => updateField(section.id, field.id, {
                                description: e.target.checked ? (field.description ?? "") : undefined
                              })}
                            />
                            <AlignLeft size={13} style={{ opacity: 0.6 }} />
                            Tambah Deskripsi
                          </label>
                        </div>

                        {prevFields.length > 0 && (
                          <div className={styles.conditionRow}>
                            <span className={styles.condLabel}>Tampilkan jika:</span>
                            <CondSelect
                              value={field.dependsOn || ""}
                              onChange={v => updateField(section.id, field.id, { dependsOn: v, dependsOnValue: "" })}
                              options={prevFields.map(pf => ({ value: pf.name, label: pf.label }))}
                            />
                            {field.dependsOn && (() => {
                              const depField = prevFields.find(pf => pf.name === field.dependsOn);
                              const hasOptions = depField && ['radio', 'checkbox', 'select'].includes(depField.type) && (depField.options || []).length > 0;

                              return hasOptions ? (
                                <CondSelect
                                  value={field.dependsOnValue || ""}
                                  onChange={v => updateField(section.id, field.id, { dependsOnValue: v })}
                                  options={(depField.options || []).map(opt => ({ value: opt, label: opt }))}
                                  placeholder="-- Nilai --"
                                />
                              ) : (
                                <input
                                  type="text"
                                  className={styles.condInput}
                                  value={field.dependsOnValue || ""}
                                  onChange={e => updateField(section.id, field.id, { dependsOnValue: e.target.value })}
                                  placeholder="= nilai..."
                                />
                              );
                            })()}
                          </div>
                        )}
                      </div>

                      {['radio', 'checkbox', 'select'].includes(field.type) && (
                        <div className={styles.optionsBlock}>
                          <label className={styles.optionsLabel}>Pilihan Jawaban:</label>
                          {(field.options || []).map((opt, optIdx) => (
                            <div key={optIdx} className={styles.optionRow}>
                              <div className={styles.optionDot}>
                                {field.type === 'radio' ? <Circle size={14} /> : field.type === 'checkbox' ? <div className={styles.checkSquare}/> : <div className={styles.numberDot}>{optIdx+1}.</div>}
                              </div>
                              <input
                                type="text"
                                className={styles.optionInput}
                                value={opt}
                                onChange={e => {
                                  const newOpts = [...(field.options || [])];
                                  newOpts[optIdx] = e.target.value;
                                  updateField(section.id, field.id, { options: newOpts });
                                }}
                                placeholder={`Opsi ${optIdx + 1}`}
                              />
                              <button 
                                className={styles.iconBtn} 
                                onClick={() => {
                                  const newOpts = (field.options || []).filter((_, i) => i !== optIdx);
                                  updateField(section.id, field.id, { options: newOpts });
                                }}
                                style={{ padding: 4 }}
                              >
                                <Trash2 size={14} color="#999" />
                              </button>
                            </div>
                          ))}
                          <div className={styles.addOptionRow}>
                            <button 
                              className={styles.addOptionBtn}
                              onClick={() => {
                                const newOpts = [...(field.options || []), `Opsi ${(field.options?.length || 0) + 1}`];
                                updateField(section.id, field.id, { options: newOpts });
                              }}
                            >
                              <Plus size={14} /> Tambah Opsi
                            </button>
                          </div>

                          {/* ── Lainnya toggle ── */}
                          <div className={styles.allowOtherRow}>
                            <label className={styles.allowOtherLabel}>
                              <input
                                type="checkbox"
                                checked={field.allowOther || false}
                                onChange={e => updateField(section.id, field.id, { allowOther: e.target.checked })}
                              />
                              Aktifkan opsi &ldquo;Lainnya (isi sendiri)&rdquo;
                            </label>
                            {field.allowOther && (
                              <div className={styles.otherPreviewRow}>
                                <div className={styles.optionDot}>
                                  {field.type === 'radio' ? <Circle size={13} color="#aaa" /> : <div className={styles.checkSquare} />}
                                </div>
                                <span className={styles.otherPreviewText}>Lainnya...</span>
                                <span className={styles.otherPreviewInput}>[ input teks ]</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}



                      {field.type === 'province_city' && (
                        <div className={styles.optionsBlock}>
                          <label className={styles.optionsLabel}>Sumber Wilayah:</label>
                          <div style={{ display: "flex", gap: "16px", marginBottom: "12px", fontSize: "13px" }}>
                            <label style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <input 
                                type="radio" 
                                name={`regionSource_${field.id}`} 
                                checked={field.regionSource !== 'manual'} 
                                onChange={() => updateField(section.id, field.id, { regionSource: 'auto' })}
                              />
                              Otomatis (Semua Wilayah)
                            </label>
                            <label style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <input 
                                type="radio" 
                                name={`regionSource_${field.id}`} 
                                checked={field.regionSource === 'manual'} 
                                onChange={() => updateField(section.id, field.id, { regionSource: 'manual' })}
                              />
                              Manual (Custom)
                            </label>
                          </div>

                          {field.regionSource === 'manual' && (
                            <div className={styles.customRegionsBlock}>
                              {(field.customRegions || []).map((region, rIdx) => (
                                <div key={rIdx} className={styles.regionCard} style={{ border: "1px solid #eee", padding: "12px", borderRadius: "8px", marginBottom: "12px" }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                                    <span style={{ fontWeight: 600, fontSize: "12px" }}>Provinsi:</span>
                                    <input 
                                      type="text" 
                                      className="input" 
                                      style={{ padding: "4px 8px", fontSize: "12px", flex: 1 }}
                                      value={region.province}
                                      onChange={e => {
                                        const newRegions = [...(field.customRegions || [])];
                                        newRegions[rIdx].province = e.target.value;
                                        updateField(section.id, field.id, { customRegions: newRegions });
                                      }}
                                      placeholder="Nama Provinsi"
                                    />
                                    <button 
                                      className={styles.iconBtn} 
                                      onClick={() => {
                                        const newRegions = (field.customRegions || []).filter((_, i) => i !== rIdx);
                                        updateField(section.id, field.id, { customRegions: newRegions });
                                      }}
                                    >
                                      <Trash2 size={16} color="#cc0000" />
                                    </button>
                                  </div>
                                  <div style={{ marginLeft: "16px", borderLeft: "2px solid #eee", paddingLeft: "12px" }}>
                                    <div style={{ fontSize: "11px", color: "#666", marginBottom: "4px" }}>Daftar Kota/Kabupaten:</div>
                                    {(region.cities || []).map((city, cIdx) => (
                                      <div key={cIdx} style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                                        <div style={{ width: "4px", height: "4px", borderRadius: "50%", background: "#ccc" }} />
                                        <input 
                                          type="text" 
                                          className={styles.optionInput} 
                                          style={{ padding: "2px 6px", fontSize: "11px", flex: 1 }}
                                          value={city}
                                          onChange={e => {
                                            const newRegions = JSON.parse(JSON.stringify(field.customRegions || []));
                                            newRegions[rIdx].cities[cIdx] = e.target.value;
                                            updateField(section.id, field.id, { customRegions: newRegions });
                                          }}
                                          placeholder={`Kota/Kab ${cIdx + 1}`}
                                        />
                                        <button 
                                          className={styles.iconBtn} 
                                          onClick={() => {
                                            const newRegions = JSON.parse(JSON.stringify(field.customRegions || []));
                                            newRegions[rIdx].cities = newRegions[rIdx].cities.filter((_: string, i: number) => i !== cIdx);
                                            updateField(section.id, field.id, { customRegions: newRegions });
                                          }}
                                          style={{ padding: 2 }}
                                        >
                                          <Trash2 size={12} color="#999" />
                                        </button>
                                      </div>
                                    ))}
                                    <button 
                                      className={styles.addOptionBtn}
                                      style={{ marginTop: "6px", fontSize: "11px", padding: "4px" }}
                                      onClick={() => {
                                        const newRegions = JSON.parse(JSON.stringify(field.customRegions || []));
                                        newRegions[rIdx].cities.push("");
                                        updateField(section.id, field.id, { customRegions: newRegions });
                                      }}
                                    >
                                      <Plus size={12} /> Tambah Kota
                                    </button>
                                  </div>
                                </div>
                              ))}
                              <button 
                                className="btn btn-secondary" 
                                style={{ width: "100%", padding: "6px", fontSize: "12px" }}
                                onClick={() => {
                                  const newRegions = JSON.parse(JSON.stringify(field.customRegions || []));
                                  newRegions.push({ province: "", cities: [""] });
                                  updateField(section.id, field.id, { customRegions: newRegions });
                                }}
                              >
                                <Plus size={14} style={{ marginRight: 6 }} /> Tambah Provinsi
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <button className={styles.iconBtn} onClick={() => deleteField(section.id, field.id)}>
                      <Trash2 size={18} />
                    </button>
                  </div>
                )})}
              </div>

              <div className={styles.sectionFooter}>
                <button className="btn btn-secondary" onClick={() => addField(section.id)}>
                  <Plus size={16} style={{ marginRight: 6 }} /> Tambah Pertanyaan
                </button>
              </div>
              </>
              )}
            </div>
          )})}

          <button className={styles.addSectionBtn} onClick={addSection}>
            <Plus size={20} style={{ marginRight: 8 }} /> Tambah Seksi Baru
          </button>
        </div>
      </div>

      <AlertDialog 
        isOpen={!!alertMsg} 
        onClose={() => setAlertMsg("")} 
        message={alertMsg} 
      />

      <ConfirmDialog 
        isOpen={!!confirmDeleteSecId}
        onClose={() => setConfirmDeleteSecId(null)}
        onConfirm={deleteSection}
        title="Hapus Seksi"
        message="Hapus seksi ini beserta semua pertanyaannya? Data yang sudah dihapus tidak dapat dikembalikan."
        confirmText="Hapus"
        confirmStyle={{ background: '#cc0000', borderColor: '#cc0000', color: 'white' }}
      />
    </>
  );
}
