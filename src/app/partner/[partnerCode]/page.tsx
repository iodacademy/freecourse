"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import LandingTemplate from "@/components/LandingTemplate/LandingTemplate";

export default function PartnerPage() {
  const params = useParams();
  const partnerCode = params.partnerCode as string;

  const [partnerName, setPartnerName] = useState<string | undefined>(undefined);

  useEffect(() => {
    async function fetchPartner() {
      if (!db || !partnerCode) return;
      try {
        const snap = await getDoc(doc(db, "partnerCodes", partnerCode));
        if (snap.exists()) {
          setPartnerName(snap.data()?.partnerName);
        }
      } catch {
        // fallback
      }
    }
    fetchPartner();
  }, [partnerCode]);

  const heroTitle = partnerName
    ? `Selamat Datang, Mahasiswa/Karyawan ${partnerName}! 🤝`
    : undefined;

  return (
    <LandingTemplate
      type="kemitraan"
      eventId={partnerCode}
      heroTitle={heroTitle}
    />
  );
}
