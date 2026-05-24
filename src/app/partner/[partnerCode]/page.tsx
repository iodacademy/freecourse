"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import LandingTemplate from "@/components/LandingTemplate/LandingTemplate";

export default function PartnerPage() {
  const params = useParams();
  const urlPartnerCode = (params.partnerCode as string).toUpperCase();

  const [partnerName, setPartnerName] = useState<string | undefined>(undefined);
  const [audienceLabel, setAudienceLabel] = useState<string>("Mahasiswa/Karyawan");
  const [eventId, setEventId] = useState<string>("");
  const [isReady, setIsReady] = useState(false); // tunggu fetch selesai sebelum render

  useEffect(() => {
    async function fetchPartner() {
      if (!urlPartnerCode) {
        setIsReady(true);
        return;
      }
      try {
        const res = await fetch("/api/partner-codes/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: urlPartnerCode }),
        });
        const data = await res.json();
        if (data.valid) {
          setPartnerName(data.partnerName);
          setEventId(data.eventId || "");
          if (data.audienceLabel) setAudienceLabel(data.audienceLabel);
        }
      } catch (err) {
        console.error("Gagal fetch partner:", err);
      } finally {
        setIsReady(true);
      }
    }
    fetchPartner();
  }, [urlPartnerCode]);

  // Jangan render apapun sampai data selesai di-fetch → mencegah flash default title
  if (!isReady) {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center",
        justifyContent: "center", flexDirection: "column", gap: 12,
      }}>
        <div style={{
          width: 32, height: 32, border: "3px solid #eee",
          borderTop: "3px solid #CC0000", borderRadius: "50%",
          animation: "spin 0.7s linear infinite",
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const heroTitle = partnerName
    ? `Selamat Datang, ${audienceLabel} ${partnerName}! 🤝`
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
