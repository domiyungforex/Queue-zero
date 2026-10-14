import Link from "next/link";
import styles from "@/components/marketing/site.module.css";
export function Brand() { return <Link href="/" className={styles.brand} aria-label="TuRnMaRk home"><span className={styles.mark} aria-hidden="true"><svg viewBox="0 0 32 32" fill="none"><path d="M6 8h20M16 8v18M22 21l4 5 4-5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg></span><span>TuRn<span className={styles.brandAccent}>MaRk</span></span></Link>; }
