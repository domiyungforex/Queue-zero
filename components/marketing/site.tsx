import Link from "next/link";
import { siteDetails } from "@/lib/site/config";
import { jsonLd, siteUrl } from "@/lib/site/metadata";
import { MarketingAnalytics } from "./analytics";
import { Brand } from "@/components/ui/brand";
import styles from "./site.module.css";

export function Arrow({ diagonal = false }: { diagonal?: boolean }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d={diagonal ? "M6 18 18 6M6 6h12v12" : "M4 12h16m-6-6 6 6-6 6"} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
export { Brand };
export function MarketingHeader() {
  return <header className={styles.header}><Brand /><nav className={styles.desktopNav} aria-label="Main"><Link href="/how-it-works">How it works</Link><Link href="/#for-business">For businesses</Link><Link href="/pricing">Plans</Link><Link href="/solutions/education">Education</Link><Link href="/contact">Contact</Link><Link href="/dashboard">Workspace</Link></nav><div className={styles.headerActions}><Link href="/sign-in" className={styles.signIn}>Log in</Link><Link href="/sign-up" className={styles.smallButton}>Get started <Arrow diagonal /></Link></div><details className={styles.mobileNav}><summary>Menu <span aria-hidden="true">＋</span></summary><nav aria-label="Mobile"><Link href="/how-it-works">How it works</Link><Link href="/#for-business">For businesses</Link><Link href="/pricing">Plans</Link><Link href="/solutions/education">Education</Link><Link href="/contact">Contact</Link><Link href="/sign-in">Log in</Link></nav></details></header>;
}
export function MarketingFooter() {
  return <footer className={styles.footer}><div><Brand /><p>A little less waiting.<br />A lot more living.</p></div><nav aria-label="Footer"><Link href="/how-it-works">How it works</Link><Link href="/pricing">Plans</Link><Link href="/solutions/education">Education</Link><Link href="/contact">Contact</Link><Link href="/sign-in">Business login</Link><Link href="/privacy">Privacy</Link></nav><p className={styles.footerNote}>Made for the people<br />on both sides of the counter.</p><div className={styles.footerBottom}><span>© {new Date().getFullYear()} TuRnMaRk</span><span>Your place, without the line.</span></div></footer>;
}
export function MarketingFrame({ children }: { children: React.ReactNode }) {
  const details = siteDetails();
  const organization = { "@context": "https://schema.org", "@type": details.address ? "LocalBusiness" : "Organization", name: "TuRnMaRk", url: siteUrl().href, logo: new URL("/icons/icon-512.png", siteUrl()).href, ...(details.email ? { email: details.email } : {}), ...(details.phone ? { telephone: details.phone } : {}), ...(details.address ? { address: details.address } : {}) };
  return <div className={styles.site}><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(organization) }} /><MarketingHeader />{children}<MarketingFooter /><div className={styles.stickyCta}><Link href="/sign-up">Create a queue <Arrow /></Link></div>{details.gaId && <MarketingAnalytics id={details.gaId} />}</div>;
}
