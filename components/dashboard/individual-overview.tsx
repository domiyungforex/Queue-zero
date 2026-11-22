import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Clock3,
  ListOrdered,
  Plus,
  QrCode,
  User,
  Users,
} from "lucide-react";
import { PageHeading } from "@/components/ui/workspace";
import { getDashboardQueues } from "@/lib/dashboard/data";

type Props = {
  userName?: string | null;
  businessName: string;
};

export async function IndividualWorkspaceOverview({ userName, businessName }: Props) {
  const queues = await getDashboardQueues().catch(() => []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "28px", width: "100%" }}>
      <PageHeading
        eyebrow="INDIVIDUAL WORKSPACE"
        title={`Hello, ${userName || "there"}`}
        description="Your personal activity, scheduled visits, and personal queues."
        action={
          <Link className="button-primary" href="/dashboard/queues/new">
            <Plus size={16} /> New Personal Queue
          </Link>
        }
      />

      <div className="metrics-grid">
        <div className="stat-card">
          <div><ListOrdered size={18} /></div>
          <strong>{queues.length}</strong>
          <p>My Queues</p>
        </div>
        <div className="stat-card">
          <div><CalendarClock size={18} /></div>
          <strong>0</strong>
          <p>Upcoming Bookings</p>
        </div>
        <div className="stat-card">
          <div><CheckCircle2 size={18} /></div>
          <strong>0</strong>
          <p>Completed Visits</p>
        </div>
      </div>

      <section>
        <div className="section-toolbar">
          <h2>My Active Queues</h2>
          <Link href="/dashboard/queues">View all <ArrowRight size={14} /></Link>
        </div>

        {queues.length ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(280px, 100%), 1fr))", gap: "16px", marginTop: "12px" }}>
            {queues.map((q) => (
              <div
                key={q.id}
                style={{
                  background: "#ffffff",
                  border: "1px solid #ffd2bf",
                  borderRadius: "16px",
                  padding: "20px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700 }}>{q.name}</h3>
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: "6px",
                      background: q.status === "open" ? "#e6f8ee" : "#f3f4f6",
                      color: q.status === "open" ? "#176b49" : "#6b7280",
                    }}
                  >
                    {q.status.toUpperCase()}
                  </span>
                </div>
                <p style={{ margin: "10px 0 16px", fontSize: "13px", color: "#70665e" }}>
                  {q.locations?.name || "Main location"} · {q.description || "Active queue"}
                </p>
                <Link className="button-secondary" href={`/dashboard/queues/${q.id}`} style={{ width: "100%", textAlign: "center" }}>
                  Manage Queue
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state" style={{ marginTop: "12px" }}>
            <ListOrdered size={32} />
            <h3>No personal queues yet</h3>
            <p>Create a queue for private appointments, consultations, or personal services.</p>
          </div>
        )}
      </section>
    </div>
  );
}
