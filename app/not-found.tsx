import { PageShell } from "@/components/ui/page-shell";
import Link from "next/link";
export default function NotFound() { return <PageShell title="Page not found"><p className="mb-6 text-muted">Check the link and try again.</p><Link href="/" className="text-primary underline">Return home</Link></PageShell>; }
