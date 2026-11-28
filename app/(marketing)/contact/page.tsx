import { randomUUID } from "node:crypto";
import { MarketingFrame } from "@/components/marketing/site";
import { Breadcrumbs } from "@/components/marketing/breadcrumbs";
import { InquiryForm } from "@/components/marketing/inquiry-form";
import { pageMetadata } from "@/lib/site/metadata";
import { siteDetails } from "@/lib/site/config";
import styles from "@/components/marketing/site.module.css";
export const dynamic = "force-dynamic";
export const metadata = pageMetadata("Contact the TuRnMaRk team", "Ask about virtual queues, campus attendance or running a TuRnMaRk pilot for your organization.", "/contact");
export default function Contact() { const details = siteDetails(); return <MarketingFrame><main id="main" className={styles.subpage}><Breadcrumbs label="Contact" path="/contact" /><p className={styles.eyebrow}>CONTACT TuRnMaRk</p><h1>Let’s talk about<br /><em>your next queue.</em></h1><p className={styles.subpageLead}>Tell us about your organization and what you need help with. {details.responsePromise || "Your inquiry will be saved for the team to review."}</p><div className={`mb-8 flex flex-wrap gap-6 ${styles.contactMeta}`}>{details.email && <a href={`mailto:${details.email}`}>{details.email}</a>}{details.phone && <a href={`tel:${details.phone.replace(/[ ()-]/g, "")}`}>{details.phone}</a>}</div><InquiryForm requestId={randomUUID()} />{details.address && <section className="mt-12"><h2 className="text-2xl font-semibold">Find us</h2><address className="mt-4 not-italic">{details.address}</address><a className={styles.textLink} href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(details.address)}`} target="_blank" rel="noopener noreferrer">Open map</a><a className={`${styles.textLink} ml-6`} href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(details.address)}`} target="_blank" rel="noopener noreferrer">Get directions</a></section>}</main></MarketingFrame>; }
