"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Archive, ArrowRight, Check, FileText, Plus, RotateCcw, Search, X } from "lucide-react";
import { CustomDropdown } from "@/components/ui/custom-dropdown";
import {
  archiveAssignmentAction,
  deleteAssignmentAction,
  getAssignmentShareLinkAction,
  restoreAssignmentAction,
} from "@/lib/academic/actions";
import type { AssignmentSummary } from "@/lib/academic/data";

export function AssignmentsDashboard({
  assignments,
  courses,
}: {
  assignments: AssignmentSummary[];
  courses: Array<{ id: string; code: string; title: string }>;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [courseFilter, setCourseFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("active");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ tone: "success" | "warning"; text: string } | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return assignments.filter((a) => {
      if (courseFilter !== "all" && a.course_id !== courseFilter) return false;
      if (statusFilter === "active" && a.status === "ARCHIVED") return false;
      if (statusFilter !== "all" && statusFilter !== "active" && a.status !== statusFilter) return false;
      if (!q) return true;
      return (
        a.title.toLowerCase().includes(q) ||
        (a.course_code?.toLowerCase().includes(q) ?? false) ||
        (a.course_title?.toLowerCase().includes(q) ?? false) ||
        a.category.toLowerCase().includes(q)
      );
    });
  }, [assignments, query, courseFilter, statusFilter]);

  async function handleShare(assignmentId: string) {
    setBusyId(assignmentId);
    setFeedback(null);
    try {
      const res = await getAssignmentShareLinkAction(assignmentId);
      if (!res.ok) {
        setFeedback({ tone: "warning", text: res.error });
        return;
      }
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const shareUrl = `${origin}${res.guestPath}`;
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
      }
      setCopiedId(assignmentId);
      setFeedback({
        tone: "success",
        text:
          res.status === "DRAFT"
            ? "Assignment link copied (publish the assignment before students can submit)."
            : "Student submission link copied to clipboard.",
      });
      setTimeout(() => setCopiedId((prev) => (prev === assignmentId ? null : prev)), 2500);
    } finally {
      setBusyId(null);
    }
  }

  async function handleArchiveToggle(a: AssignmentSummary) {
    setBusyId(a.id);
    setFeedback(null);
    try {
      const res =
        a.status === "ARCHIVED"
          ? await restoreAssignmentAction(a.id)
          : await archiveAssignmentAction(a.id);
      if (!res.ok) {
        setFeedback({ tone: "warning", text: res.error });
        return;
      }
      setFeedback({
        tone: "success",
        text: a.status === "ARCHIVED" ? `"${a.title}" restored.` : `"${a.title}" archived.`,
      });
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(a: AssignmentSummary) {
    setBusyId(a.id);
    setFeedback(null);
    try {
      const res = await deleteAssignmentAction({ assignmentId: a.id, confirmed: true });
      setConfirmDeleteId(null);
      if (!res.ok) {
        setFeedback({ tone: "warning", text: res.error });
        return;
      }
      setFeedback({ tone: "success", text: res.message });
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="panel p-5">
        <div className="grid gap-3 md:grid-cols-[1fr_220px_190px]">
          <label className="relative block">
            <span className="sr-only">Search assignments</span>
            <Search
              size={16}
              aria-hidden="true"
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search title, course code, or category…"
              className="min-h-12 w-full rounded-xl border border-black/15 bg-white pl-10 pr-4 text-base text-[#111318] outline-none focus:border-[#ff6b2b]"
            />
          </label>
          <CustomDropdown
            name="courseFilter"
            value={courseFilter}
            onChange={setCourseFilter}
            options={[
              { value: "all", label: "All courses" },
              ...courses.map((c) => ({ value: c.id, label: `${c.code} — ${c.title}` })),
            ]}
          />
          <CustomDropdown
            name="statusFilter"
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: "active", label: "Active (Draft & Live)" },
              { value: "all", label: "All including archived" },
              { value: "DRAFT", label: "Draft" },
              { value: "PUBLISHED", label: "Published" },
              { value: "CLOSED", label: "Closed" },
              { value: "ARCHIVED", label: "Archived" },
            ]}
          />
        </div>
      </div>

      {feedback ? (
        <p className={`notice ${feedback.tone === "warning" ? "warning" : ""}`} role="status">
          {feedback.text}
        </p>
      ) : null}

      {filtered.length === 0 ? (
        <div className="panel p-10 text-center">
          <p className="text-base font-bold text-[#111318]">No assignments match your filters</p>
          <p className="mt-1 text-sm text-neutral-600">Create a new assignment or adjust your filters.</p>
          <Link href="/dashboard/academic/assignments/new" className="button-primary mt-5 inline-flex">
            <Plus size={16} aria-hidden="true" />
            Create Assignment
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((a) => (
            <article key={a.id} className="panel flex flex-col justify-between p-5">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full bg-[#fff0e8] px-3 py-1 text-xs font-bold text-[#d94b14]">
                      {a.course_code} · {a.category.replaceAll("_", " ")}
                    </span>
                    {a.course_classification_status === "MANUAL_UNVERIFIED" ? (
                      <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
                        Manual course
                      </span>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {a.edited_at ? (
                      <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
                        Edited
                      </span>
                    ) : null}
                    <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-700">
                      {a.status}
                    </span>
                  </div>
                </div>
                <h2 className="mt-3 text-lg font-bold text-[#111318]">{a.title}</h2>
                <p className="mt-1 text-xs text-neutral-500">
                  {a.course_title ? `${a.course_title} · ` : ""}
                  Total Marks: {a.total_marks} · Mode: {a.marking_mode.replaceAll("_", " ")}
                  {a.due_at ? ` · Due ${new Date(a.due_at).toLocaleDateString()}` : ""}
                </p>
              </div>
              <div className="mt-5 space-y-3 border-t border-black/5 pt-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex gap-4 text-xs font-semibold text-neutral-600">
                    <span>{a.submission_count ?? 0} submitted</span>
                    <span>{a.awaiting_marking_count ?? 0} awaiting marking</span>
                    {(a.late_count ?? 0) > 0 ? <span className="text-amber-700">{a.late_count} late</span> : null}
                  </div>
                  <Link
                    href={`/dashboard/academic/assignments/${a.id}`}
                    className="font-bold text-[#ff6b2b] hover:underline"
                  >
                    Review &amp; Grade →
                  </Link>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/dashboard/academic/assignments/${a.id}/edit`}
                    className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-black/10 px-2.5 text-xs font-semibold text-[#111318] hover:bg-neutral-50"
                  >
                    <FileText size={13} aria-hidden="true" />
                    Edit
                  </Link>
                  <button
                    type="button"
                    disabled={busyId === a.id}
                    onClick={() => void handleShare(a.id)}
                    className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-black/10 px-2.5 text-xs font-semibold text-[#111318] hover:bg-neutral-50"
                  >
                    {copiedId === a.id ? <Check size={13} aria-hidden="true" /> : <ArrowRight size={13} aria-hidden="true" />}
                    {copiedId === a.id ? "Link copied" : "Share link"}
                  </button>
                  <button
                    type="button"
                    disabled={busyId === a.id}
                    onClick={() => void handleArchiveToggle(a)}
                    className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-black/10 px-2.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
                  >
                    {a.status === "ARCHIVED" ? (
                      <>
                        <RotateCcw size={13} aria-hidden="true" />
                        Restore
                      </>
                    ) : (
                      <>
                        <Archive size={13} aria-hidden="true" />
                        Archive
                      </>
                    )}
                  </button>
                  {confirmDeleteId === a.id ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={busyId === a.id}
                        onClick={() => void handleDelete(a)}
                        className="inline-flex min-h-8 items-center gap-1 rounded-lg bg-red-600 px-2.5 text-xs font-bold text-white hover:bg-red-700"
                      >
                        Confirm delete
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-black/10 px-2 text-xs font-semibold text-neutral-600"
                      >
                        <X size={13} aria-hidden="true" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={busyId === a.id}
                      onClick={() => setConfirmDeleteId(a.id)}
                      className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-red-200 px-2.5 text-xs font-semibold text-red-700 hover:bg-red-50"
                    >
                      <X size={13} aria-hidden="true" />
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
