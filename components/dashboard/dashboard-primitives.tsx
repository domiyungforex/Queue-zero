import Image from "next/image";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import type { TurnmarkAsset } from "@/lib/brand/assets";
import styles from "./dashboard-primitives.module.css";

export function DashboardKpiCard({ icon: Icon, value, label, color, soft }: { icon: LucideIcon; value: string | number; label: string; color: string; soft: string }) {
  return <article className={styles.kpi} style={{ "--kpi-color": color, "--kpi-soft": soft } as React.CSSProperties}><span className={styles.kpiIcon}><Icon size={17} aria-hidden="true" /></span><strong>{value}</strong><p>{label}</p></article>;
}
export function DashboardSection({ title, href, linkLabel = "View all", children, className = "" }: { title: string; href?: string; linkLabel?: string; children: React.ReactNode; className?: string }) {
  return <section className={`${styles.section} ${className}`}><header className={styles.sectionHeader}><h2>{title}</h2>{href ? <Link href={href}>{linkLabel}</Link> : null}</header><div className={styles.sectionBody}>{children}</div></section>;
}
export function DashboardStatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase().replaceAll("_", " ");
  const tone = ["present", "open", "live", "completed", "confirmed"].includes(normalized) ? styles.success : ["absent", "cancelled", "flagged"].includes(normalized) ? styles.danger : ["late", "waiting", "paused"].includes(normalized) ? styles.warning : styles.accent;
  return <span className={`${styles.status} ${tone}`}>{normalized}</span>;
}
export function DashboardEmptyState({ title, description, href, label }: { title: string; description: string; href?: string; label?: string }) {
  return <div className={styles.empty}><div><h3>{title}</h3><p>{description}</p>{href && label ? <Link href={href}>{label}</Link> : null}</div></div>;
}
export function WorkspaceCharacter({ asset, className = "", priority = false }: { asset: TurnmarkAsset; className?: string; priority?: boolean }) {
  return <div className={`${styles.character} ${className}`}><Image src={asset.src} width={asset.width} height={asset.height} alt="" aria-hidden="true" priority={priority} sizes="(max-width: 950px) 42vw, 240px" /></div>;
}
