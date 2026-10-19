import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";
import Link from "next/link";
import styles from "./education-pages.module.css";

export function EducationHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return <header className={styles.heading}>
    <div className={styles.headingCopy}><p className={styles.eyebrow}>{eyebrow}</p><h1>{title}</h1><p className={styles.description}>{description}</p></div>
    {action}
  </header>;
}

export function EducationEmpty({ title, description, href, label = "Get started", icon: Icon = Inbox }: { title: string; description: string; href?: string; label?: string; icon?: LucideIcon }) {
  return <section className={styles.empty}><div><span className={styles.emptyIcon}><Icon size={25} aria-hidden="true" /></span><h2>{title}</h2><p>{description}</p>{href ? <Link className={styles.primary} href={href}>{label}</Link> : null}</div></section>;
}

export function EducationMetric({ icon: Icon, value, label, color, soft }: { icon: LucideIcon; value: string | number; label: string; color: string; soft: string }) {
  return <article className={styles.metric}><span className={styles.metricIcon} style={{ "--color": color, "--soft": soft } as React.CSSProperties}><Icon size={18} aria-hidden="true" /></span><strong>{value}</strong><span>{label}</span></article>;
}

export function EducationStatus({ children, tone = "info" }: { children: React.ReactNode; tone?: "success" | "warning" | "danger" | "muted" | "info" }) {
  return <span className={styles.status} data-tone={tone}>{children}</span>;
}

export function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

export function formatTime(value: string | null) {
  return value ? new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit", timeZone: "UTC" }).format(new Date(value)) : "Time not set";
}
