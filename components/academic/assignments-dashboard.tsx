"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { CustomDropdown } from "@/components/ui/custom-dropdown";
import type { AssignmentSummary } from "@/lib/academic/data";

export function AssignmentsDashboard({
  assignments,
  courses,
}: {
  assignments: AssignmentSummary[];
  courses: Array<{ id: string; code: string; title: string }>;
}) {
  const [query, setQuery] = useState("");
  const [courseFilter, setCourseFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return assignments.filter((a) => {
      if (courseFilter !== "all" && a.course_id !== courseFilter) return false;
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      if (!q) return true;
      return (
        a.title.toLowerCase().includes(q) ||
        (a.course_code?.toLowerCase().includes(q) ?? false) ||
        a.category.toLowerCase().includes(q)
      );
    });
  }, [assignments, query, courseFilter, statusFilter]);

  return (
    <div className="space-y-6">
      <div className="panel p-5">
        <div className="grid gap-3 md:grid-cols-[1fr_220px_180px]">
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
              { value: "all", label: "All statuses" },
              { value: "DRAFT", label: "Draft" },
              { value: "PUBLISHED", label: "Published" },
              { value: "CLOSED", label: "Closed" },
            ]}
          />
        </div>
      </div>

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
                  <span className="rounded-full bg-[#fff0e8] px-3 py-1 text-xs font-bold text-[#d94b14]">
                    {a.course_code} · {a.category.replaceAll("_", " ")}
                  </span>
                  <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-700">
                    {a.status}
                  </span>
                </div>
                <h2 className="mt-3 text-lg font-bold text-[#111318]">{a.title}</h2>
                <p className="mt-1 text-xs text-neutral-500">
                  Total Marks: {a.total_marks} · Mode: {a.marking_mode.replaceAll("_", " ")}
                  {a.due_at ? ` · Due ${new Date(a.due_at).toLocaleDateString()}` : ""}
                </p>
              </div>
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-black/5 pt-4 text-sm">
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
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
