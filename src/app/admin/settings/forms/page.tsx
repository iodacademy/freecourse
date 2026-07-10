"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import styles from "./page.module.css";
import { Plus, Trash2, Edit, CheckCircle, Circle, Eye } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import type { DynamicForm } from "@/lib/types";
import { ConfirmDialog, AlertDialog, PromptDialog } from "@/components/Modal/Dialogs";
import PreviewModal from "./PreviewModal";

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

const DEFAULT_FORM_SECTIONS = [
  {
    id: generateId(),
    title: "Data diri",
    description: "Mohon lengkapi data diri Anda di bawah ini.",
    fields: [
      { id: generateId(), name: "nama_lengkap", label: "Nama Lengkap (sesuai KTP/Kartu Identitas)", type: "text", required: true },
      { id: generateId(), name: "jenis_kelamin", label: "Jenis Kelamin", type: "radio", required: true, options: ["Laki-laki", "Perempuan"] },
      { id: generateId(), name: "tanggal_lahir", label: "Tanggal Lahir", type: "date", required: true },
      { id: generateId(), name: "alamat_email", label: "Alamat Email", type: "email", required: true },
      { id: generateId(), name: "nomor_whatsapp", label: "Nomor WhatsApp / Telepon Aktif", type: "tel", required: true },
      { id: generateId(), name: "asal_daerah", label: "Asal Daerah", type: "province_city", required: true },
      { id: generateId(), name: "disabilitas", label: "Apakah Anda merupakan penyandang disabilitas?", type: "radio", required: true, options: ["Ya", "Tidak"] },
      { id: generateId(), name: "kategori_disabilitas", label: "Pilih kategori disabilitas", type: "radio", required: true, options: ["Disabilitas Fisik", "Disabilitas Sensorik (Netra/Tuli)", "Disabilitas Intelektual", "Disabilitas Mental", "Lainnya"], dependsOn: "disabilitas", dependsOnValue: "Ya" }
    ]
  }
];

