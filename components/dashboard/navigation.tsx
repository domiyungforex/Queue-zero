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
  UsersRound,
} from "lucide-react";
import type { Database } from "@/lib/db/database.types";

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
}: DashboardNavigationProps) {
  const pathname = usePathname();
  const manager = role === "owner" || role === "admin";
  const owner = role === "owner";
  const individualLecturer = workspaceOwnership === "INDIVIDUAL" && professionalCategory === "LECTURER_TEACHER";
  const individualService = workspaceOwnership === "INDIVIDUAL" && Boolean(professionalCategory) && !individualLecturer;
  const education = mode !== "BUSINESS" || organizationType === "UNIVERSITY_SCHOOL";
  const teaching = education && (manager || role === "lecturer" || institutionTeaching);
  const links: NavigationLink[] = [];

  if (role !== "student") links.push({ href: "/dashboard", label: "Overview", icon: LayoutDashboard });

  if (individualLecturer) {
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
    if (manager || teaching) links.push({ href: manager ? "/dashboard/analytics" : "/dashboard/exports", label: "Reports", icon: FileText });
  }

  if (owner) {
    links.push(
      { href: "/dashboard/billing", label: "Billing", icon: CreditCard },
      { href: "/dashboard/settings", label: "Settings", icon: Settings2 },
    );
  }

  return <nav aria-label="Workspace navigation" className="workspace-nav">
    {links.map((link) => <Link href={link.href} key={link.href} aria-current={(link.href === "/dashboard" ? pathname === link.href : pathname.startsWith(link.href)) ? "page" : undefined}>
      <link.icon size={19} />{link.label}
    </Link>)}
  </nav>;
}
