import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site/metadata";
export default function robots(): MetadataRoute.Robots { return { rules: { userAgent: "*", allow: "/", disallow: ["/dashboard", "/api/", "/attend", "/ticket/", "/t/", "/q/", "/display/", "/onboarding", "/sign-in", "/sign-up", "/contact/thank-you"] }, sitemap: new URL("/sitemap.xml", siteUrl()).href }; }
