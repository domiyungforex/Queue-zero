import Link from "next/link";
import { ArrowRight, Building2, CalendarDays, GraduationCap, Landmark, Stethoscope } from "lucide-react";
import { pageMetadata } from "@/lib/site/metadata";
import { Breadcrumbs } from "@/components/marketing/breadcrumbs";
import { MarketingFrame } from "@/components/marketing/site";
import styles from "@/components/marketing/site.module.css";

export const metadata = pageMetadata(
  "Industry solutions",
  "See how schools, universities, hospitals, clinics, corporate teams, event organizers, and government offices run operations on TuRnMaRk.",
  "/solutions",
);

const industries = [
  {
    icon: GraduationCap,
    title: "Schools & Universities",
    description:
      "Accountless student attendance, matric-number validation, course rosters, and campus bursary or clinic queues.",
    href: "/solutions/education",
    cta: "Explore Education",
  },
  {
    icon: Stethoscope,
    title: "Hospitals & Clinics",
    description:
      "Calm reception and consultation queues with scheduled appointment slots and zero unnecessary medical-record collection.",
    href: "/contact",
    cta: "Talk to us",
  },
  {
    icon: Building2,
    title: "Businesses & Service Providers",
    description:
      "Multi-branch walk-in queues, barber/salon bookings, bank service counters, and personal professional workspaces.",
    href: "/sign-up",
    cta: "Create workspace",
  },
  {
    icon: CalendarDays,
    title: "Conferences & Events",
    description:
      "High-throughput check-in queues, workshop attendance tracking, and live capacity management for summits and trainings.",
    href: "/pricing",
    cta: "View Events plan",
  },
  {
    icon: Landmark,
    title: "Government & Public Services",
    description:
      "Structured multi-counter queues across departments with clear public display screens and auditable service logs.",
    href: "/contact",
    cta: "Request demo",
  },
];

export default function SolutionsPage() {
  return (
    <MarketingFrame>
      <main id="main" className={styles.subpage}>
        <Breadcrumbs label="Solutions" path="/solutions" />
        <p className={styles.eyebrow}>INDUSTRIES WE SERVE</p>
        <h1>
          Tailored workflows.
          <br />
          <em>Shared reliability.</em>
        </h1>
        <p className={styles.subpageLead}>
          TuRnMaRk adapts to your organization type during onboarding—enabling only the modules your teams actually need.
        </p>

        <section className={styles.steps} aria-label="Industry solutions">
          {industries.map(({ icon: Icon, title, description, href, cta }) => (
            <article key={title} className={styles.step}>
              <div className={styles.stepTop}>
                <Icon size={24} aria-hidden="true" />
              </div>
              <h3>{title}</h3>
              <p className="mb-5">{description}</p>
              <Link href={href} className="inline-flex items-center gap-2 text-sm font-bold text-[#ff6b2b] hover:underline">
                {cta} <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </article>
          ))}
        </section>
      </main>
    </MarketingFrame>
  );
}
