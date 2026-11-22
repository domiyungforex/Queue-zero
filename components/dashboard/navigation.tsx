"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  Building2,
  CalendarClock,
  CalendarDays,
  ClipboardCheck,
  CreditCard,
  FileText,
  Layers,
  LayoutDashboard,
  ListOrdered,
  MapPin,
  MoreHorizontal,
  Settings2,
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
  const isIndividual = workspaceOwnership === "INDIVIDUAL";
  const individualLecturer = isIndividual && professionalCategory === "LECTURER_TEACHER";
  const individualService = isIndividual && Boolean(professionalCategory) && !individualLecturer;
  const isOrganizationCms = !isIndividual && manager;
  const isOperationalLecturer = !isIndividual && role === "lecturer";

  const links: NavigationLink[] = [];

  // Home / Overview Link
  if (role !== "student") {
    links.push({
      href: "/dashboard",
      label: isOrganizationCms ? "Overview" : isOperationalLecturer ? "My Teaching" : variant === "mobile" ? "Home" : "Dashboard",
      icon: LayoutDashboard,
    });
  }

  // 1. Individual Personal Workspace
  if (isIndividual) {
    if (individualLecturer) {
      links.push(
        { href: "/dashboard/courses", label: "Courses", icon: BookOpen },
        { href: "/dashboard/classes", label: "Classes", icon: CalendarDays },
        { href: "/dashboard/attendance", label: "Attendance", icon: ClipboardCheck },
        { href: "/dashboard/students", label: "Students", icon: UsersRound },
        { href: "/dashboard/exports", label: "Reports", icon: FileText }
      );
    } else {
      links.push(
        { href: "/dashboard/queues", label: "My Queues", icon: ListOrdered },
        { href: "/dashboard/bookings", label: "My Bookings", icon: CalendarClock }
      );
      if (individualService) {
        links.push({ href: "/dashboard/services", label: "Services", icon: Building2 });
      }
    }
  }
  // 2. Organization Management CMS (Owner & Admins)
  else if (isOrganizationCms) {
    links.push(
      { href: "/dashboard/structure", label: "Structure", icon: Layers },
      { href: "/dashboard/courses", label: "Courses & Services", icon: BookOpen },
      { href: "/dashboard/people", label: "People & Roles", icon: UsersRound },
      { href: "/dashboard/attendance", label: "Attendance Oversight", icon: ClipboardCheck },
      { href: "/dashboard/queues", label: "Queues", icon: ListOrdered },
      { href: "/dashboard/bookings", label: "Bookings", icon: CalendarClock },
      { href: "/dashboard/exports", label: "Reports", icon: FileText }
    );
  }
  // 3. Operational Lecturer / Instructor Workspace
  else if (isOperationalLecturer) {
    links.push(
      { href: "/dashboard/courses", label: "My Courses", icon: BookOpen },
      { href: "/dashboard/classes", label: "Classes & Sessions", icon: CalendarDays },
      { href: "/dashboard/attendance", label: "Live Attendance", icon: ClipboardCheck },
      { href: "/dashboard/students", label: "Students Roster", icon: UsersRound },
      { href: "/dashboard/exports", label: "Course Reports", icon: FileText }
    );
  }
  // 4. Operational Staff Workspace
  else if (role === "staff") {
    links.push(
      { href: "/dashboard/queues", label: "Assigned Queues", icon: ListOrdered },
      { href: "/dashboard/bookings", label: "Bookings", icon: CalendarClock }
    );
    if (institutionTeaching) {
      links.push(
        { href: "/dashboard/courses", label: "Courses", icon: BookOpen },
        { href: "/dashboard/attendance", label: "Attendance", icon: ClipboardCheck }
      );
    }
  }

  // Owner Admin Controls
  if (owner) {
    links.push(
      { href: "/dashboard/billing", label: "Billing", icon: CreditCard },
      { href: "/dashboard/settings", label: "Settings", icon: Settings2 }
    );
  } else if (isIndividual || isOrganizationCms) {
    links.push({ href: "/dashboard/settings", label: "Settings", icon: Settings2 });
  }

  const moreRoutes = [
    "/dashboard/more",
    "/dashboard/team",
    "/dashboard/settings",
    "/dashboard/exports",
    "/dashboard/billing",
    "/dashboard/people",
  ];
  const active = (href: string) =>
    href === "/dashboard"
      ? pathname === href
      : href === "/dashboard/more"
        ? moreRoutes.some((route) => pathname.startsWith(route))
        : pathname.startsWith(href);

  // Desktop Navigation
  if (variant === "desktop") {
    return (
      <nav aria-label="Workspace navigation" className={styles.desktopNav}>
        {links.map((link) => (
          <Link
            href={link.href}
            key={link.href}
            aria-current={active(link.href) ? "page" : undefined}
            data-label={link.label}
          >
            <link.icon size={18} />
            {link.label}
          </Link>
        ))}
      </nav>
    );
  }

  // Mobile Navigation: Prioritize primary 4 links + "More"
  let primaryMobileLinks: NavigationLink[] = [];
  if (isOrganizationCms) {
    primaryMobileLinks = [
      { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
      { href: "/dashboard/structure", label: "Structure", icon: Layers },
      { href: "/dashboard/courses", label: "Courses", icon: BookOpen },
      { href: "/dashboard/attendance", label: "Oversight", icon: ClipboardCheck },
      { href: "/dashboard/more", label: "More", icon: MoreHorizontal },
    ];
  } else if (isOperationalLecturer || individualLecturer) {
    primaryMobileLinks = [
      { href: "/dashboard", label: "Home", icon: LayoutDashboard },
      { href: "/dashboard/classes", label: "Classes", icon: CalendarDays },
      { href: "/dashboard/attendance", label: "Attendance", icon: ClipboardCheck },
      { href: "/dashboard/students", label: "Students", icon: UsersRound },
      { href: "/dashboard/more", label: "More", icon: MoreHorizontal },
    ];
  } else {
    primaryMobileLinks = [
      { href: "/dashboard", label: "Home", icon: LayoutDashboard },
      { href: "/dashboard/queues", label: "Queues", icon: ListOrdered },
      { href: "/dashboard/bookings", label: "Bookings", icon: CalendarClock },
      { href: "/dashboard/more", label: "More", icon: MoreHorizontal },
    ];
  }

  return (
    <nav aria-label="Mobile workspace navigation" className={styles.mobileNav}>
      {primaryMobileLinks.map((link) => (
        <Link href={link.href} key={link.href} aria-current={active(link.href) ? "page" : undefined}>
          <link.icon size={19} />
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
