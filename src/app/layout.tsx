import Script from 'next/script';
import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { Navbar } from "@/components/Navbar";

export const metadata: Metadata = {
  title: "Lecture Library | Instructor Lecture Archive",
  description: "Private lecture and study workspace for your own authorised recordings.",
  manifest: "/manifest.json",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <Navbar />
          {children}
        </Providers>
      <Script src="/purchase-ui.js" strategy="afterInteractive" /><Script src="/buyer-intro.js" strategy="afterInteractive" /></body>
    </html>
  );
}
