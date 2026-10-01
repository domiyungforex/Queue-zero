import Link from "next/link";

export function PublicQueueShell({ children }: { children: React.ReactNode }) {
  return <>
    <header className="border-b border-black/10 bg-white">
      <div className="mx-auto flex max-w-lg flex-wrap items-center justify-between gap-3 px-5 py-3">
        <Link href="/" className="inline-flex min-h-11 items-center text-xl font-bold tracking-tight">Queue<span className="text-primary">Zero</span></Link>
        <p className="text-sm text-muted">No app. No account.</p>
      </div>
    </header>
    <main id="main" className="mx-auto max-w-lg px-5 py-8 sm:py-10">{children}</main>
  </>;
}
