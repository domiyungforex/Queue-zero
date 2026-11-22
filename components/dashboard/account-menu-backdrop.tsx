"use client";

import styles from "./workspace-shell.module.css";

/** Client-side dismissal behavior for the mobile account menu backdrop. */
export function AccountMenuBackdrop() {
  return (
    <div
      className={styles.accountBackdrop}
      aria-hidden="true"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        const details = event.currentTarget.closest("details");
        if (details) details.open = false;
      }}
    />
  );
}
