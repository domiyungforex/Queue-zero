import { PageShell } from "@/components/ui/page-shell";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
export default function NotFound(){return <PageShell title="This page stepped out."><p className="mb-8 max-w-lg text-muted">The link may have changed. Head back to QueueZero, or ask staff for the current queue QR code.</p><Link href="/" className="button-primary"><ArrowLeft size={18}/>Return home</Link></PageShell>}
