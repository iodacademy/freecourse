"use client";

import { useState } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import styles from "./page.module.css";
import type { AppSettings } from "@/lib/types";
import { Trash2, CheckCircle, UploadCloud } from "lucide-react";
import Link from "next/link";

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Partial<AppSettings>>({
    adminEmails: ["rohmat@ioda.id", "admin@ioda.id"],
    gasWebAppUrl: "https://script.google.com/macros/s/AKfycby.../exec",
  });

  return (
    <ProtectedRoute requireAdmin>
      <div className={styles.page}>
        <header className={styles.header}>
          <div>
            <h1 className={styles.title}>Pengaturan Sistem</h1>
            <p className={styles.subtitle}>Konfigurasi admin dan integrasi Google Apps Script.</p>
          </div>
          <button className="btn btn-primary">Simpan Pengaturan</button>
        </header>

        <div className={styles.content}>
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Form Builder Profil</h2>
            <p className={styles.sectionDesc}>Kelola pertanyaan dinamis multi-seksi untuk form registrasi dan profil peserta.</p>
            <Link href="/admin/settings/forms" className="btn btn-secondary" style={{ display: 'inline-flex', marginTop: 10 }}>
              Buka Form Builder
            </Link>
          </div>

          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Email Admin</h2>
            <p className={styles.sectionDesc}>Daftar email yang memiliki akses ke panel admin ini.</p>
            
            <div className={styles.inputGroup}>
              {settings.adminEmails?.map((email, i) => (
                <div key={i} className={styles.emailRow}>
                  <input 
                    type="email" 
                    className="input w-full" 
                    value={email}
                    readOnly
                  />
                  <button className={styles.removeBtn}><Trash2 size={16} /></button>
                </div>
              ))}
              <div className={styles.emailRow}>
                <input 
                  type="email" 
                  className="input w-full" 
                  placeholder="Tambahkan email baru..." 
                />
                <button className="btn btn-secondary">Tambah</button>
              </div>
            </div>
          </div>

          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Integrasi Google Apps Script (GAS)</h2>
            <p className={styles.sectionDesc}>URL Web App GAS untuk generate sertifikat dan kirim email.</p>
            
            <div className={styles.inputGroup}>
              <label className={styles.label}>GAS Web App URL</label>
              <input 
                type="text" 
                className="input w-full" 
                value={settings.gasWebAppUrl}
                readOnly
              />
            </div>
            <div className={styles.testConnection}>
              <button className="btn btn-secondary">Uji Koneksi GAS</button>
              <span className={styles.statusOk}><CheckCircle size={16} style={{ display: 'inline-block', verticalAlign: 'text-bottom' }} /> Terhubung</span>
            </div>
          </div>
          
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Bulk Import Email (Channel 1)</h2>
            <p className={styles.sectionDesc}>Upload file Excel/CSV untuk mendaftarkan email mahasiswa/karyawan yang diizinkan menggunakan Kode Mitra tertentu.</p>
            
            <div className={styles.uploadBox}>
              <span className={styles.uploadIcon}><UploadCloud size={32} style={{ color: 'var(--color-primary)' }} /></span>
              <h4>Tarik dan lepas file Excel di sini</h4>
              <p>atau</p>
              <button className="btn btn-secondary">Pilih File</button>
              <p className={styles.uploadHint}>Format yang didukung: .xlsx, .csv</p>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
