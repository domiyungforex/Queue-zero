import type { Metadata, Viewport } from "next";
import { publicEnv } from "@/lib/env";
import "./globals.css";
export const metadata: Metadata = { metadataBase: new URL(publicEnv.NEXT_PUBLIC_APP_URL), title: { default: "QueueZero — Leave the line", template: "%s | QueueZero" }, description: "Scan. Join. Leave the line. Come back when you’re almost next." };
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#176b4d" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body><a href="#main" className="sr-only focus:not-sr-only focus:block focus:p-4">Skip to content</a>{children}</body></html>; }
