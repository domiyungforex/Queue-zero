"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import { ResponsiveNavigation } from "@/components/ui/turnmark-system";
import styles from "./site.module.css";

const navigationItems = [
  { href: "/#product", label: "Product" },
  { href: "/#solutions", label: "Solutions" },
  { href: "/pricing", label: "Pricing" },
  { href: "/how-it-works", label: "Resources" },
  { href: "/contact", label: "Contact" },
];

export function MarketingSessionNavigation() {
  const { isLoaded, isSignedIn } = useAuth();
  const signedIn = isLoaded && isSignedIn;

  return (
    <ResponsiveNavigation
      items={navigationItems}
      secondaryAction={signedIn ? { href: "/dashboard", label: "Go to dashboard" } : { href: "/sign-in", label: "Sign in" }}
      primaryAction={signedIn ? { href: "/dashboard/queues/new", label: "Create queue" } : { href: "/sign-up", label: "Get started" }}
    />
  );
}

export function MarketingHeroActions() {
  const { isLoaded, isSignedIn } = useAuth();
  const signedIn = isLoaded && isSignedIn;

  return (
    <div className={styles.tmHeroActions}>
      <Link href={signedIn ? "/dashboard" : "/sign-up"} className={styles.tmPrimaryAction}>
        {signedIn ? "Go to dashboard" : "Get started"} <ArrowRight size={18} aria-hidden="true" />
      </Link>
      <Link href={signedIn ? "/dashboard/queues/new" : "#how-it-works"} className={styles.tmSecondaryAction}>
        {signedIn ? <ArrowRight size={18} aria-hidden="true" /> : <span aria-hidden="true">▶</span>} {signedIn ? "Create queue" : "See how it works"}
      </Link>
    </div>
  );
}

export function MarketingClosingActions() {
  const { isLoaded, isSignedIn } = useAuth();
  const signedIn = isLoaded && isSignedIn;

  return (
    <div className={styles.tmHeroActions}>
      <Link href={signedIn ? "/dashboard" : "/sign-up"} className={styles.tmPrimaryAction}>
        {signedIn ? "Go to dashboard" : "Get started free"} <ArrowRight size={18} aria-hidden="true" />
      </Link>
      {signedIn ? <Link href="/dashboard/queues/new" className={styles.tmSecondaryAction}>Create queue <ArrowRight size={18} aria-hidden="true" /></Link> : null}
    </div>
  );
}

export function MarketingAccountFooterLink() {
  const { isLoaded, isSignedIn } = useAuth();
  return isLoaded && isSignedIn ? <Link href="/dashboard">Dashboard</Link> : <Link href="/sign-in">Sign in</Link>;
}

export function MarketingStickyAction({ arrow }: { arrow: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  const signedIn = isLoaded && isSignedIn;
  return <Link href={signedIn ? "/dashboard/queues/new" : "/sign-up"}>{signedIn ? "Create queue" : "Get started"} {arrow}</Link>;
}
