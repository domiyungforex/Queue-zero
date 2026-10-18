import type { Metadata, Viewport } from "next";
import { publicEnv } from "@/lib/env";
import "./globals.css";
import { RegisterWorker } from "@/components/pwa/register";
export const metadata: Metadata = { metadataBase: new URL(publicEnv.NEXT_PUBLIC_APP_URL), title: { default: "TuRnMaRk — Leave the line", template: "%s | TuRnMaRk" }, description: "Scan. Join. Leave the line. Come back when you’re almost next.", manifest: "/manifest.webmanifest", appleWebApp: { capable: true, statusBarStyle: "default", title: "TuRnMaRk" }, icons: { icon: [{ url: "/icon.svg", type: "image/svg+xml" }, { url: "/icons/icon-192.png", type: "image/png" }], apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }] } };
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#111318", viewportFit: "cover" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <a href="#main" className="sr-only focus:not-sr-only focus:block focus:p-4">
          Skip to content
        </a>
        <RegisterWorker />
        {children}
      </body>
    </html>
  );
}
