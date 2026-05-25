import type { Metadata } from "next";
import Providers from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Free Course — IODA Academy",
  description:
    "Platform kursus online gratis literasi finansial dari IODA Academy. Belajar melalui video, kuis interaktif, dan dapatkan sertifikat resmi.",
  keywords: "literasi finansial, kursus gratis, sertifikat, IODA Academy",
  openGraph: {
    title: "Free Course — IODA Academy",
    description:
      "Akses puluhan video learning literasi finansial secara gratis dan dapatkan sertifikat.",
    type: "website",
    url: "https://freecourse.iodacademy.id",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
