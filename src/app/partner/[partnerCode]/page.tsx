"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import LandingTemplate from "@/components/LandingTemplate/LandingTemplate";

export default function PartnerPage() {
  const params = useParams();
  const urlPartnerCode = (params.partnerCode as string).toUpperCase();

  const [partnerName, setPartnerName] = useState<string | undefined>(undefined);
  // eventId = Firestore doc ID (internal), partnerCode = kode pendek (untuk user)
  const [eventId, setEventId] = useState<string>("");

  useEffect(() => {
    async function fetchPartner() {
      if (!urlPartnerCode) return;
      try {
        const res = await fetch("/api/partner-codes/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: urlPartnerCode }),
        });
        const data = await res.json();
        if (data.valid) {
          setPartnerName(data.partnerName);
          setEventId(data.eventId || ""); // Firestore doc ID
        }
      } catch (err) {
        console.error("Gagal fetch partner:", err);
      }
    }
    fetchPartner();
  }, [urlPartnerCode]);

  const heroTitle = partnerName
    ? `Selamat Datang, Mahasiswa/Karyawan ${partnerName}! 🤝`
    : undefined;

  return (
    <LandingTemplate
      type="kemitraan"
      eventId={eventId}
      partnerCode={urlPartnerCode}
      heroTitle={heroTitle as any}
    />
  );
}
