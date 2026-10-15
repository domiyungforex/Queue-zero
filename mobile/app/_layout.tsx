import { ClerkProvider } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

const key = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
if (!key) throw new Error("TuRnMaRk mobile Clerk environment is missing.");

export default function RootLayout() {
  return <ClerkProvider publishableKey={key} tokenCache={tokenCache}>
    <StatusBar style="dark" />
    <Stack screenOptions={{ headerShadowVisible: false, headerTitleStyle: { fontWeight: "700" } }} />
  </ClerkProvider>;
}