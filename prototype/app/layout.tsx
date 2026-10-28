import type { Metadata, Viewport } from "next";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import LangSwitch from "@/components/LangSwitch";
import SyncBadge from "@/components/SyncBadge";
import { LangProvider } from "@/components/LangProvider";

export const metadata: Metadata = {
  title: "Sahayak — Citizen OS",
  description: "Schemes, forms, complaints and transport — online or offline, in your own language.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1F3864",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="hi">
      <body className="min-h-dvh pb-16">
        <LangProvider>
          <header className="sticky top-0 z-30 border-b border-[var(--line)] bg-[var(--card)]">
            <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-4 py-3">
              <div className="flex items-center gap-2">
                <img src="/icon.svg" alt="" className="h-7 w-7" />
                <strong className="text-lg">सहायक</strong>
              </div>
              <div className="flex items-center gap-2">
                <SyncBadge />
                <LangSwitch />
              </div>
            </div>
          </header>
          <main className="mx-auto max-w-3xl px-4 py-5">{children}</main>
          <BottomNav />
        </LangProvider>
      </body>
    </html>
  );
}
