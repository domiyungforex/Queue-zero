"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  Archive,
  ArrowRight,
  CalendarClock,
  Check,
  FileText,
  Plus,
  RotateCcw,
  Search,
  X,
} from "lucide-react";
import { CustomDropdown } from "@/components/ui/custom-dropdown";
import {
  archiveAssignmentAction,
  deleteAssignmentAction,
  getAssignmentShareLinkAction,
  restoreAssignmentAction,
} from "@/lib/academic/actions";
import type { AssignmentSummary } from "@/lib/academic/data";

function statusTone(status: string) {
  if (status === "PUBLISHED") return "bg-emerald-50 text-emerald-800 border-emerald-200";
  if (status === "DRAFT") return "bg-amber-50 text-amber-800 border-amber-200";
  if (status === "ARCHIVED") return "bg-neutral-100 text-neutral-600 border-neutral-200";
  return "bg-blue-50 text-blue-800 border-blue-200";
}

export function AssignmentsDashboard({
  assignments,
  courses,
}: {
  assignments: AssignmentSummary[];
  courses: Array<{ id: string; code: string; title: string }>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [items, setItems] = useState<AssignmentSummary[]>(assignments);
  const [query, setQuery] = useState("");
  const [courseFilter, setCourseFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("active");
  const [busyAction, setBusyAction] = useState<{ id: string; action: "share" | "archive" | "delete" | "edit" } | null>(
    null,
  );
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sharedLink, setSharedLink] = useState<{ id: string; title: string; url: string; status: string } | null>(null);
  const [feedback, setFeedback] = useState<{ tone: "success" | "warning"; text: string } | null>(null);

  // Sync when server props update
  const [prevPropAssignments, setPrevPropAssignments] = useState(assignments);
  if (assignments !== prevPropAssignments) {
    setPrevPropAssignments(assignments);
    setItems(assignments);
  }

  const counts = useMemo(() => {
    return {
      active: items.filter((a) => a.status !== "ARCHIVED").length,
      PUBLISHED: items.filter((a) => a.status === "PUBLISHED").length,
      DRAFT: items.filter((a) => a.status === "DRAFT").length,
      CLOSED: items.filter((a) => a.status === "CLOSED").length,
      ARCHIVED: items.filter((a) => a.status === "ARCHIVED").length,
      all: items.length,
    };
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((a) => {
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
  }, [items, query, courseFilter, statusFilter]);

  async function handleShare(a: AssignmentSummary) {
    if (busyAction) return;
    setBusyAction({ id: a.id, action: "share" });
    setFeedback(null);
    try {
      const res = await getAssignmentShareLinkAction(a.id);
      if (!res.ok) {
        setFeedback({ tone: "warning", text: res.error });
        return;
      }
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const shareUrl = `${origin}${res.guestPath}`;
      setSharedLink({ id: a.id, title: a.title, url: shareUrl, status: res.status });

      let copied = false;
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        try {
          await navigator.clipboard.writeText(shareUrl);
          copied = true;
        } catch {
          copied = false;
        }
      }

      if (copied) {
        setCopiedId(a.id);
        setTimeout(() => setCopiedId((prev) => (prev === a.id ? null : prev)), 2500);
      }
      setFeedback({
        tone: "success",
        text:
          res.status === "DRAFT"
            ? `${copied ? "Link copied! " : ""}Publish "${a.title}" before students submit.`
            : `${copied ? "Student submission link copied to clipboard." : "Share link ready below."}`,
      });
    } catch {
      setFeedback({ tone: "warning", text: "Could not generate share link. Please try again." });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleArchiveToggle(a: AssignmentSummary) {
    if (busyAction) return;
    setBusyAction({ id: a.id, action: "archive" });
    setFeedback(null);
    const isArchived = a.status === "ARCHIVED";
    try {
      const res = isArchived
        ? await restoreAssignmentAction(a.id)
        : await archiveAssignmentAction(a.id);
      if (!res.ok) {
        setFeedback({ tone: "warning", text: res.error });
        return;
      }
      // Optimistically update local list immediately so UI responds on first click
      setItems((prev) =>
        prev.map((item) =>
          item.id === a.id
            ? { ...item, status: isArchived ? "PUBLISHED" : "ARCHIVED" }
            : item,
        ),
      );
      setFeedback({
        tone: "success",
        text: isArchived ? `"${a.title}" restored.` : `"${a.title}" moved to Archive.`,
      });
      startTransition(() => {
        router.refresh();
      });
    } catch {
      setFeedback({ tone: "warning", text: "Could not update archive status. Please try again." });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleDelete(a: AssignmentSummary) {
    if (busyAction) return;
    setBusyAction({ id: a.id, action: "delete" });
    setFeedback(null);
    try {
      const res = await deleteAssignmentAction({ assignmentId: a.id, confirmed: true });
      setConfirmDeleteId(null);
      if (!res.ok) {
        setFeedback({ tone: "warning", text: res.error });
        return;
      }
      // Optimistically remove deleted assignment immediately
      setItems((prev) => prev.filter((item) => item.id !== a.id));
      setFeedback({ tone: "success", text: res.message });
      startTransition(() => {
        router.refresh();
      });
    } catch {
      setFeedback({ tone: "warning", text: "Could not delete assignment. Please try again." });
    } finally {
      setBusyAction(null);
    }
  }

  function handleEdit(assignmentId: string) {
    setBusyAction({ id: assignmentId, action: "edit" });
    startTransition(() => {
      router.push(`/dashboard/academic/assignments/${assignmentId}/edit`);
    });
  }

  const tabs = [
    { value: "active", label: "Active", count: counts.active },
    { value: "PUBLISHED", label: "Published", count: counts.PUBLISHED },
    { value: "DRAFT", label: "Drafts", count: counts.DRAFT },
    { value: "ARCHIVED", label: "Archived", count: counts.ARCHIVED },
    { value: "all", label: "All", count: counts.all },
  ];

  return (
    <div className="space-y-6">
      <div className="panel p-5 space-y-4">
        <div className="flex flex-wrap items-center gap-2 border-b border-black/5 pb-4" role="tablist" aria-label="Assignment status tabs">
          {tabs.map((tab) => {
            const active = statusFilter === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setStatusFilter(tab.value)}
                className={`inline-flex min-h-9 items-center gap-2 rounded-full px-3.5 text-xs font-bold transition ${
                  active
                    ? "bg-[#111318] text-white"
                    : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                    active ? "bg-white/20 text-white" : "bg-white text-neutral-600"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="grid gap-3 md:grid-cols-[1fr_240px]">
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
              placeholder="Search by title, course code, course name, or category…"
              className="min-h-11 w-full rounded-xl border border-black/15 bg-white pl-10 pr-4 text-sm text-[#111318] outline-none focus:border-[#ff6b2b]"
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
        </div>
      </div>

      {feedback ? (
        <p className={`notice ${feedback.tone === "warning" ? "warning" : ""}`} role="status">
          {feedback.text}
        </p>
      ) : null}

      {sharedLink ? (
        <div className="panel border-[#ffd9ca] bg-[#fffaf7] p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-wider text-[#d94b14]">
              Shareable Student Link · {sharedLink.title}
            </p>
            <input
              readOnly
              value={sharedLink.url}
              onFocus={(e) => e.currentTarget.select()}
              className="mt-1.5 w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-xs font-mono text-[#111318]"
            />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <a
              href={sharedLink.url}
              target="_blank"
              rel="noreferrer"
              className="button-secondary min-h-9 px-3 text-xs"
            >
              Open Link
            </a>
            <button
              type="button"
              onClick={() => setSharedLink(null)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-black/10 bg-white text-neutral-600 hover:bg-neutral-50"
              aria-label="Close share link bar"
            >
              <X size={15} aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <div className="panel p-12 text-center">
          <p className="text-base font-bold text-[#111318]">No assignments match your filters</p>
          <p className="mt-1 text-sm text-neutral-600">
            Create a new assignment or switch status tabs above.
          </p>
          <Link href="/dashboard/academic/assignments/new" className="button-primary mt-5 inline-flex">
            <Plus size={16} aria-hidden="true" />
            Create Assignment
          </Link>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {filtered.map((a) => {
            const isRowBusy = busyAction?.id === a.id;
            return (
              <article
                key={a.id}
                className="panel flex flex-col justify-between p-5 transition hover:border-black/20"
              >
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
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${statusTone(a.status)}`}
                      >
                        {a.status}
                      </span>
                    </div>
                  </div>

                  <h2 className="mt-3 text-lg font-bold text-[#111318] leading-snug">{a.title}</h2>
                  {a.course_title ? (
                    <p className="mt-0.5 text-xs font-medium text-neutral-600">{a.course_title}</p>
                  ) : null}

                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-500">
                    <span className="font-semibold text-neutral-700">{a.total_marks} marks</span>
                    <span>{a.marking_mode.replaceAll("_", " ")}</span>
                    {a.due_at ? (
                      <span className="inline-flex items-center gap-1">
                        <CalendarClock size={12} aria-hidden="true" />
                        Due {new Date(a.due_at).toLocaleDateString()}
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="mt-5 space-y-3 border-t border-black/10 pt-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex flex-wrap gap-3 font-semibold text-neutral-600">
                      <span>{a.submission_count ?? 0} submitted</span>
                      <span>{a.awaiting_marking_count ?? 0} awaiting marking</span>
                      {(a.late_count ?? 0) > 0 ? <span className="text-amber-700">{a.late_count} late</span> : null}
                    </div>
                    <Link
                      href={`/dashboard/academic/assignments/${a.id}`}
                      className="inline-flex items-center gap-1 font-bold text-[#ff6b2b] hover:underline"
                    >
                      Review &amp; Grade
                      <ArrowRight size={13} aria-hidden="true" />
                    </Link>
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
                    <button
                      type="button"
                      disabled={isRowBusy || (isPending && busyAction?.id === a.id)}
                      onClick={() => handleEdit(a.id)}
                      className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-black/10 bg-white px-3 text-xs font-semibold text-[#111318] hover:bg-neutral-50 disabled:opacity-60"
                    >
                      <FileText size={13} aria-hidden="true" />
                      {busyAction?.id === a.id && busyAction.action === "edit" ? "Opening…" : "Edit"}
                    </button>

                    <button
                      type="button"
                      disabled={isRowBusy}
                      onClick={() => void handleShare(a)}
                      className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-black/10 bg-white px-3 text-xs font-semibold text-[#111318] hover:bg-neutral-50 disabled:opacity-60"
                    >
                      {copiedId === a.id ? <Check size={13} aria-hidden="true" /> : <ArrowRight size={13} aria-hidden="true" />}
                      {busyAction?.id === a.id && busyAction.action === "share"
                        ? "Preparing…"
                        : copiedId === a.id
                          ? "Link copied"
                          : "Share link"}
                    </button>

                    <button
                      type="button"
                      disabled={isRowBusy}
                      onClick={() => void handleArchiveToggle(a)}
                      className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-black/10 bg-white px-3 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
                    >
                      {a.status === "ARCHIVED" ? (
                        <>
                          <RotateCcw size={13} aria-hidden="true" />
                          {busyAction?.id === a.id && busyAction.action === "archive" ? "Restoring…" : "Restore"}
                        </>
                      ) : (
                        <>
                          <Archive size={13} aria-hidden="true" />
                          {busyAction?.id === a.id && busyAction.action === "archive" ? "Archiving…" : "Archive"}
                        </>
                      )}
                    </button>

                    {confirmDeleteId === a.id ? (
                      <div className="col-span-2 flex items-center gap-1.5 sm:col-span-1">
                        <button
                          type="button"
                          disabled={isRowBusy}
                          onClick={() => void handleDelete(a)}
                          className="inline-flex min-h-9 flex-1 items-center justify-center gap-1 rounded-lg bg-red-600 px-3 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-60"
                        >
                          {busyAction?.id === a.id && busyAction.action === "delete" ? "Deleting…" : "Confirm delete"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="inline-flex min-h-9 items-center justify-center rounded-lg border border-black/10 bg-white px-2.5 text-xs font-semibold text-neutral-600 hover:bg-neutral-50"
                          aria-label="Cancel delete"
                        >
                          <X size={13} aria-hidden="true" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={isRowBusy}
                        onClick={() => setConfirmDeleteId(a.id)}
                        className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                      >
                        <X size={13} aria-hidden="true" />
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
