"use client";

import { useState } from "react";
import { Check, RotateCcw, ShieldAlert } from "lucide-react";
import {
  gradeSubmissionAction,
  publishAssignmentAction,
  runSimilarityAnalysisAction,
} from "@/lib/academic/actions";
import { EmptyState, StatusPill } from "@/components/ui/workspace";
import type { QuestionAnswer } from "@/lib/academic/submission-review";

export interface SubmissionRow {
  id: string;
  studentName: string;
  matricNumber: string;
  submissionReference: string;
  status: string;
  isLate: boolean;
  submittedAt: string | null;
  textContent: string | null;
  questionAnswers: QuestionAnswer[];
  autoScore: number | null;
  finalScore: number | null;
  lecturerRemarks: string | null;
  gradeReleased: boolean;
}

export function SubmissionReviewer({
  assignmentId,
  assignmentStatus,
  totalMarks,
  submissions,
}: {
  assignmentId: string;
  assignmentStatus: string;
  totalMarks: number;
  submissions: SubmissionRow[];
}) {
  const [selectedId, setSelectedId] = useState<string>(submissions[0]?.id ?? "");
  const [score, setScore] = useState<string>(
    submissions[0]?.finalScore != null
      ? String(submissions[0].finalScore)
      : submissions[0]?.autoScore != null
        ? String(submissions[0].autoScore)
        : "",
  );
  const [remarks, setRemarks] = useState<string>(submissions[0]?.lecturerRemarks ?? "");
  const [releaseNow, setReleaseNow] = useState<boolean>(submissions[0]?.gradeReleased ?? true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const selected = submissions.find((s) => s.id === selectedId) ?? null;

  function selectRow(row: SubmissionRow) {
    setSelectedId(row.id);
    setScore(row.finalScore != null ? String(row.finalScore) : row.autoScore != null ? String(row.autoScore) : "");
    setRemarks(row.lecturerRemarks ?? "");
    setReleaseNow(row.gradeReleased);
    setMessage("");
  }

  async function submitGrade(returnForCorrection = false) {
    if (!selected) return;
    setBusy(true);
    setMessage("");
    const res = await gradeSubmissionAction({
      submissionId: selected.id,
      assignmentId,
      score: Number(score || 0),
      remarks,
      releaseNow: returnForCorrection ? false : releaseNow,
      returnForCorrection,
    });
    setBusy(false);
    setMessage(res.ok ? (returnForCorrection ? "Returned to student." : "Grade saved.") : res.error);
  }

  async function publish() {
    setBusy(true);
    const res = await publishAssignmentAction(assignmentId);
    setBusy(false);
    setMessage(res.ok ? "Assignment published to students." : res.error);
  }

  async function runSimilarity() {
    setBusy(true);
    const res = await runSimilarityAnalysisAction(assignmentId);
    setBusy(false);
    setMessage(res.ok ? `Similarity scan complete: ${res.matchesFound} pair(s) flagged for review.` : res.error);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        {assignmentStatus === "DRAFT" ? (
          <button type="button" disabled={busy} onClick={() => void publish()} className="button-primary">
            <Check size={16} aria-hidden="true" /> Publish Assignment
          </button>
        ) : null}
        <button type="button" disabled={busy} onClick={() => void runSimilarity()} className="button-secondary">
          <ShieldAlert size={16} aria-hidden="true" /> Run Similarity Analysis
        </button>
        {message ? (
          <p role="status" className="text-sm font-semibold text-[#111318]">
            {message}
          </p>
        ) : null}
      </div>

      {submissions.length === 0 ? (
        <EmptyState
          title="No submissions yet"
          description="No student submissions have been received for this assignment yet."
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[340px_1fr] lg:items-start">
          <div className="panel p-4 space-y-2 lg:sticky lg:top-6">
            <h2 className="px-2 text-sm font-bold uppercase tracking-wider text-neutral-500">
              Submissions ({submissions.length})
            </h2>
            <ul className="space-y-1.5">
              {submissions.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => selectRow(row)}
                    className={`w-full rounded-xl border p-3 text-left transition ${
                      row.id === selectedId
                        ? "border-[#ff6b2b] bg-[#fff0e8]"
                        : "border-black/10 bg-white hover:bg-neutral-50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <strong className="text-sm text-[#111318]">{row.studentName}</strong>
                      <StatusPill status={row.status} />
                    </div>
                    <p className="mt-1 text-xs text-neutral-600">
                      {row.matricNumber ? `${row.matricNumber} · ` : ""}Ref: {row.submissionReference}
                      {row.isLate ? " · LATE" : ""}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {selected ? (
            <div className="panel p-6 space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-black/10 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-[#111318]">{selected.studentName}</h2>
                  <p className="text-xs text-neutral-600">
                    {selected.matricNumber ? `${selected.matricNumber} · ` : ""}Submitted{" "}
                    {selected.submittedAt ? new Date(selected.submittedAt).toLocaleString() : "Draft"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill status={selected.status} />
                  <span className="rounded-full bg-[#fff0e8] px-3 py-1 text-xs font-bold text-[#d94b14]">
                    Auto score: {selected.autoScore ?? "—"} / {totalMarks}
                  </span>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Student Answer</h3>
                {selected.questionAnswers.length > 0 ? (
                  <div className="mt-2 space-y-3">
                    {selected.questionAnswers.map((qa, index) => (
                      <div
                        key={`${qa.questionPrompt}-${index}`}
                        className="rounded-xl border border-black/10 bg-[#fffaf7] p-4 text-sm text-[#111318]"
                      >
                        <p className="font-semibold">
                          {qa.questionPrompt}{" "}
                          <span className="text-xs font-bold text-neutral-500">({qa.marks} marks)</span>
                        </p>
                        <p className="mt-1.5 whitespace-pre-wrap">{qa.answer}</p>
                      </div>
                    ))}
                  </div>
                ) : null}
                {selected.textContent ? (
                  <div className="mt-2 whitespace-pre-wrap rounded-xl border border-black/10 bg-[#fffaf7] p-4 text-sm text-[#111318]">
                    {selected.textContent}
                  </div>
                ) : selected.questionAnswers.length === 0 ? (
                  <div className="mt-2 whitespace-pre-wrap rounded-xl border border-black/10 bg-[#fffaf7] p-4 text-sm text-[#111318]">
                    No written text answer provided.
                  </div>
                ) : null}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-bold text-[#111318]">
                  Awarded Marks (out of {totalMarks})
                  <input
                    type="number"
                    min={0}
                    max={totalMarks}
                    step="0.5"
                    value={score}
                    onChange={(e) => setScore(e.target.value)}
                    className="mt-1.5 min-h-12 w-full rounded-xl border border-black/15 px-3.5 text-base"
                  />
                </label>
                <div className="flex items-center pt-6">
                  <label className="flex items-center gap-2 text-sm font-semibold">
                    <input
                      type="checkbox"
                      checked={releaseNow}
                      onChange={(e) => setReleaseNow(e.target.checked)}
                    />
                    Release grade &amp; feedback to student
                  </label>
                </div>
              </div>

              <label className="block text-sm font-bold text-[#111318]">
                Lecturer Feedback / Remarks
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  rows={3}
                  placeholder="Provide constructive feedback…"
                  className="mt-1.5 w-full rounded-xl border border-black/15 p-3.5 text-base"
                />
              </label>

              <div className="sticky bottom-4 z-10 flex flex-wrap gap-3 rounded-xl border border-[#eee7e3] bg-white/95 p-3 shadow-[0_8px_30px_rgba(17,19,24,0.08)] backdrop-blur">
                <button type="button" disabled={busy} onClick={() => void submitGrade(false)} className="button-primary">
                  <Check size={16} aria-hidden="true" />
                  {busy ? "Saving…" : "Save Grade"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void submitGrade(true)}
                  className="button-secondary"
                >
                  <RotateCcw size={16} aria-hidden="true" />
                  Return for Correction
                </button>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
