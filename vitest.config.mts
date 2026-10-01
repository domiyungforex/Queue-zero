import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    clearMocks: true,
    restoreMocks: true,
    env: {
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      // Syntactic fixture only. This does not identify a real Clerk instance.
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: `pk_test_${Buffer.from("clerk.queuezero.invalid$").toString("base64")}`,
    },
  },
});
