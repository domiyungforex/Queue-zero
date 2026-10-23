"use client";

import type { ReactNode } from "react";
import { Menu } from "lucide-react";
import styles from "./turnmark-system.module.css";

export function MobileNavigationMenu({ children }: { children: ReactNode }) {
  return <details
    className={styles.mobileMenu}
    onClick={(event) => {
      if (event.target instanceof Element && event.target.closest("a")) event.currentTarget.open = false;
    }}
    onKeyDown={(event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.currentTarget.open = false;
      event.currentTarget.querySelector("summary")?.focus();
    }}
  >
    <summary role="button" aria-label="Open navigation"><Menu size={22} aria-hidden="true" /></summary>
    <nav aria-label="Mobile navigation">{children}</nav>
  </details>;
}
