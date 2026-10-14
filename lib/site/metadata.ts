import type { Metadata } from "next";
export const publicPaths = ["/", "/how-it-works", "/pricing", "/solutions/education", "/contact", "/privacy"] as const;
export function siteUrl() { return new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"); }
export function pageMetadata(title: string, description: string, path: string): Metadata {
  return { title, description, alternates: { canonical: path }, openGraph: { type: "website", siteName: "TuRnMaRk", title, description, url: path, images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "TuRnMaRk — Scan. Join. Leave the line." }] }, twitter: { card: "summary_large_image", title, description, images: ["/opengraph-image"] } };
}
export function jsonLd(value: unknown) { return JSON.stringify(value).replace(/</g, "\\u003c"); }
