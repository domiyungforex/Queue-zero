"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function DashboardNavigation({ role }: { role: "owner" | "admin" | "staff" }) {
  const pathname = usePathname();
  const links = [
    { href: "/dashboard", label: "Overview", visible: true },
    { href: "/dashboard/queues", label: "Queues", visible: true },
    { href: "/dashboard/locations", label: "Locations", visible: role !== "staff" },
    { href: "/dashboard/analytics", label: "Analytics", visible: role !== "staff" },
    { href: "/dashboard/billing", label: "Billing", visible: role === "owner" },
    { href: "/dashboard/settings", label: "Settings", visible: role === "owner" },
  ];
  return <nav aria-label="Business navigation" className="flex flex-wrap gap-1 lg:flex-col">
    {links.filter((link) => link.visible).map((link) => {
      const active = link.href === "/dashboard" ? pathname === link.href : pathname.startsWith(link.href);
      return <Link key={link.href} href={link.href} aria-current={active ? "page" : undefined}
        className={`flex min-h-12 items-center rounded-xl px-4 text-sm font-semibold ${active ? "bg-primary text-white" : "text-muted hover:bg-black/5"}`}>{link.label}</Link>;
    })}
  </nav>;
}
