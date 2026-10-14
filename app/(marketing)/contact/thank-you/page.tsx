import Link from "next/link";
import { MarketingFrame } from "@/components/marketing/site";
import { pageMetadata } from "@/lib/site/metadata";
import styles from "@/components/marketing/site.module.css";
export const metadata = { ...pageMetadata("Thank you for your inquiry", "Next steps after contacting TuRnMaRk.", "/contact/thank-you"), robots: { index: false, follow: false } };
export default function Thanks() { return <MarketingFrame><main id="main" className={styles.subpage}><h1>Thank you for<br /><em>getting in touch.</em></h1><p className={styles.subpageLead}>If you have just submitted the contact form successfully, your inquiry has been saved for review. No email confirmation is sent automatically.</p><Link href="/how-it-works" className={styles.button}>Explore how TuRnMaRk works</Link></main></MarketingFrame>; }
