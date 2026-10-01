import "server-only";
import { auth } from "@clerk/nextjs/server";
import { cache } from "react";

/** Use at every protected data entry point, including future actions and APIs. */
export const requireUserId = cache(async (): Promise<string> => {
  const { userId } = await auth.protect();
  return userId;
});
