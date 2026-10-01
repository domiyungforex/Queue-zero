import { requireBusinessMembership } from "@/lib/business/membership";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await requireBusinessMembership();
  return children;
}
