"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import styles from "./page.module.css";
import { CheckCircle, AlertTriangle } from "lucide-react";

interface CertData {
  certId: string;
  userName: string;
  courseName: string;
  claimedAt: string;
  issuerName: string;
  isValid: boolean;
}

export default function VerifyPage() {
  const params = useParams();
  const certId = params.certId as string;

  const [certData, setCertData] = useState<CertData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!certId) return;

    async function fetchCert() {
      try {
        // Gunakan public API — bypass Firestore Security Rules via Admin SDK
        const res = await fetch(`/api/verify/${certId}`);

        if (res.status === 404) {
          setNotFound(true);
          return;
        }

        if (!res.ok) {
          setNotFound(true);
          return;
        }

        const result = await res.json();

        if (result.valid && result.data) {
          setCertData({ ...result.data, isValid: true });
        } else {
          // Sertifikat ditemukan tapi tidak valid
          setCertData({
            certId,
            userName: "",
            courseName: "",
            claimedAt: "",
            issuerName: "",
            isValid: false,
          });
        }
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }

    fetchCert();
  }, [certId]);

  if (loading) {
    return (
      <div className={styles.wrapper}>
        <div className={styles.card}>
          <div className="loading-overlay" style={{ minHeight: "200px" }}>
            <div className="spinner spinner-lg" />
            <p>Memverifikasi sertifikat...</p>
          </div>
        </div>
      </div>
    );
  }

  if (notFound || !certData) {
    return (
      <div className={styles.wrapper}>
        <div className={styles.card}>
          <div className={styles.invalidState}>
            <span className={styles.invalidIcon}><AlertTriangle size={64} style={{ display: 'inline-block' }} /></span>
            <h2>Sertifikat Tidak Ditemukan</h2>
            <p>
              ID sertifikat <code>{certId}</code> tidak terdaftar di sistem kami.
              Pastikan URL yang kamu akses sudah benar.
            </p>
            <Link href="/" className="btn btn-primary">
              Kembali ke Beranda
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>
        {certData.isValid ? (
          <div className={styles.validState}>
            <div className={styles.validBadge}>
              <span className={styles.validIcon}><CheckCircle size={64} style={{ display: 'inline-block' }} /></span>
              <span className={styles.validText}>SERTIFIKAT VALID</span>
            </div>

            <div className={styles.certDetails}>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>ID Sertifikat</span>
                <span className={styles.detailValue}>{certData.certId}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Nama Pemegang</span>
                <span className={styles.detailValue}>{certData.userName}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Kursus</span>
                <span className={styles.detailValue}>{certData.courseName}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Tanggal Terbit</span>
                <span className={styles.detailValue}>{certData.claimedAt}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Diterbitkan Oleh</span>
                <span className={styles.detailValue}>{certData.issuerName}</span>
              </div>
            </div>

            <div className={styles.verifiedBy}>
              <div className={styles.verifyLogo}>ioda</div>
              <p>Diverifikasi oleh IODA Academy</p>
            </div>
          </div>
        ) : (
          <div className={styles.invalidState}>
            <span className={styles.invalidIcon}><AlertTriangle size={64} style={{ display: 'inline-block' }} /></span>
            <h2>Sertifikat Tidak Valid</h2>
            <p>
              Sertifikat dengan ID <code>{certData.certId}</code> telah dicabut
              atau tidak lagi berlaku.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
