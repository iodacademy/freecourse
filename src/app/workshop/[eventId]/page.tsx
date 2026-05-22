"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import LandingTemplate, { WorkshopData } from "@/components/LandingTemplate/LandingTemplate";

export default function WorkshopPage() {
  const params = useParams();
  const eventId = params.eventId as string;

  const [eventData, setEventData] = useState<{ heroTitle?: string; heroSubtitle?: string } | null>(null);
  const [workshopData, setWorkshopData] = useState<WorkshopData | null>(null);

  useEffect(() => {
    async function fetchEvent() {
      if (!db || !eventId) return;
      try {
        const snap = await getDoc(doc(db, "events", eventId));
        if (snap.exists()) {
          const data = snap.data();
          setEventData(data?.landingPageConfig || {});
          if (data?.workshopData) {
            setWorkshopData(data.workshopData);
          } else {
             // Fallback mock data if none exists so the user can preview the UI
             setWorkshopData({
               title: "Judul Workshop Akan Tampil Di Sini",
               date: "15 Juni 2026",
               time: "Sabtu - 09.00-12.00 WIB",
               platform: "Zoom Online",
               speakerName: "Nama Pemateri",
               speakerTitle: "Jabatan / Title Pemateri"
             });
          }
        } else {
           // Mock data for previewing without DB setup
           setWorkshopData({
             title: "Judul Workshop Akan Tampil Di Sini",
             date: "15 Juni 2026",
             time: "Sabtu - 09.00-12.00 WIB",
             platform: "Zoom Online",
             speakerName: "Nama Pemateri",
             speakerTitle: "Jabatan / Title Pemateri"
           });
        }
      } catch {
        // fallback to defaults
      }
    }
    fetchEvent();
  }, [eventId]);

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

