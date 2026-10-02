import Link from "next/link";
import styles from "./site.module.css";

export function Arrow({ diagonal = false }: { diagonal?: boolean }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d={diagonal ? "M6 18 18 6M6 6h12v12" : "M4 12h16m-6-6 6 6-6 6"} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
export function Brand() {
  return <Link href="/" className={styles.brand} aria-label="QueueZero home"><span className={styles.mark} aria-hidden="true"><svg viewBox="0 0 32 32" fill="none"><path d="M22 24a11 11 0 1 1 4-8M18 20l8 8M26 22v6h-6" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg></span>queuezero</Link>;
}
export function MarketingHeader() {
  return <header className={styles.header}><Brand /><nav className={styles.desktopNav} aria-label="Main"><Link href="/how-it-works">How it works</Link><Link href="/#for-business">For businesses</Link><Link href="/pricing">Plans</Link><Link href="/demo">Explore demo</Link></nav><div className={styles.headerActions}><Link href="/sign-in" className={styles.signIn}>Log in</Link><Link href="/sign-up" className={styles.smallButton}>Get started <Arrow diagonal /></Link></div><details className={styles.mobileNav}><summary>Menu <span aria-hidden="true">＋</span></summary><nav aria-label="Mobile"><Link href="/how-it-works">How it works</Link><Link href="/#for-business">For businesses</Link><Link href="/pricing">Plans</Link><Link href="/sign-in">Log in</Link></nav></details></header>;
}
export function MarketingFooter() {
  return <footer className={styles.footer}><div><Brand /><p>A little less waiting.<br />A lot more living.</p></div><nav aria-label="Footer"><Link href="/how-it-works">How it works</Link><Link href="/pricing">Plans</Link><Link href="/sign-in">Business login</Link></nav><p className={styles.footerNote}>Made for the people<br />on both sides of the counter.</p><div className={styles.footerBottom}><span>© {new Date().getFullYear()} QueueZero</span><span>Your place, without the line.</span></div></footer>;
}
export function TicketPreview() {
  return <div className={styles.ticket}><div className={styles.ticketTop}><span><i /> Your place is saved</span><span>EXAMPLE</span></div><div className={styles.ticketNumber}>A014<svg width="36" height="36" viewBox="0 0 36 36" fill="none" aria-hidden="true"><circle cx="18" cy="18" r="16" stroke="currentColor" strokeWidth="1.5" /><path d="m11 18 5 5 9-10" stroke="currentColor" strokeWidth="1.8" /></svg></div><div className={styles.ticketTear} /><div className={styles.ticketDetails}><div><strong>3</strong><span>people ahead</span></div><div><strong>15–20 min</strong><span>estimated wait</span></div></div><p>You’re in line. Go enjoy your time.</p></div>;
}
export function MarketingFrame({ children }: { children: React.ReactNode }) {
  return <div className={styles.site}><MarketingHeader />{children}<MarketingFooter /></div>;
}
