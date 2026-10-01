import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { publicEnv } from "@/lib/env";
import "./globals.css";
export const metadata: Metadata = { metadataBase: new URL(publicEnv.NEXT_PUBLIC_APP_URL), title: { default: "QueueZero — Leave the line", template: "%s | QueueZero" }, description: "Scan. Join. Leave the line. Come back when you’re almost next." };
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
      appearance={{
        variables: { colorPrimary: "#176b4d", borderRadius: "0.75rem" },
      }}
    >
      <html lang="en">
        <body>
          <a href="#main" className="sr-only focus:not-sr-only focus:block focus:p-4">
            Skip to content
          </a>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
