import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { publicEnv } from "@/lib/env";
import "./globals.css";
import { RegisterWorker } from "@/components/pwa/register";
export const metadata: Metadata = { metadataBase: new URL(publicEnv.NEXT_PUBLIC_APP_URL), title: { default: "TuRnMaRk — Leave the line", template: "%s | TuRnMaRk" }, description: "Scan. Join. Leave the line. Come back when you’re almost next.", manifest: "/manifest.webmanifest", appleWebApp: { capable: true, statusBarStyle: "default", title: "TuRnMaRk" }, icons: { icon: "/icons/icon-192.png", apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }] } };
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#003d32", viewportFit: "cover" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <ClerkProvider
      publishableKey={publicEnv.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/dashboard"
      signUpFallbackRedirectUrl="/dashboard"
      afterSignOutUrl="/"
      localization={{
        signIn: { start: { title: "Sign in to TuRnMaRk", titleCombined: "Sign in to TuRnMaRk" } },
        signUp: { start: { title: "Create your TuRnMaRk account", titleCombined: "Create your TuRnMaRk account" } },
      }}
      appearance={{
        variables: { colorPrimary: "#008f4c", borderRadius: "0.75rem", fontFamily: "QueueManrope, Arial, sans-serif" },
      }}
    >
      <html lang="en">
        <body>
          <a href="#main" className="sr-only focus:not-sr-only focus:block focus:p-4">
            Skip to content
          </a>
          <RegisterWorker />
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
