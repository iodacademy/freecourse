"use client";

import { useState, useEffect, useCallback } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import styles from "./page.module.css";
import type { CourseStep, AssessmentQuestion, SurveyQuestion } from "@/lib/types";
import { Video, FileText, ClipboardList, Plus, Trash2, Save, ArrowUp, ArrowDown, Settings, X } from "lucide-react";

export default function SingleCourseEditor() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [steps, setSteps] = useState<CourseStep[]>([]);
  const [activeStepIndex, setActiveStepIndex] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"list" | "editor">("list");
  const [activeCompTab, setActiveCompTab] = useState<"assessment" | "survey">("assessment");

  const getToken = useCallback(async () => {
    if (!user) return "";
    try { return await (user as any).getIdToken(); } catch { return ""; }
  }, [user]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const token = await getToken();
      const res = await fetch("/api/courses/main", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Gagal memuat kursus");
      const data = await res.json();
      setSteps(data.steps || []);
      if (data.steps && data.steps.length > 0) {
        setActiveStepIndex(0);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => { loadData(); }, [loadData]);

  const saveChanges = async () => {
    setSaving(true);
    setError("");
    setSuccessMsg("");
    try {
      const token = await getToken();
      const res = await fetch("/api/courses/main", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ steps })
      });
      if (!res.ok) throw new Error("Gagal menyimpan perubahan");
      setSuccessMsg("Berhasil disimpan!");
      setTimeout(() => setSuccessMsg(""), 3000);
      await loadData(); // reload
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const addStep = () => {
    const newStep: CourseStep = {
      id: `new-${Date.now()}`,
      courseId: "course-main",
      order: steps.length + 1,
      title: "Materi Baru",
      video: { youtubeId: "", url: "", duration: 0 },
      hasAssessment: false,
      hasSurvey: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    setSteps([...steps, newStep]);
    setActiveStepIndex(steps.length);
  };

  const deleteStep = (index: number) => {
    if (!confirm("Hapus materi ini?")) return;
    const newSteps = [...steps];
    newSteps.splice(index, 1);
    setSteps(newSteps);
    if (activeStepIndex === index) setActiveStepIndex(null);
    else if (activeStepIndex !== null && activeStepIndex > index) {
      setActiveStepIndex(activeStepIndex - 1);
    }
  };

  const moveStep = (index: number, direction: "up" | "down") => {
    if (direction === "up" && index > 0) {
      const newSteps = [...steps];
      [newSteps[index - 1], newSteps[index]] = [newSteps[index], newSteps[index - 1]];
      setSteps(newSteps);
      if (activeStepIndex === index) setActiveStepIndex(index - 1);
      else if (activeStepIndex === index - 1) setActiveStepIndex(index);
    } else if (direction === "down" && index < steps.length - 1) {
      const newSteps = [...steps];
      [newSteps[index + 1], newSteps[index]] = [newSteps[index], newSteps[index + 1]];
      setSteps(newSteps);
      if (activeStepIndex === index) setActiveStepIndex(index + 1);
      else if (activeStepIndex === index + 1) setActiveStepIndex(index);
    }
  };

  const updateActiveStep = (updater: (prev: CourseStep) => CourseStep) => {
    if (activeStepIndex === null) return;
    const newSteps = [...steps];
    newSteps[activeStepIndex] = updater(newSteps[activeStepIndex]);
    setSteps(newSteps);
  };

  // --- Assessment Helpers ---
  const addAssessmentQuestion = () => {
    updateActiveStep(step => {
      const q: AssessmentQuestion = {
        id: `q-${Date.now()}`,
        text: "Pertanyaan Baru",
        options: [
          { id: "A", text: "Opsi A" },
          { id: "B", text: "Opsi B" }
        ],
        correctAnswer: "A",
        feedbackCorrect: "Benar!",
        feedbackWrong: "Salah.",
        hint: ""
      };
      return {
        ...step,
        assessment: {
          kkm: step.assessment?.kkm || 80,
          questions: [...(step.assessment?.questions || []), q]
        }
      };
    });
  };

  const updateAssessmentQuestion = (qIndex: number, updater: (prev: AssessmentQuestion) => AssessmentQuestion) => {
    updateActiveStep(step => {
      if (!step.assessment) return step;
      const newQuestions = [...step.assessment.questions];
      newQuestions[qIndex] = updater(newQuestions[qIndex]);
      return { ...step, assessment: { ...step.assessment, questions: newQuestions } };
    });
  };

  const removeAssessmentQuestion = (qIndex: number) => {
    updateActiveStep(step => {
      if (!step.assessment) return step;
      const newQuestions = [...step.assessment.questions];
      newQuestions.splice(qIndex, 1);
      return { ...step, assessment: { ...step.assessment, questions: newQuestions } };
    });
  };

  // --- Survey Helpers ---
  const addSurveyQuestion = () => {
    updateActiveStep(step => {
      const q: SurveyQuestion = {
        id: `sq-${Date.now()}`,
        text: "Pertanyaan Survei",
        type: "multipleChoice",
        options: ["Pilihan 1", "Pilihan 2"],
        required: true
      };
      return {
        ...step,
        survey: {
          questions: [...(step.survey?.questions || []), q]
        }
      };
    });
  };

  const updateSurveyQuestion = (qIndex: number, updater: (prev: SurveyQuestion) => SurveyQuestion) => {
    updateActiveStep(step => {
      if (!step.survey) return step;
      const newQuestions = [...step.survey.questions];
      newQuestions[qIndex] = updater(newQuestions[qIndex]);
      return { ...step, survey: { ...step.survey, questions: newQuestions } };
    });
  };

  const removeSurveyQuestion = (qIndex: number) => {
    updateActiveStep(step => {
      if (!step.survey) return step;
      const newQuestions = [...step.survey.questions];
      newQuestions.splice(qIndex, 1);
      return { ...step, survey: { ...step.survey, questions: newQuestions } };
    });
  };

  const activeStep = activeStepIndex !== null ? steps[activeStepIndex] : null;

  return (
    <ProtectedRoute requireAdmin>
      <div className={styles.page}>
        {error && <div className={styles.errorBanner}>{error}</div>}
        {successMsg && <div className={styles.successBanner}>{successMsg}</div>}

        {loading ? (
          <div className={styles.loadingWrap}>Memuat data...</div>
        ) : (
          <div className={styles.tabsContainer}>
            <div className={styles.tabs}>
              <button 
                className={`${styles.tab} ${activeTab === "list" ? styles.activeTab : ""}`}
                onClick={() => setActiveTab("list")}
              >
                Urutan Materi
              </button>
              <button 
                className={`${styles.tab} ${activeTab === "editor" ? styles.activeTab : ""}`}
                onClick={() => setActiveTab("editor")}
              >
                Edit Materi
              </button>
            </div>
            
            <div className={styles.tabContent}>
              {activeTab === "list" ? (
                <div className={styles.sidebar}>
                  <div className={styles.sidebarHeader}>
                    <h2>Daftar Materi</h2>
                    <button className={styles.addBtn} onClick={addStep}><Plus size={16} /> Tambah</button>
                  </div>
                  <div className={styles.stepList}>
                    {steps.map((step, index) => (
                      <div 
                        key={step.id} 
                        className={`${styles.stepCard} ${activeStepIndex === index ? styles.stepCardActive : ""}`}
                        onClick={() => {
                          setActiveStepIndex(index);
                          setActiveTab("editor");
                        }}
                      >
                        <div className={styles.stepCardLeft}>
                          <span className={styles.stepNumber}>{index + 1}</span>
                          <div>
                            <h4 className={styles.stepCardTitle}>{step.title || "Tanpa Judul"}</h4>
                            <div className={styles.stepCardBadges}>
                              {step.video?.url && <Video size={12} />}
                              {step.hasAssessment && <FileText size={12} />}
                              {step.hasSurvey && <ClipboardList size={12} />}
                            </div>
                          </div>
                        </div>
                        <div className={styles.stepCardActions}>
                          <button onClick={(e) => { e.stopPropagation(); moveStep(index, "up"); }} disabled={index === 0}><ArrowUp size={14}/></button>
                          <button onClick={(e) => { e.stopPropagation(); moveStep(index, "down"); }} disabled={index === steps.length - 1}><ArrowDown size={14}/></button>
                        </div>
                      </div>
                    ))}
                    {steps.length === 0 && <div className={styles.emptySteps}>Belum ada materi. Silakan klik Tambah.</div>}
                  </div>
                </div>
              ) : (
                <div className={styles.editor}>
                  {!activeStep ? (
                    <div className={styles.emptyEditor}>
                      Pilih atau tambah materi di tab "Urutan Materi" untuk mengedit.
                    </div>
                  ) : (
                    <div className={styles.editorContent}>
                      <div className={styles.editorHeader}>
                        <h2>Edit Materi: {activeStep.title || "Tanpa Judul"}</h2>
                        <button className={styles.deleteBtn} onClick={() => { deleteStep(activeStepIndex!); setActiveTab("list"); }}>
                          <Trash2 size={14} /> Hapus Materi
                        </button>
                      </div>
                      
                      {/* Basic Info */}
                      <div className={styles.section}>
                        <h3>Informasi Dasar</h3>
                        <div className={styles.formGroup}>
                          <label>Judul Materi</label>
                          <input 
                            type="text" 
                            value={activeStep.title} 
                            onChange={e => updateActiveStep(s => ({ ...s, title: e.target.value }))}
                            className={styles.input}
                            placeholder="Contoh: Pengantar Arus Kas"
                          />
                        </div>
                      </div>

                      {/* Video */}
                      <div className={styles.section}>
                        <h3>Video Pembelajaran</h3>
                        <div className={styles.formGroup}>
                          <label>URL YouTube</label>
                          <input 
                            type="text" 
                            value={activeStep.video?.url || ""} 
                            onChange={e => {
                              const val = e.target.value;
                              let yid = "";
                              const m = val.match(/(?:v=|\/)([0-9A-Za-z_-]{11}).*/);
                              if(m) yid = m[1];
                              updateActiveStep(s => ({ ...s, video: { ...s.video, url: val, youtubeId: yid } }));
                            }}
                            className={styles.input}
                            placeholder="https://www.youtube.com/watch?v=..."
                          />
                        </div>
                      </div>

                      {/* Companion Type Selector */}
                      <div className={styles.section}>
                        <h3>Modul Pendamping</h3>
                        <div className={styles.typeSelector}>
                          <label>
                            <input 
                              type="checkbox" 
                              checked={activeStep.hasAssessment} 
                              onChange={(e) => updateActiveStep(s => ({ 
                                ...s, 
                                hasAssessment: e.target.checked,
                                assessment: e.target.checked ? (s.assessment || { kkm: 80, questions: [] }) : s.assessment
                              }))}
                            /> Assessment (Kuis)
                          </label>
                          <label>
                            <input 
                              type="checkbox" 
                              checked={activeStep.hasSurvey} 
                              onChange={(e) => updateActiveStep(s => ({ 
                                ...s, 
                                hasSurvey: e.target.checked,
                                survey: e.target.checked ? (s.survey || { questions: [] }) : s.survey
                              }))}
                            /> Survei
                          </label>
                        </div>
                      </div>

                      {/* Companion Editors */}
                      {(activeStep.hasAssessment || activeStep.hasSurvey) && (
                        <div className={styles.companionEditorsContainer}>
                          {activeStep.hasAssessment && activeStep.hasSurvey && (
                            <div className={styles.compTabs}>
                              <button 
                                className={`${styles.compTab} ${activeCompTab === 'assessment' ? styles.compTabActive : ''}`}
                                onClick={() => setActiveCompTab('assessment')}
                              >
                                Assessment (Kuis)
                              </button>
                              <button 
                                className={`${styles.compTab} ${activeCompTab === 'survey' ? styles.compTabActive : ''}`}
                                onClick={() => setActiveCompTab('survey')}
                              >
                                Survei
                              </button>
                            </div>
                          )}

                          {/* Assessment Editor */}
                          {activeStep.hasAssessment && activeStep.assessment && (!activeStep.hasSurvey || activeCompTab === 'assessment') && (
                            <div className={styles.sectionAlt}>
                              <div className={styles.sectionHeader}>
                                <h3>Daftar Pertanyaan Assessment</h3>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                  <label style={{ fontSize: '12px' }}>Nilai Kelulusan (KKM):</label>
                                  <input 
                                    type="number" 
                                    className={styles.inputSmall} 
                                    value={activeStep.assessment.kkm}
                                    onChange={e => updateActiveStep(s => ({ ...s, assessment: { ...s.assessment!, kkm: Number(e.target.value) } }))}
                                  />
                                </div>
                              </div>
                              
                              {activeStep.assessment.questions.map((q, qIndex) => (
                                <div key={q.id} className={styles.questionBox}>
                                  <div className={styles.questionHeader}>
                                    <h4>Pertanyaan {qIndex + 1}</h4>
                                    <button className={styles.deleteIconBtn} onClick={() => removeAssessmentQuestion(qIndex)}><Trash2 size={14}/></button>
                                  </div>
                                  <textarea 
                                    className={styles.textarea}
                                    value={q.text}
                                    onChange={e => updateAssessmentQuestion(qIndex, prev => ({ ...prev, text: e.target.value }))}
                                    placeholder="Tulis pertanyaan kuis..."
                                  />
                                  <div className={styles.optionsList}>
                                    {q.options.map((opt, optIndex) => (
                                      <div key={opt.id} className={styles.optionRow}>
                                        <input 
                                          type="radio" 
                                          name={`correct-${q.id}`} 
                                          checked={q.correctAnswer === opt.id}
                                          onChange={() => updateAssessmentQuestion(qIndex, prev => ({ ...prev, correctAnswer: opt.id }))}
                                        />
                                        <input 
                                          type="text" 
                                          className={styles.input} 
                                          value={opt.text}
                                          onChange={e => {
                                            const val = e.target.value;
                                            updateAssessmentQuestion(qIndex, prev => {
                                              const newOpts = [...prev.options];
                                              newOpts[optIndex].text = val;
                                              return { ...prev, options: newOpts };
                                            });
                                          }}
                                          placeholder={`Opsi ${opt.id}`}
                                        />
                                        <button className={styles.deleteIconBtn} onClick={() => {
                                          updateAssessmentQuestion(qIndex, prev => {
                                            const newOpts = prev.options.filter((_, i) => i !== optIndex);
                                            return { ...prev, options: newOpts };
                                          });
                                        }}><X size={14}/></button>
                                      </div>
                                    ))}
                                    <button className={styles.addOptionBtn} onClick={() => {
                                      updateAssessmentQuestion(qIndex, prev => {
                                        const nextId = String.fromCharCode(65 + prev.options.length); // A, B, C...
                                        return { ...prev, options: [...prev.options, { id: nextId, text: "" }] };
                                      });
                                    }}>+ Tambah Pilihan</button>
                                  </div>
                                  <div className={styles.feedbackRow}>
                                    <div>
                                      <label>Feedback Benar</label>
                                      <input type="text" className={styles.input} value={q.feedbackCorrect} onChange={e => updateAssessmentQuestion(qIndex, prev => ({ ...prev, feedbackCorrect: e.target.value }))} />
                                    </div>
                                    <div>
                                      <label>Feedback Salah</label>
                                      <input type="text" className={styles.input} value={q.feedbackWrong} onChange={e => updateAssessmentQuestion(qIndex, prev => ({ ...prev, feedbackWrong: e.target.value }))} />
                                    </div>
                                  </div>
                                </div>
                              ))}
                              <button className={styles.addBlockBtn} onClick={addAssessmentQuestion}>+ Tambah Pertanyaan Kuis</button>
                            </div>
                          )}

                          {/* Survey Editor */}
                          {activeStep.hasSurvey && activeStep.survey && (!activeStep.hasAssessment || activeCompTab === 'survey') && (
                            <div className={styles.sectionAlt}>
                              <div className={styles.sectionHeader}>
                                <h3>Daftar Pertanyaan Survei</h3>
                              </div>
                              {activeStep.survey.questions.map((q, qIndex) => (
                                <div key={q.id} className={styles.questionBox}>
                                  <div className={styles.questionHeader}>
                                    <h4>Pertanyaan {qIndex + 1}</h4>
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                      <select 
                                        className={styles.inputSmall} 
                                        value={q.type}
                                        onChange={e => updateSurveyQuestion(qIndex, prev => ({ ...prev, type: e.target.value as any }))}
                                      >
                                        <option value="shortText">Teks Bebas</option>
                                        <option value="multipleChoice">Pilihan Ganda</option>
                                        <option value="scale">Skala 1-5</option>
                                        <option value="starRating">Rating Bintang</option>
                                      </select>
                                      <button className={styles.deleteIconBtn} onClick={() => removeSurveyQuestion(qIndex)}><Trash2 size={14}/></button>
                                    </div>
                                  </div>
                                  <textarea 
                                    className={styles.textarea}
                                    value={q.text}
                                    onChange={e => updateSurveyQuestion(qIndex, prev => ({ ...prev, text: e.target.value }))}
                                    placeholder="Tulis pertanyaan survei..."
                                  />
                                  
                                  {q.type === "multipleChoice" && (
                                    <div className={styles.optionsList}>
                                      {(q.options || []).map((opt, optIndex) => (
                                        <div key={optIndex} className={styles.optionRow}>
                                          <div className={styles.bullet}>•</div>
                                          <input 
                                            type="text" 
                                            className={styles.input} 
                                            value={opt}
                                            onChange={e => {
                                              const val = e.target.value;
                                              updateSurveyQuestion(qIndex, prev => {
                                                const newOpts = [...(prev.options || [])];
                                                newOpts[optIndex] = val;
                                                return { ...prev, options: newOpts };
                                              });
                                            }}
                                          />
                                          <button className={styles.deleteIconBtn} onClick={() => {
                                            updateSurveyQuestion(qIndex, prev => {
                                              const newOpts = (prev.options || []).filter((_, i) => i !== optIndex);
                                              return { ...prev, options: newOpts };
                                            });
                                          }}><X size={14}/></button>
                                        </div>
                                      ))}
                                      <button className={styles.addOptionBtn} onClick={() => {
                                        updateSurveyQuestion(qIndex, prev => ({ ...prev, options: [...(prev.options || []), ""] }));
                                      }}>+ Tambah Pilihan</button>
                                    </div>
                                  )}

                                  {(q.type === 'scale' || q.type === 'starRating') && (
                                    <div className={styles.inputGroup} style={{ marginTop: 12, marginBottom: 12 }}>
                                      <label style={{ fontSize: '12px', fontWeight: 600, color: '#555', marginBottom: '6px', display: 'block' }}>Label Indikator (Opsional)</label>
                                      <div style={{ display: 'flex', gap: '10px' }}>
                                        <input 
                                          type="text" 
                                          className={styles.input} 
                                          placeholder="Label Minimal (Misal: Sangat Buruk)" 
                                          value={q.minLabel || ""} 
                                          onChange={e => updateSurveyQuestion(qIndex, prev => ({ ...prev, minLabel: e.target.value }))}
                                        />
                                        <input 
                                          type="text" 
                                          className={styles.input} 
                                          placeholder="Label Maksimal (Misal: Sangat Baik)" 
                                          value={q.maxLabel || ""} 
                                          onChange={e => updateSurveyQuestion(qIndex, prev => ({ ...prev, maxLabel: e.target.value }))}
                                        />
                                      </div>
                                    </div>
                                  )}

                                  <label className={styles.checkboxLabel}>
                                    <input 
                                      type="checkbox" 
                                      checked={q.required} 
                                      onChange={e => updateSurveyQuestion(qIndex, prev => ({ ...prev, required: e.target.checked }))}
                                    />
                                    Wajib Diisi
                                  </label>
                                </div>
                              ))}
                              <button className={styles.addBlockBtn} onClick={addSurveyQuestion}>+ Tambah Pertanyaan Survei</button>
                            </div>
                          )}
                        </div>
                      )}

                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Floating Save Button */}
        <button className={styles.floatingSaveBtn} onClick={saveChanges} disabled={saving || loading}>
          <Save size={18} /> {saving ? "Menyimpan..." : "Simpan Perubahan"}
        </button>
      </div>
    </ProtectedRoute>
  );
}
