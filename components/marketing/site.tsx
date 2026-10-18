import Link from "next/link";
import { siteDetails } from "@/lib/site/config";
import { jsonLd, siteUrl } from "@/lib/site/metadata";
import { MarketingAnalytics } from "./analytics";
import { Brand } from "@/components/ui/brand";
import { ResponsiveNavigation } from "@/components/ui/turnmark-system";
import styles from "./site.module.css";

export function Arrow({ diagonal = false }: { diagonal?: boolean }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d={diagonal ? "M6 18 18 6M6 6h12v12" : "M4 12h16m-6-6 6 6-6 6"} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
export { Brand };
export function MarketingHeader() {
  return <div className={styles.marketingNav}><ResponsiveNavigation items={[{href:"/#product",label:"Product"},{href:"/#solutions",label:"Solutions"},{href:"/pricing",label:"Pricing"},{href:"/how-it-works",label:"Resources"},{href:"/contact",label:"Contact"}]} secondaryAction={{href:"/sign-in",label:"Sign in"}} primaryAction={{href:"/sign-up",label:"Get started"}} /></div>;
}
export function MarketingFooter() {
  return <footer className={styles.footer}><div><Brand /><p>People flow better<br />with TuRnMaRk.</p></div><nav aria-label="Footer"><Link href="/#product">Product</Link><Link href="/#solutions">Solutions</Link><Link href="/how-it-works">How it works</Link><Link href="/pricing">Pricing</Link><Link href="/solutions/education">Education</Link><Link href="/contact">Contact</Link><Link href="/sign-in">Sign in</Link><Link href="/privacy">Privacy</Link></nav><p className={styles.footerNote}>Scan. Join.<br />Leave the line.</p><div className={styles.footerBottom}><span>© {new Date().getFullYear()} TuRnMaRk</span><span>Queues first. Better arrivals everywhere.</span></div></footer>;
}
export function MarketingFrame({ children, stickyCta = true }: { children: React.ReactNode; stickyCta?: boolean }) {
  const details = siteDetails();
  const organization = { "@context": "https://schema.org", "@type": details.address ? "LocalBusiness" : "Organization", name: "TuRnMaRk", url: siteUrl().href, logo: new URL("/icons/icon-512.png", siteUrl()).href, ...(details.email ? { email: details.email } : {}), ...(details.phone ? { telephone: details.phone } : {}), ...(details.address ? { address: details.address } : {}) };
  return <div className={styles.site}><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(organization) }} /><MarketingHeader />{children}<MarketingFooter />{stickyCta?<div className={styles.stickyCta}><Link href="/sign-up">Create a queue <Arrow /></Link></div>:null}{details.gaId && <MarketingAnalytics id={details.gaId} />}</div>;
}
