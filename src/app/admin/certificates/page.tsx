"use client";

import { useState } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import styles from "./page.module.css";
import type { CertificateVerification } from "@/lib/types";

// Dummy data
const DUMMY_CERTS: Partial<CertificateVerification>[] = [
  {
    certId: "CERT-2026-ABC123",
    userName: "Rohmat Ramadhan",
    courseName: "Literasi Finansial Dasar",
    claimedAt: new Date("2026-05-20"),
    isValid: true,
  },
  {
    certId: "CERT-2026-XYZ987",
    userName: "Budi Santoso",
    courseName: "Literasi Finansial Dasar",
    claimedAt: new Date("2026-05-18"),
    isValid: true,
  },
  {
    certId: "CERT-2026-REV000",
    userName: "Joko Susilo",
    courseName: "Literasi Finansial Dasar",
    claimedAt: new Date("2026-05-01"),
    isValid: false,
  }
];

export default function AdminCertificatesPage() {
  const [certs] = useState(DUMMY_CERTS);

  return (
    <ProtectedRoute requireAdmin>
      <div className={styles.page}>
        <header className={styles.header}>
          <div>
            <h1 className={styles.title}>Kelola Sertifikat</h1>
            <p className={styles.subtitle}>Daftar sertifikat yang telah diterbitkan.</p>
          </div>
          <button className="btn btn-primary">Export Data</button>
        </header>

        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>ID Sertifikat</th>
                <th>Nama Peserta</th>
                <th>Kursus</th>
                <th>Tanggal Klaim</th>
                <th>Status</th>
                <th className={styles.actionsCell}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {certs.map((cert) => (
                <tr key={cert.certId} className={!cert.isValid ? styles.invalidRow : ""}>
                  <td>
                    <code className={styles.codeBadge}>{cert.certId}</code>
                  </td>
                  <td className={styles.fw500}>{cert.userName}</td>
                  <td>{cert.courseName}</td>
                  <td>{cert.claimedAt?.toLocaleDateString("id-ID")}</td>
                  <td>
                    {cert.isValid ? (
                      <span className={`${styles.statusBadge} ${styles.valid}`}>Valid</span>
                    ) : (
                      <span className={`${styles.statusBadge} ${styles.invalid}`}>Dicabut</span>
                    )}
                  </td>
                  <td className={styles.actionsCell}>
                    <button className={styles.iconBtn} title="Lihat">👁️</button>
                    <button className={styles.iconBtn} title={cert.isValid ? "Cabut Sertifikat" : "Pulihkan"}>
                      {cert.isValid ? "🚫" : "✅"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </ProtectedRoute>
  );
}
