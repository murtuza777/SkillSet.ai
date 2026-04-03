import type { Metadata } from "next";
import { Source_Sans_3, Space_Grotesk } from "next/font/google";

import { AppProviders } from "@/components/providers/app-providers";
import { SiteShell } from "@/components/layout/site-shell";

import "./globals.css";

const displayFont = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
});

const bodyFont = Source_Sans_3({
  variable: "--font-body",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SkillSet.ai",
  description:
    "Cloudflare-native collaborative learning paths, peer matching, chat, projects, and gamified progress.",
  icons: {
    icon: [{ url: "/logo.png", type: "image/png" }],
    apple: [{ url: "/logo.png", type: "image/png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${displayFont.variable} ${bodyFont.variable}`}>
      <body className="min-h-screen bg-[var(--bg)] text-[var(--ink)] antialiased">
        <AppProviders>
          <SiteShell>{children}</SiteShell>
        </AppProviders>
      </body>
    </html>
  );
}
