import Link from "next/link";
import { ArrowRight, BookOpen, ShieldCheck, UsersRound } from "lucide-react";
import { pageMetadata } from "@/lib/site/metadata";
import { Breadcrumbs } from "@/components/marketing/breadcrumbs";
import { MarketingFrame } from "@/components/marketing/site";
import styles from "@/components/marketing/site.module.css";

export const metadata = pageMetadata(
  "Help & Documentation",
  "Guides for setting up queues, managing student attendance, inviting team members, and configuring billing on TuRnMaRk.",
  "/help",
);

const guides = [
  {
    icon: BookOpen,
    title: "Setting up your first queue",
    description:
      "Create a location, configure service duration and capacity, print or share your QR code, and start calling tickets from the staff console.",
    href: "/how-it-works",
    linkLabel: "See how it works",
  },
  {
    icon: UsersRound,
    title: "Running smart class attendance",
    description:
      "Import your student roster or share a one-time registration link, launch a QR session, and export verified attendance sheets.",
    href: "/solutions/education",
    linkLabel: "Explore education attendance",
  },
  {
    icon: ShieldCheck,
    title: "Team roles & billing",
    description:
      "Assign Owner, Admin, Manager, Staff, or Viewer roles to teammates, and upgrade capacity securely via Paystack.",
    href: "/pricing",
    linkLabel: "Compare plans and billing",
  },
];

export default function HelpPage() {
  return (
    <MarketingFrame>
      <main id="main" className={styles.subpage}>
        <Breadcrumbs label="Help" path="/help" />
        <p className={styles.eyebrow}>DOCUMENTATION & HELP</p>
        <h1>
          Clear answers.
          <br />
          <em>Fast setup.</em>
        </h1>
        <p className={styles.subpageLead}>
          Everything your staff, lecturers, and administrators need to run TuRnMaRk smoothly.
        </p>

        <section className={styles.guideGrid} aria-label="Help guides">
          {guides.map(({ icon: Icon, title, description, href, linkLabel }) => (
            <article key={title} className={styles.guideCard}>
              <div className={styles.guideIcon}>
                <Icon size={24} aria-hidden="true" />
              </div>
              <h3>{title}</h3>
              <p>{description}</p>
              <Link href={href} className={styles.guideLink}>
                {linkLabel} <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </article>
          ))}
        </section>

        <section className={styles.contactBand} aria-labelledby="help-contact-title">
          <div>
            <h2 id="help-contact-title">Still stuck?</h2>
            <p>Tell us what you are trying to do and the team will point you in the right direction.</p>
          </div>
          <Link href="/contact" className={styles.contactBandAction}>
            Still need help? Contact support <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </section>
      </main>
    </MarketingFrame>
  );
}
