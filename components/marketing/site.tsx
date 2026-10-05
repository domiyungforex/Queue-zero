import Link from "next/link";
import styles from "./site.module.css";

export function Arrow({ diagonal = false }: { diagonal?: boolean }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d={diagonal ? "M6 18 18 6M6 6h12v12" : "M4 12h16m-6-6 6 6-6 6"} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
export function Brand() {
  return <Link href="/" className={styles.brand} aria-label="QueueZero home"><span className={styles.mark} aria-hidden="true"><svg viewBox="0 0 32 32" fill="none"><path d="M6 8h20M16 8v18M22 21l4 5 4-5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg></span><span>TuRn<span className={styles.brandAccent}>MaRk</span></span></Link>;
}

export function MarketingHeader({ signedIn = false }: { signedIn?: boolean }) {
  return (
    <header className={styles.header}>
      <Brand />
      <nav className={styles.desktopNav} aria-label="Main">
        <Link href="/how-it-works">How it works</Link>
        <Link href="/#for-business">For businesses</Link>
        <Link href="/pricing">Plans</Link>
        {signedIn && <Link href="/dashboard">Workspace</Link>}
      </nav>
      <div className={styles.headerActions}>
        {signedIn ? (
          <Link href="/dashboard" className={styles.smallButton}>Open workspace <Arrow diagonal /></Link>
        ) : (
          <>
            <Link href="/sign-in" className={styles.signIn}>Log in</Link>
            <Link href="/sign-up" className={styles.smallButton}>Get started <Arrow diagonal /></Link>
          </>
        )}
      </div>
      <details className={styles.mobileNav}>
        <summary>Menu <span aria-hidden="true">＋</span></summary>
        <nav aria-label="Mobile">
          <Link href="/how-it-works">How it works</Link>
          <Link href="/#for-business">For businesses</Link>
          <Link href="/pricing">Plans</Link>
          {signedIn ? <Link href="/dashboard">Open workspace</Link> : <Link href="/sign-in">Log in</Link>}
        </nav>
      </details>
    </header>
  );
}

export function MarketingFooter({ signedIn = false }: { signedIn?: boolean }) {
  return <footer className={styles.footer}><div><Brand /><p>A little less waiting.<br />A lot more living.</p></div><nav aria-label="Footer"><Link href="/how-it-works">How it works</Link><Link href="/pricing">Plans</Link><Link href={signedIn ? "/dashboard" : "/sign-in"}>{signedIn ? "Open workspace" : "Business login"}</Link></nav><p className={styles.footerNote}>Made for the people<br />on both sides of the counter.</p><div className={styles.footerBottom}><span>© {new Date().getFullYear()} QueueZero</span><span>Your place, without the line.</span></div></footer>;
}

export function MarketingFrame({ children, signedIn = false }: { children: React.ReactNode; signedIn?: boolean }) {
  return <div className={styles.site}><MarketingHeader signedIn={signedIn} />{children}<MarketingFooter signedIn={signedIn} /></div>;
}
