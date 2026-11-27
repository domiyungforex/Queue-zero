import Link from "next/link";
import { ArrowRight, BarChart3, CalendarClock, QrCode, ShieldCheck, UsersRound } from "lucide-react";
import { pageMetadata } from "@/lib/site/metadata";
import { Breadcrumbs } from "@/components/marketing/breadcrumbs";
import { MarketingFrame } from "@/components/marketing/site";
import styles from "@/components/marketing/site.module.css";

export const metadata = pageMetadata(
  "Platform features",
  "Explore TuRnMaRk queue management, scheduled bookings, smart attendance, role-based team controls, and live operational analytics.",
  "/features",
);

const featureGroups = [
  {
    icon: QrCode,
    eyebrow: "QUEUE MANAGEMENT",
    title: "QR joining & atomic Call Next",
    description:
      "Customers scan a single QR code, receive a private live ticket, and wait remotely. Staff call the next customer safely with concurrency-protected operations.",
  },
  {
    icon: CalendarClock,
    eyebrow: "BOOKINGS & APPOINTMENTS",
    title: "Scheduled slots + walk-in queues",
    description:
      "Reserve capacity for scheduled appointments alongside walk-in lines, with configurable grace periods, rescheduling, and automated check-in.",
  },
  {
    icon: UsersRound,
    eyebrow: "SMART ATTENDANCE",
    title: "Roster-verified class & event check-ins",
    description:
      "Run rotating QR attendance for schools, universities, workshops, and conferences with real-time lecturer views and clean CSV/PDF/Excel exports.",
  },
  {
    icon: ShieldCheck,
    eyebrow: "TEAM & RBAC",
    title: "Granular workspace roles",
    description:
      "Assign Owner, Admin, Manager, Staff, and Viewer permissions, scope staff to specific queues or academic units, and manage invitations cleanly.",
  },
  {
    icon: BarChart3,
    eyebrow: "REALTIME & ANALYTICS",
    title: "Authoritative operational insight",
    description:
      "Track real wait times, service durations, no-show rates, and attendance history backed directly by Postgres without invented metrics.",
  },
];

export default function FeaturesPage() {
  return (
    <MarketingFrame>
      <main id="main" className={styles.subpage}>
        <Breadcrumbs label="Features" path="/features" />
        <p className={styles.eyebrow}>PLATFORM CAPABILITIES</p>
        <h1>
          One calm platform.
          <br />
          <em>Built for physical arrivals.</em>
        </h1>
        <p className={styles.subpageLead}>
          Every module in TuRnMaRk shares the same isolated organization foundation, strict security boundaries, and
          mobile-first customer experience.
        </p>

        <section className={styles.steps} aria-label="Core platform features">
          {featureGroups.map(({ icon: Icon, eyebrow, title, description }) => (
            <article key={title} className={styles.step}>
              <div className={styles.stepTop}>
                <Icon size={24} aria-hidden="true" />
                <span>{eyebrow}</span>
              </div>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </section>

        <div className="mt-10 flex flex-wrap gap-4">
          <Link href="/sign-up" className={styles.tmPrimaryAction}>
            Get started free <ArrowRight size={17} aria-hidden="true" />
          </Link>
          <Link href="/pricing" className={styles.tmSecondaryAction}>
            View pricing plans
          </Link>
        </div>
      </main>
    </MarketingFrame>
  );
}
