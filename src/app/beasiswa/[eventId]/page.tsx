"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import LandingTemplate from "@/components/LandingTemplate/LandingTemplate";

export default function BeasiswaPage() {
  const params = useParams();
  const eventId = params.eventId as string;

  const [eventData, setEventData] = useState<{ heroTitle?: string; heroSubtitle?: string } | null>(null);

  useEffect(() => {
    async function fetchEvent() {
      if (!db || !eventId) return;
      try {
        const snap = await getDoc(doc(db, "events", eventId));
        if (snap.exists()) {
          const data = snap.data();
          setEventData(data?.landingPageConfig || {});
        }
      } catch {
        // fallback to defaults
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
    />
  );
}
