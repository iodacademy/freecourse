'use client';

import { useState } from 'react';

interface ConsentGateProps {
  onConsent: () => void;
  title?: string;
  leadText?: string;
  points?: string[];
}

export default function ConsentGate({
  onConsent,
  title = 'Persetujuan Penggunaan Data',
  leadText = 'Sebelum mengisi formulir, kami ingin menjelaskan bagaimana data kamu akan digunakan:',
  points = [
    'Data akan digunakan untuk keperluan pelatihan dan sertifikasi.',
    'Data dijaga kerahasiaannya sesuai kebijakan privasi.',
    'Kamu bisa melewati pertanyaan yang tidak ingin dijawab.',
    'Kamu bisa berhenti kapan saja tanpa konsekuensi.',
  ],
}: ConsentGateProps) {
  const [state, setState] = useState<'pending' | 'yes' | 'no'>('pending');

  const handleYes = () => {
    setState('yes');
    onConsent();
  };

  const handleNo = () => {
    setState('no');
  };

  // Confirmed mini banner
  if (state === 'yes') {
    return (
      <div className="yr-consent-mini">
        <span className="yr-consent-mini__icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </span>
        <span>Persetujuan data diberikan</span>
        <button className="yr-consent-mini__edit" onClick={() => setState('pending')}>
          Ubah
        </button>
      </div>
    );
  }

  // Declined state
  if (state === 'no') {
    return (
      <div className="yr-consent-decline">
        <p className="yr-consent-decline__title">Form tidak bisa dilanjutkan</p>
        <p className="yr-consent-decline__body">
          Kamu perlu menyetujui penggunaan data untuk melanjutkan pengisian formulir.
        </p>
        <button className="yr-consent-decline__btn" onClick={() => setState('pending')}>
          Berubah Pikiran
        </button>
      </div>
    );
  }

  // Pending — full consent block
  return (
    <div className="yr-consent">
      <span className="yr-consent__eyebrow">Penting</span>
      <h3 className="yr-consent__title">{title}</h3>
      <p className="yr-consent__lead">{leadText}</p>
      <ol className="yr-consent__list">
        {points.map((point, i) => (
          <li key={i}>{point}</li>
        ))}
      </ol>
      <div className="yr-consent__actions">
        <button className="yr-consent__btn" onClick={handleYes}>
          <span className="yr-consent__btn-radio" />
          Ya, saya setuju
        </button>
        <button className="yr-consent__btn" onClick={handleNo}>
          <span className="yr-consent__btn-radio" />
          Tidak
        </button>
      </div>
    </div>
  );
}
