"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { ChevronLeft, Menu, X } from "lucide-react";
import styles from "./workspace-shell.module.css";

const STORAGE_KEY = "turnmark-sidebar";
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function collapsedSnapshot() {
  return window.localStorage.getItem(STORAGE_KEY) === "collapsed";
}

function collapsedServerSnapshot() {
  return false;
}

function writeCollapsed(collapsed: boolean) {
  window.localStorage.setItem(STORAGE_KEY, collapsed ? "collapsed" : "expanded");
  listeners.forEach((listener) => listener());
}

type SidebarFrameProps = {
  sidebar: React.ReactNode;
  header: React.ReactNode;
  mobileHeader: React.ReactNode;
  footer: React.ReactNode;
  mobileNav: React.ReactNode;
  children: React.ReactNode;
};

export function SidebarFrame({ sidebar, header, mobileHeader, footer, mobileNav, children }: SidebarFrameProps) {
  const pathname = usePathname();
  const collapsed = useSyncExternalStore(subscribe, collapsedSnapshot, collapsedServerSnapshot);
  const [drawer, setDrawer] = useState(false);
  const [drawerPath, setDrawerPath] = useState(pathname);

  if (drawerPath !== pathname) {
    setDrawerPath(pathname);
    setDrawer(false);
  }

  useEffect(() => {
    if (!drawer) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDrawer(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [drawer]);

  function toggleChrome() {
    if (window.matchMedia("(max-width: 1023px)").matches) {
      setDrawer((open) => !open);
      return;
    }
    writeCollapsed(!collapsed);
  }

  return (
    <div className={styles.shell} data-dashboard-shell="v2" data-collapsed={collapsed ? "true" : "false"} data-drawer={drawer ? "open" : "closed"}>
      <button type="button" className={styles.backdrop} aria-label="Close navigation" onClick={() => setDrawer(false)} />
      <aside className={styles.sidebar} id="workspace-sidebar">
        <div className={styles.sidebarTools}>
          <button type="button" className={styles.collapseToggle} aria-pressed={!collapsed} aria-expanded={!collapsed} aria-controls="workspace-sidebar" onClick={toggleChrome}>
            <ChevronLeft size={18} aria-hidden="true" />
            <span>{collapsed ? "Expand sidebar" : "Collapse sidebar"}</span>
          </button>
          <button type="button" className={styles.drawerClose} aria-label="Close navigation" onClick={() => setDrawer(false)}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        {sidebar}
      </aside>
      <div className={styles.body}>
        {header}
        <header className={styles.mobileHeader}>
          <button type="button" className={styles.menuButton} aria-expanded={drawer} aria-controls="workspace-sidebar" onClick={() => setDrawer(true)}>
            <Menu size={18} aria-hidden="true" />
            <span>Menu</span>
          </button>
          {mobileHeader}
        </header>
        <main id="main" className={styles.main}>{children}</main>
        {footer}
        {mobileNav}
      </div>
    </div>
  );
}
