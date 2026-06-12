import { Metadata } from "next";
import StandaloneJourney from "@/components/standalone/StandaloneJourney";

export const metadata: Metadata = {
  title: "Kursus Gratis — IODA Academy",
  description: "Mulai belajar kursus gratis Literasi Finansial dari IODA Academy secara langsung tanpa login.",
};

export default function StandalonePage() {
  return (
    <main>
      <StandaloneJourney />
    </main>
  );
}
