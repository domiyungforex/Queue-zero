import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { publicEnv } from "@/lib/env";
import "./globals.css";
import { RegisterWorker } from "@/components/pwa/register";
export const metadata: Metadata = { metadataBase: new URL(publicEnv.NEXT_PUBLIC_APP_URL), title: { default: "QueueZero — Leave the line", template: "%s | QueueZero" }, description: "Scan. Join. Leave the line. Come back when you’re almost next.", manifest: "/manifest.webmanifest", appleWebApp: { capable: true, statusBarStyle: "default", title: "QueueZero" }, icons: { icon: "/icons/icon-192.png", apple: "/icons/icon-192.png" } };
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#176b4d" };
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
        signIn: { start: { title: "Sign in to QueueZero", titleCombined: "Sign in to QueueZero" } },
        signUp: { start: { title: "Create your QueueZero account", titleCombined: "Create your QueueZero account" } },
      }}
      appearance={{
        variables: { colorPrimary: "#173e31", borderRadius: "0.75rem", fontFamily: "QueueManrope, Arial, sans-serif" },
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
