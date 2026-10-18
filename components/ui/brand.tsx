import Image from "next/image";
import Link from "next/link";
import { TURNMARK_ASSETS } from "@/lib/brand/assets";
import styles from "@/components/ui/brand.module.css";

type BrandProps = {
  className?: string;
  compact?: boolean;
  href?: string;
  priority?: boolean;
};

export function Brand({ className, compact = false, href = "/", priority = false }: BrandProps) {
  const classes = [styles.brand, compact ? styles.compact : "", className ?? ""].filter(Boolean).join(" ");

  return (
    <Link href={href} className={classes} aria-label="TuRnMaRk home">
      <Image
        className={styles.symbol}
        src={TURNMARK_ASSETS.branding.symbol.src}
        width={TURNMARK_ASSETS.branding.symbol.width}
        height={TURNMARK_ASSETS.branding.symbol.height}
        alt=""
        priority={priority}
      />
      {!compact && (
        <Image
          className={styles.wordmark}
          src={TURNMARK_ASSETS.branding.wordmark.src}
          width={TURNMARK_ASSETS.branding.wordmark.width}
          height={TURNMARK_ASSETS.branding.wordmark.height}
          alt=""
          priority={priority}
        />
      )}
    </Link>
  );
}
