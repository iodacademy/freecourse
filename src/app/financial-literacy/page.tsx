import { Metadata } from "next";
import MetaJourney from "@/components/meta/MetaJourney";

export const metadata: Metadata = {
  title: "Kelas Literasi Finansial — IODA Academy",
  description:
    "Verifikasi data Anda lalu mulai belajar Literasi Finansial dari IODA Academy. Khusus peserta yang mendaftar melalui iklan kami.",
};

export default function FinancialLiteracyPage() {
  return (
    <main>
      <MetaJourney />
    </main>
  );
}
