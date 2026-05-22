"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import LandingTemplate from "@/components/LandingTemplate/LandingTemplate";

export default function PartnerPage() {
  const params = useParams();
  const urlPartnerCode = params.partnerCode as string;

  const [partnerName, setPartnerName] = useState<string | undefined>(undefined);
  const [actualPartnerCode, setActualPartnerCode] = useState<string>(urlPartnerCode);

  useEffect(() => {
    async function fetchPartner() {
      if (!db || !urlPartnerCode) return;
      try {
        const q = query(
          collection(db, "events"),
          where("channelType", "==", "b2b_campus"),
          where("partnerCodeLower", "==", urlPartnerCode.toLowerCase())
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          const data = snap.docs[0].data();
          setPartnerName(data.campusName || data.name);
          if (data.partnerCode) {
            setActualPartnerCode(data.partnerCode);
          }
        } else {
          // Fallback legacy partnerCodes
          const legacyQ = query(collection(db, "partnerCodes"), where("code", "==", urlPartnerCode));
          const legacySnap = await getDocs(legacyQ);
          if (!legacySnap.empty) {
            setPartnerName(legacySnap.docs[0].data().partnerName);
            setActualPartnerCode(legacySnap.docs[0].data().code);
          }
        }
      } catch (err) {
        console.error(err);
      }
    }
    fetchPartner();
  }, [urlPartnerCode]);

  const heroTitle = partnerName
    ? <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>Selamat Datang, Mahasiswa/Karyawan {partnerName}! 🤝</span>
    : undefined;

  return (
    <LandingTemplate
      type="kemitraan"
      eventId={actualPartnerCode}
      heroTitle={heroTitle as any}
    />
  );
}
