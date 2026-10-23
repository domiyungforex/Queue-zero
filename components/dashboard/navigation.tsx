"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  Building2,
  CalendarDays,
  ClipboardCheck,
  CreditCard,
  FileText,
  LayoutDashboard,
  ListOrdered,
  MapPin,
  Settings2,
  MoreHorizontal,
  UsersRound,
} from "lucide-react";
import type { Database } from "@/lib/db/database.types";
import styles from "./workspace-shell.module.css";

type WorkspaceOwnership = Database["public"]["Enums"]["workspace_ownership"];
type ProfessionalCategory = Database["public"]["Enums"]["professional_category"];
type OrganizationType = Database["public"]["Enums"]["organization_type"];

type DashboardNavigationProps = {
  role: "owner" | "admin" | "staff" | "lecturer" | "student";
  mode?: "BUSINESS" | "SCHOOL" | "HYBRID";
  workspaceOwnership?: WorkspaceOwnership;
  professionalCategory?: ProfessionalCategory;
  organizationType?: OrganizationType;
  institution?: boolean;
  institutionTeaching?: boolean;
  institutionStaffManagement?: boolean;
  variant?: "desktop" | "mobile";
};

type NavigationLink = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
};

export function DashboardNavigation({
  role,
  mode = "BUSINESS",
  workspaceOwnership = "ORGANIZATION",
  professionalCategory,
  organizationType,
  institution = false,
  institutionTeaching = false,
  institutionStaffManagement = false,
  variant = "desktop",
}: DashboardNavigationProps) {
  const pathname = usePathname();
  const manager = role === "owner" || role === "admin";
  const owner = role === "owner";
  const individualLecturer = workspaceOwnership === "INDIVIDUAL" && professionalCategory === "LECTURER_TEACHER";
  const individualService = workspaceOwnership === "INDIVIDUAL" && Boolean(professionalCategory) && !individualLecturer;
  const education = mode !== "BUSINESS" || organizationType === "UNIVERSITY_SCHOOL" || individualLecturer;
  const teaching = education && (manager || role === "lecturer" || institutionTeaching);
  const links: NavigationLink[] = [];

  if (role !== "student") links.push({ href: "/dashboard", label: variant === "mobile" ? "Home" : "Dashboard", icon: LayoutDashboard });

  if (individualLecturer && teaching) {
    links.push(
      { href: "/dashboard/courses", label: "Courses", icon: BookOpen },
      { href: "/dashboard/classes", label: "Classes", icon: CalendarDays },
      { href: "/dashboard/attendance", label: "Attendance", icon: ClipboardCheck },
      { href: "/dashboard/students", label: "Students", icon: UsersRound },
      { href: "/dashboard/exports", label: "Reports", icon: FileText },
    );
  } else if (individualService) {
    links.push(
      { href: "/dashboard/services", label: "Services", icon: Building2 },
      { href: "/dashboard/queues", label: "Queues", icon: ListOrdered },
    );
    if (manager) {
      links.push(
        { href: "/dashboard/customers", label: "Customers", icon: UsersRound },
        { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
      );
    }
  } else if (role !== "student") {
    if (institution) {
      links.push(
        { href: "/dashboard/units", label: "Units", icon: Building2 },
        { href: "/dashboard/services", label: "Services", icon: Building2 },
      );
    }
    if (manager) links.push({ href: "/dashboard/locations", label: "Locations", icon: MapPin });
    links.push({ href: "/dashboard/queues", label: "Queues", icon: ListOrdered });
    if (teaching) {
      links.push(
        { href: "/dashboard/courses", label: "Courses", icon: BookOpen },
        { href: "/dashboard/classes", label: "Classes", icon: CalendarDays },
        { href: "/dashboard/attendance", label: "Attendance", icon: ClipboardCheck },
        { href: "/dashboard/students", label: "Students", icon: UsersRound },
      );
    }
    if (manager || (institution && institutionStaffManagement)) links.push({ href: institution ? "/dashboard/people" : "/dashboard/team", label: "Staff & roles", icon: UsersRound });
    if (manager || teaching) links.push({ href: education ? "/dashboard/exports" : manager ? "/dashboard/analytics" : "/dashboard/exports", label: "Reports", icon: FileText });
  }

  if (owner) {
    links.push(
      { href: "/dashboard/billing", label: "Billing", icon: CreditCard },
      { href: "/dashboard/settings", label: "Settings", icon: Settings2 },
    );
  }

  const matches = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const active = (href: string) => href === "/dashboard" ? pathname === href : matches(href);
  if (role === "student") return null;
  if (variant === "desktop") return <nav aria-label="Workspace navigation" className={styles.desktopNav}>
    {links.map((link) => <Link href={link.href} key={link.href} aria-current={active(link.href) ? "page" : undefined}><link.icon size={18} />{link.label}</Link>)}
  </nav>;

  if (teaching) {
    const educationLinks: NavigationLink[] = [
      { href: "/dashboard", label: "Home", icon: LayoutDashboard },
      { href: "/dashboard/classes", label: "Classes", icon: CalendarDays },
      { href: "/dashboard/attendance", label: "Attendance", icon: ClipboardCheck },
      { href: "/dashboard/students", label: "Students", icon: UsersRound },
      { href: "/dashboard/more", label: "More", icon: MoreHorizontal },
    ];
    return <nav aria-label="Mobile workspace navigation" className={styles.mobileNav}>
      {educationLinks.map((link) => {
        const selected = link.label === "Classes" ? matches("/dashboard/classes") || matches("/dashboard/courses")
          : link.label === "More" ? pathname !== "/dashboard" && !["/dashboard/classes", "/dashboard/courses", "/dashboard/attendance", "/dashboard/students"].some(matches)
          : active(link.href);
        return <Link href={link.href} key={link.href} aria-current={selected ? "page" : undefined}><link.icon size={19} aria-hidden="true" />{link.label}</Link>;
      })}
    </nav>;
  }

  const preferred = individualService
    ? ["Home", "Services", "Queues", "Customers", "Analytics"]
    : ["Home", "Queues", "Services", "Customers"];
  const primary = preferred.map((label) => links.find((link) => link.label === label)).filter((link): link is NavigationLink => Boolean(link));
  const secondary = links.filter((link) => !primary.includes(link));
  return <nav aria-label="Mobile workspace navigation" className={styles.mobileNav}>
    {primary.map((link) => <Link href={link.href} key={link.href} aria-current={active(link.href) ? "page" : undefined}><link.icon size={19} />{link.label === "Home" && individualService ? "Overview" : link.label}</Link>)}
    {!individualService && secondary.length > 0 && <details className={styles.more} onKeyDown={(event) => { if (event.key === "Escape") { event.currentTarget.open = false; event.currentTarget.querySelector("summary")?.focus(); } }}><summary className={styles.moreSummary} aria-current={secondary.some(link => active(link.href)) ? "page" : undefined}><MoreHorizontal size={20} aria-hidden="true" />More</summary><div className={styles.moreMenu}>{secondary.map((link) => <Link href={link.href} key={link.href} onClick={event => { const menu = event.currentTarget.closest("details"); if (menu) menu.open = false; }} aria-current={active(link.href) ? "page" : undefined}><link.icon size={17} aria-hidden="true" />{link.label}</Link>)}</div></details>}
  </nav>;
}
