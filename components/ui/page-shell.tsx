import Link from "next/link";
import { AuthNavigation } from "@/components/auth/auth-navigation";

export function PageShell({ title, children, showAccount = true }: { title: string; children: React.ReactNode; showAccount?: boolean }) {
  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-black/10 px-6 py-5">
        <Link href="/" className="text-xl font-bold tracking-tight">Queue<span className="text-primary">Zero</span></Link>
        {showAccount && <nav aria-label="Account"><AuthNavigation /></nav>}
      </header>
      <main id="main" className="mx-auto max-w-5xl px-6 py-12">
        <h1 className="mb-5 text-3xl font-semibold tracking-tight">{title}</h1>
        {children}
      </main>
    </>
  );
}
