import Link from "next/link";
import { ClerkProvider } from "@clerk/nextjs";
import { siteDetails } from "@/lib/site/config";
import { jsonLd, siteUrl } from "@/lib/site/metadata";
import { publicEnv } from "@/lib/env";
import { MarketingAnalytics } from "./analytics";
import { Brand } from "@/components/ui/brand";
import { MarketingAccountFooterLink, MarketingSessionNavigation, MarketingStickyAction } from "@/components/marketing/session-actions";
import { ClerkAnalyticsIdentity } from "@/lib/analytics/identity";
import styles from "./site.module.css";

export function Arrow({ diagonal = false }: { diagonal?: boolean }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d={diagonal ? "M6 18 18 6M6 6h12v12" : "M4 12h16m-6-6 6 6-6 6"} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
export { Brand };
export function MarketingHeader() {
  return <div className={styles.marketingNav}><MarketingSessionNavigation /></div>;
}
export function MarketingFooter() {
  return <footer className={styles.footer}><div><Brand /><p>People flow better<br />with TuRnMaRk.</p></div><nav aria-label="Footer"><Link href="/features">Features</Link><Link href="/solutions">Solutions</Link><Link href="/how-it-works">How it works</Link><Link href="/pricing">Pricing</Link><Link href="/solutions/education">Education</Link><Link href="/about">About</Link><Link href="/team">Team</Link><Link href="/help">Help</Link><Link href="/contact">Contact</Link><MarketingAccountFooterLink /><Link href="/privacy">Privacy</Link></nav><p className={styles.footerNote}>Scan. Join.<br />Leave the line.</p><div className={styles.footerBottom}><span>© {new Date().getFullYear()} TuRnMaRk</span><span>Queues first. Better arrivals everywhere.</span></div></footer>;
}
export function MarketingFrame({ children, stickyCta = true }: { children: React.ReactNode; stickyCta?: boolean }) {
  const details = siteDetails();
  const organization = { "@context": "https://schema.org", "@type": details.address ? "LocalBusiness" : "Organization", name: "TuRnMaRk", url: siteUrl().href, logo: new URL("/icons/icon-512.png", siteUrl()).href, ...(details.email ? { email: details.email } : {}), ...(details.phone ? { telephone: details.phone } : {}), ...(details.address ? { address: details.address } : {}) };
  return <ClerkProvider publishableKey={publicEnv.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY} signInUrl="/sign-in" signUpUrl="/sign-up" afterSignOutUrl="/"><ClerkAnalyticsIdentity /><div className={styles.site}><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(organization) }} /><MarketingHeader />{children}<MarketingFooter />{stickyCta?<div className={styles.stickyCta}><MarketingStickyAction arrow={<Arrow />} /></div>:null}{details.gaId && <MarketingAnalytics id={details.gaId} />}</div></ClerkProvider>;
}
