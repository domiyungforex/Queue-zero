import "server-only";
import { z } from "zod";
const text = z.string().trim().min(1).max(300);
export function siteDetails() {
  const email = z.email().safeParse(process.env.SITE_CONTACT_EMAIL);
  const phone = z.string().regex(/^\+[1-9][0-9 ()-]{6,24}$/).safeParse(process.env.SITE_CONTACT_PHONE);
  const address = text.safeParse(process.env.SITE_PUBLIC_ADDRESS);
  const promise = text.safeParse(process.env.SITE_RESPONSE_PROMISE);
  const ga = z.string().regex(/^G-[A-Z0-9]{5,20}$/).safeParse(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID);
  return { email: email.success ? email.data : null, phone: phone.success ? phone.data : null, address: address.success ? address.data : null, responsePromise: promise.success ? promise.data : null, gaId: ga.success ? ga.data : null };
}
