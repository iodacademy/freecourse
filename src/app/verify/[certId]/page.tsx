"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

interface VerifyResult {
  valid: boolean;
  certId?: string;
  nama?: string;
  program?: string;
  penyelenggara?: string;
  tanggalKlaim?: string;
  isWorkshop?: boolean;
  error?: string;
}

export default function VerifyPage() {
  const { certId } = useParams<{ certId: string }>();
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<VerifyResult | null>(null);

  useEffect(() => {
    if (!certId) return;
    fetch(`/api/verify/${certId}`)
      .then((r) => r.json())
      .then((data) => setResult(data))
      .catch(() => setResult({ valid: false, error: "Gagal memverifikasi" }))
      .finally(() => setLoading(false));
  }, [certId]);

  return (
    <div className="verify-page">
      <div className="verify-card">
        {/* Header */}
        <div className="verify-header">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/logo.png" alt="Logo" className="verify-logo" />
          <h1 className="verify-title">Verifikasi Sertifikat</h1>
        </div>

        {loading && (
          <div className="verify-loading">
            <Loader2 size={32} className="verify-spinner" />
            <p>Memverifikasi sertifikat...</p>
          </div>
        )}

        {!loading && result?.valid && (
          <div className="verify-result verify-result--valid">
            <div className="verify-badge verify-badge--valid">
              <CheckCircle2 size={28} />
              <span>Sertifikat Valid</span>
            </div>

            <div className="verify-info">
              <div className="verify-info-row">
                <span className="verify-info-label">ID Sertifikat</span>
                <span className="verify-info-value">{result.certId}</span>
              </div>
              <div className="verify-info-row">
                <span className="verify-info-label">Nama</span>
                <span className="verify-info-value">{result.nama}</span>
              </div>
              <div className="verify-info-row">
                <span className="verify-info-label">Program</span>
                <span className="verify-info-value">{result.program}</span>
              </div>
              <div className="verify-info-row">
                <span className="verify-info-label">Penyelenggara</span>
                <span className="verify-info-value">{result.penyelenggara}</span>
              </div>
              <div className="verify-info-row">
                <span className="verify-info-label">Tanggal Klaim</span>
                <span className="verify-info-value">{result.tanggalKlaim || "-"}</span>
              </div>
              {result.isWorkshop && (
                <div className="verify-info-row">
                  <span className="verify-info-label">Jenis</span>
                  <span className="verify-info-value">Sertifikat Kehadiran Workshop</span>
                </div>
              )}
            </div>
          </div>
        )}

        {!loading && result && !result.valid && (
          <div className="verify-result verify-result--invalid">
            <div className="verify-badge verify-badge--invalid">
              <XCircle size={28} />
              <span>Sertifikat Tidak Ditemukan</span>
            </div>
            <p className="verify-error-text">
              ID sertifikat <strong>{certId}</strong> tidak terdaftar dalam sistem kami. 
              Pastikan ID yang dimasukkan sudah benar.
            </p>
          </div>
        )}

        <p className="verify-footer">
          Program ini diselenggarakan oleh <strong>DBS Foundation</strong> dan <strong>Plan Indonesia</strong>
        </p>
      </div>
    </div>
  );
}
