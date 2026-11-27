import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { pageMetadata } from "@/lib/site/metadata";
import { Breadcrumbs } from "@/components/marketing/breadcrumbs";
import { MarketingFrame } from "@/components/marketing/site";
import styles from "@/components/marketing/site.module.css";

export const metadata = pageMetadata(
  "About TuRnMaRk",
  "Learn why we built TuRnMaRk to give people their time back and help physical organizations run calmer arrivals.",
  "/about",
);

export default function AboutPage() {
  return (
    <MarketingFrame>
      <main id="main" className={styles.subpage}>
        <Breadcrumbs label="About" path="/about" />
        <p className={styles.eyebrow}>ABOUT TURNMARK</p>
        <h1>
          Give people
          <br />
          <em>their time back.</em>
        </h1>
        <p className={styles.subpageLead}>
          TuRnMaRk was built around a simple observation: physical waiting rooms and paper attendance sheets waste
          millions of hours because organizations lack lightweight, reliable software.
        </p>

        <div className={styles.prose}>
          <h2>Designed for real physical spaces</h2>
          <p>
            Customers and students shouldn’t have to install an app or create an account just to wait in line or mark
            attendance. A single QR scan opens a fast, mobile-first flow that works on any phone browser.
          </p>

          <h2>Built on strict operational correctness</h2>
          <p>
            Behind the calm interface, TuRnMaRk enforces tenant isolation, concurrency-safe queue transitions,
            cryptographic payment verification, and auditable event timelines so organizations can depend on it every day.
          </p>

          <div className="mt-8 flex flex-wrap gap-4">
            <Link href="/team" className={styles.tmSecondaryAction}>
              Meet the team
            </Link>
            <Link href="/contact" className={styles.tmPrimaryAction}>
              Contact us <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </main>
    </MarketingFrame>
  );
}
