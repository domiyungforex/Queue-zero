import type { Metadata } from "next";
import { PageShell } from "@/components/ui/page-shell";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
export const metadata: Metadata = { title: "Page not found", description: "Find your way back to TuRnMaRk, get help or open a current queue link.", robots: { index: false, follow: true } };
export default function NotFound(){return <PageShell title="This page stepped out."><p className="mb-2 text-sm font-semibold text-muted">404 · Page not found</p><p className="mb-8 max-w-lg text-muted">The link may have changed. Head back to TuRnMaRk, or ask staff for the current queue QR code.</p><div className="flex flex-wrap gap-4"><Link href="/" className="button-primary"><ArrowLeft size={18}/>Return home</Link><Link href="/contact" className="button-secondary">Get help</Link></div></PageShell>}
