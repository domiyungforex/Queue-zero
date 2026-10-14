import { ClerkProvider } from "@clerk/nextjs";
import { publicEnv } from "@/lib/env";

export default function AuthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <ClerkProvider
      publishableKey={publicEnv.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/dashboard"
      signUpFallbackRedirectUrl="/onboarding"
      afterSignOutUrl="/"
      localization={{
        signIn: { start: { title: "Sign in to TuRnMaRk", titleCombined: "Sign in to TuRnMaRk" } },
        signUp: { start: { title: "Create your TuRnMaRk account", titleCombined: "Create your TuRnMaRk account" } },
      }}
      appearance={{ variables: { colorPrimary: "#008f4c", borderRadius: "0.75rem", fontFamily: "QueueManrope, Arial, sans-serif" } }}
    >
      {children}
    </ClerkProvider>
  );
}
