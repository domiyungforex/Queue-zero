import Image from "next/image";
import Link from "next/link";
import { Menu, MoveRight } from "lucide-react";
import { Brand } from "@/components/ui/brand";
import { TURNMARK_ASSETS, type TurnmarkAsset } from "@/lib/brand/assets";
import styles from "@/components/ui/turnmark-system.module.css";

type Industry = keyof typeof TURNMARK_ASSETS.industries;
type ProfessionalCharacterName = keyof typeof TURNMARK_ASSETS.characters;
type StatusTone = "neutral" | "success" | "warning" | "danger" | "pending";

function AssetImage({ asset, className, priority = false }: { asset: TurnmarkAsset; className?: string; priority?: boolean }) {
  return (
    <Image
      className={className}
      src={asset.src}
      width={asset.width}
      height={asset.height}
      alt={asset.alt}
      priority={priority}
      sizes="(max-width: 640px) 88vw, 420px"
    />
  );
}

export function IndustryIllustration({ industry, className, priority }: { industry: Industry; className?: string; priority?: boolean }) {
  return <AssetImage asset={TURNMARK_ASSETS.industries[industry]} className={className} priority={priority} />;
}

export function ProfessionalCharacter({ character, className, priority }: { character: ProfessionalCharacterName; className?: string; priority?: boolean }) {
  return <AssetImage asset={TURNMARK_ASSETS.characters[character]} className={className} priority={priority} />;
}

export function GradientDecoration({ tone = "primary", className }: { tone?: "primary" | "secondary" | "soft"; className?: string }) {
  return <span className={[styles.decoration, styles[`decoration-${tone}`], className ?? ""].filter(Boolean).join(" ")} aria-hidden="true" />;
}

export function StatusIndicator({ label, tone = "neutral" }: { label: string; tone?: StatusTone }) {
  return <span className={[styles.status, styles[`status-${tone}`]].join(" ")}><i aria-hidden="true" />{label}</span>;
}

export function IndustrySelectionCard({
  industry,
  title,
  description,
  name,
  value,
  defaultChecked = false,
}: {
  industry: Industry;
  title: string;
  description: string;
  name: string;
  value: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className={styles.selectionCard}>
      <input type="radio" name={name} value={value} defaultChecked={defaultChecked} />
      <span className={styles.selectionVisual}><IndustryIllustration industry={industry} /></span>
      <span className={styles.selectionCopy}><strong>{title}</strong><small>{description}</small></span>
      <span className={styles.selectionMark} aria-hidden="true" />
    </label>
  );
}

export function FeatureIllustrationCard({ asset, eyebrow, title, description, href, linkLabel = "Learn more" }: {
  asset: TurnmarkAsset;
  eyebrow?: string;
  title: string;
  description: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <article className={styles.featureCard}>
      <div className={styles.featureAsset}><AssetImage asset={asset} /></div>
      <div>{eyebrow && <p>{eyebrow}</p>}<h3>{title}</h3><span>{description}</span></div>
      {href && <Link href={href}>{linkLabel}<MoveRight size={16} aria-hidden="true" /></Link>}
    </article>
  );
}

export function DashboardWelcomeBanner({ eyebrow, title, description, character = "student", actions }: {
  eyebrow?: string;
  title: string;
  description: string;
  character?: ProfessionalCharacterName;
  actions?: React.ReactNode;
}) {
  return (
    <section className={styles.welcomeBanner}>
      <GradientDecoration tone="secondary" />
      <div className={styles.welcomeCopy}>
        {eyebrow && <p>{eyebrow}</p>}
        <h2>{title}</h2>
        <span>{description}</span>
        {actions && <div className={styles.welcomeActions}>{actions}</div>}
      </div>
      <ProfessionalCharacter character={character} className={styles.welcomeCharacter} />
    </section>
  );
}

export function ResponsiveNavigation({ items, primaryAction, secondaryAction }: {
  items: readonly { href: string; label: string }[];
  primaryAction?: { href: string; label: string };
  secondaryAction?: { href: string; label: string };
}) {
  const links = items.map((item) => <Link key={item.href} href={item.href}>{item.label}</Link>);

  return (
    <header className={styles.navigation}>
      <Brand priority />
      <nav className={styles.desktopLinks} aria-label="Main navigation">{links}</nav>
      <div className={styles.navigationActions}>
        {secondaryAction && <Link className={styles.secondaryAction} href={secondaryAction.href}>{secondaryAction.label}</Link>}
        {primaryAction && <Link className={styles.primaryAction} href={primaryAction.href}>{primaryAction.label}<MoveRight size={16} aria-hidden="true" /></Link>}
      </div>
      <details className={styles.mobileMenu}>
        <summary role="button" aria-label="Open navigation"><Menu size={22} aria-hidden="true" /></summary>
        <nav aria-label="Mobile navigation">
          {items.map((item) => <Link key={item.href} href={item.href}>{item.label}</Link>)}
          {secondaryAction && <Link href={secondaryAction.href}>{secondaryAction.label}</Link>}
          {primaryAction && <Link className={styles.primaryAction} href={primaryAction.href}>{primaryAction.label}</Link>}
        </nav>
      </details>
    </header>
  );
}
