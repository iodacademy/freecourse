"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import LandingTemplate, { WorkshopData } from "@/components/LandingTemplate/LandingTemplate";

export default function WorkshopPage() {
  const params = useParams();
  const eventId = params.eventId as string;

  const [eventData, setEventData] = useState<{ heroTitle?: string; heroSubtitle?: string } | null>(null);
  const [workshopData, setWorkshopData] = useState<WorkshopData | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!eventId) return;

    async function fetchEvent() {
      try {
        // Gunakan public API — tidak butuh autentikasi, bypass Firestore rules
        const res = await fetch(`/api/events/public/${eventId}`);

        if (res.status === 404) {
          setNotFound(true);
          return;
        }

        if (!res.ok) {
          console.error("[WorkshopPage] API error:", res.status);
          setNotFound(true);
          return;
        }

        const data = await res.json();
        console.log("[WorkshopPage] Event data loaded:", data);

        setEventData(data?.landingPageConfig || {});

        if (data?.workshopData && Object.keys(data.workshopData).length > 0) {
          setWorkshopData(data.workshopData as WorkshopData);
        } else {
          // Event ada tapi workshopData belum diisi admin
          console.warn("[WorkshopPage] workshopData belum diisi untuk event:", eventId);
          setWorkshopData({
            title: data?.name || eventId,
            date: "",
            time: "",
            platform: "",
            speakerName: "",
            speakerTitle: "",
          });
        }
      } catch (err) {
        console.error("[WorkshopPage] Fetch error:", err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }

    fetchEvent();
  }, [eventId]);

  if (loading) {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "sans-serif", color: "#888", flexDirection: "column", gap: 12
      }}>
        <div style={{
          width: 36, height: 36, border: "3px solid #eee",
          borderTop: "3px solid #CC0000", borderRadius: "50%",
          animation: "spin 0.7s linear infinite"
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <span>Memuat workshop...</span>
      </div>
    );
  }

  if (notFound) {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "sans-serif", flexDirection: "column", gap: 12, color: "#333"
      }}>
        <div style={{ fontSize: 48 }}>🔍</div>
        <h2 style={{ margin: 0 }}>Workshop tidak ditemukan</h2>
        <p style={{ color: "#888", margin: 0 }}>Event ID: <code>{eventId}</code></p>
      </div>
    );
  }

  return (
    <LandingTemplate
      type="workshop"
      eventId={eventId}
      heroTitle={eventData?.heroTitle}
      heroSubtitle={eventData?.heroSubtitle}
      workshopData={workshopData || undefined}
    />
  );
}
