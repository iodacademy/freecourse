"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import LandingTemplate from "@/components/LandingTemplate/LandingTemplate";

export default function BeasiswaPage() {
  const params = useParams();
  const eventId = params.eventId as string;

  const [eventData, setEventData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!eventId) return;

    async function fetchEvent() {
      try {
        // Gunakan public API — tidak butuh autentikasi, bypass Firestore rules
        const res = await fetch(`/api/events/public/${eventId}`);
        if (res.ok) {
          const data = await res.json();
          setEventData({
            ...(data?.landingPageConfig || {}),
            beasiswaConfig: data?.beasiswaConfig
          });
        }
      } catch (err) {
        console.error("[BeasiswaPage] Fetch error:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchEvent();
  }, [eventId]);

  return (
    <LandingTemplate
      type="beasiswa"
      eventId={eventId}
      heroTitle={eventData?.heroTitle}
      heroSubtitle={eventData?.heroSubtitle}
      beasiswaConfig={eventData?.beasiswaConfig}
    />
  );
}