export default function AdminFormsPage() {
  const { user } = useAuth();
  const [forms, setForms] = useState<DynamicForm[]>([]);
  const [loading, setLoading] = useState(true);

  const [alertMsg, setAlertMsg] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [previewForm, setPreviewForm] = useState<DynamicForm | null>(null);

  useEffect(() => {
    if (!user) return;
    fetchForms();
  }, [user]);

  async function getToken() {
    if (!user) return "";
    try { return await (user as any).getIdToken(); } catch { return ""; }
  }

  async function fetchForms() {
    setLoading(true);
    try {
      const idToken = await getToken();
      const res = await fetch("/api/admin/forms", {
        headers: { Authorization: `Bearer ${idToken}` }
      });
      if (!res.ok) throw new Error("Gagal mengambil form");
      const data = await res.json();
      setForms(data);
    } catch (e) {
      console.error(e);
      setAlertMsg("Gagal mengambil daftar form");
    } finally {
      setLoading(false);
    }
  }

  async function createForm(title: string) {
    if (!title) return;
    try {
      const idToken = await getToken();
      const res = await fetch("/api/admin/forms", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}` 
        },
        body: JSON.stringify({ title, sections: DEFAULT_FORM_SECTIONS })
      });
      if (!res.ok) throw new Error("Gagal membuat form");
      fetchForms();
    } catch (e) {
      console.error(e);
      setAlertMsg("Gagal membuat form");
    }
  }

  const handleConfirmDelete = (id: string) => {
    setConfirmDeleteId(id);
  };

  async function deleteForm() {
    if (!confirmDeleteId) return;
    try {
      const idToken = await getToken();
      const res = await fetch(`/api/admin/forms/${confirmDeleteId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${idToken}` }
      });
      if (!res.ok) throw new Error("Gagal menghapus form");
      fetchForms();
    } catch (e) {
      console.error(e);
      setAlertMsg("Gagal menghapus form");
    } finally {
      setConfirmDeleteId(null);
    }
  }

  async function toggleActive(id: string, currentlyActive: boolean) {
    if (currentlyActive) return;
    try {
      const idToken = await getToken();
      const res = await fetch(`/api/admin/forms/${id}`, {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}` 
        },
        body: JSON.stringify({ isActive: true })
      });
      if (!res.ok) throw new Error("Gagal mengaktifkan form");
      fetchForms();
    } catch (e) {
      console.error(e);
      setAlertMsg("Gagal mengaktifkan form");
    }
  }

  return (
    <>
      <div className={styles.page}>
        <div className={styles.content}>
          {loading ? (
            <p>Memuat form...</p>
          ) : forms.length === 0 ? (
            <div className={styles.emptyState}>
              <p>Belum ada form yang dibuat.</p>
            </div>
          ) : (
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Judul Form</th>
                    <th>Status</th>
                    <th>Jumlah Seksi</th>
                    <th>Tanggal Dibuat</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {forms.map(form => (
                    <tr key={form.id}>
                      <td style={{ fontWeight: 500 }}>
                        <Link href={`/admin/settings/forms/${form.id}`} style={{ color: '#222', textDecoration: 'none' }}>
                          {form.title}
                        </Link>
                      </td>
                      <td>
                        {form.isActive ? (
                          <span className={styles.activeBadge}><CheckCircle size={14} /> Default Global</span>
                        ) : (
                          <button className={styles.setBtn} onClick={() => toggleActive(form.id, form.isActive)}>
                            <Circle size={14} /> Custom/Event Only - Jadikan Default
                          </button>
                        )}
                      </td>
                      <td>{form.sections?.length || 0} Seksi</td>
                      <td>{new Date(form.createdAt).toLocaleDateString("id-ID")}</td>
                      <td>
                        <div className={styles.actionCell}>
                          <button 
                            className={styles.previewBtn} 
                            onClick={() => setPreviewForm(form)}
                            title="Preview Form"
                          >
                            <Eye size={16} />
                          </button>
                          <Link href={`/admin/settings/forms/${form.id}`} className={styles.editBtn} title="Edit Form" style={{ flex: 'none' }}>
                            <Edit size={16} />
                          </Link>
                          {!form.isActive && (
                            <button className={styles.deleteBtn} onClick={() => handleConfirmDelete(form.id)} title="Hapus Form">
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}

                  {/* ── BARIS PLACEHOLDER TAMBAH ── */}
                  <tr
                    onClick={() => setShowPrompt(true)}
                    style={{ cursor: 'pointer', opacity: 0.5 }}
                    onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.opacity = '1'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.opacity = '0.5'; }}
                  >
                    <td colSpan={5} style={{ color: '#888', fontSize: 13, borderTop: '1px dashed #e5e7eb' }}>
                      <Plus size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />
                      Tambah form baru...
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <AlertDialog 
        isOpen={!!alertMsg} 
        onClose={() => setAlertMsg("")} 
        message={alertMsg} 
      />

      <ConfirmDialog 
        isOpen={!!confirmDeleteId}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={deleteForm}
        title="Hapus Form"
        message="Yakin ingin menghapus form ini? Data yang sudah dihapus tidak dapat dikembalikan."
        confirmText="Hapus"
        confirmStyle={{ background: '#cc0000', borderColor: '#cc0000', color: 'white' }}
      />

      <PromptDialog 
        isOpen={showPrompt}
        onClose={() => setShowPrompt(false)}
        onConfirm={createForm}
        title="Buat Form Baru"
        message="Masukkan nama untuk form profil/survei yang baru:"
        placeholder="Cth: Survei Pendaftaran Mahasiswa"
      />

      {previewForm && (
        <PreviewModal 
          form={previewForm} 
          onClose={() => setPreviewForm(null)} 
        />
      )}
    </>
  );
}
