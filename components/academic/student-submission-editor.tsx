"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Camera, CheckCircle2, Plus, RefreshCw, Save, ShieldAlert, Trash2 } from "lucide-react";
import { DynamicCameraModal } from "@/components/school/dynamic-camera-modal";
import { saveSubmissionDraftAction, submitAssignmentAction } from "@/lib/academic/actions";

export interface StudentQuestionView {
  id: string;
  position: number;
  questionType: string;
  prompt: string;
  formulaLatex: string | null;
  options: string[];
  marks: number;
}

interface UploadedDoc {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  pageOrder: number;
  isHandwritten: boolean;
}

export function StudentSubmissionEditor({
  assignmentId,
  studentId,
  assignmentTitle,
  questions,
  allowTextAnswer,
  allowFileUpload,
  allowPhotoSubmission,
  maxUploadMb = 25,
  maxAttachments = 5,
  initialText,
  initialAnswers,
  existingSubmission,
}: {
  assignmentId: string;
  studentId: string;
  assignmentTitle: string;
  questions: StudentQuestionView[];
  allowTextAnswer: boolean;
  allowFileUpload: boolean;
  allowPhotoSubmission: boolean;
  maxUploadMb?: number;
  maxAttachments?: number;
  initialText: string;
  initialAnswers: Record<string, string>;
  existingSubmission: {
    status: string;
    reference: string;
    submittedAt: string | null;
    isLate: boolean;
    finalScore: number | null;
    gradeReleased: boolean;
    lecturerRemarks: string | null;
  } | null;
}) {
  const [textContent, setTextContent] = useState(initialText);
  const [answers, setAnswers] = useState<Record<string, string>>(initialAnswers);
  const [files, setFiles] = useState<UploadedDoc[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "offline" | "failed">("idle");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState(existingSubmission);
  const requestIdRef = useRef<string>(crypto.randomUUID());

  const isLocked = Boolean(
    receipt && !["DRAFT", "RETURNED"].includes(receipt.status),
  );

  // LocalStorage + server debounced autosave so student work is never lost
  useEffect(() => {
    if (isLocked) return;
    const localKey = `turnmark:assignment-draft:${assignmentId}:${studentId}`;
    try {
      localStorage.setItem(localKey, JSON.stringify({ textContent, answers }));
    } catch {}

    const timer = setTimeout(async () => {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setSaveState("offline");
        return;
      }
      setSaveState("saving");
      const res = await saveSubmissionDraftAction({
        assignmentId,
        studentId,
        textContent,
        answers,
      });
      setSaveState(res.ok ? "saved" : "failed");
    }, 1200);

    return () => clearTimeout(timer);
  }, [textContent, answers, assignmentId, studentId, isLocked]);

  async function handleFileSelect(file: File, isHandwritten = false) {
    if (files.length >= maxAttachments) {
      setError(`Maximum of ${maxAttachments} attachments reached for this assignment.`);
      return;
    }
    setError("");
    setUploading(true);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("assignmentId", assignmentId);

      const res = await fetch("/api/academic/files/upload", { method: "POST", body: form });
      const json = (await res.json().catch(() => ({}))) as UploadedDoc & { error?: string };
      if (!res.ok || !json.storagePath) {
        setError(json.error || "File upload failed. You can retry.");
        return;
      }

      setFiles((prev) => [
        ...prev,
        {
          fileName: json.fileName,
          mimeType: json.mimeType,
          sizeBytes: json.sizeBytes,
          storagePath: json.storagePath,
          pageOrder: prev.length + 1,
          isHandwritten,
        },
      ]);
    } catch {
      setError("Network error during upload. Please retry.");
    } finally {
      setUploading(false);
    }
  }

  async function handleCameraCapture(dataUrl: string) {
    const blob = await (await fetch(dataUrl)).blob();
    const file = new File([blob], `handwritten-page-${files.length + 1}.jpg`, { type: "image/jpeg" });
    await handleFileSelect(file, true);
  }

  async function handleSubmit() {
    if (submitting || isLocked) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await submitAssignmentAction({
        assignmentId,
        studentId,
        requestId: requestIdRef.current,
        textContent,
        answers,
        files,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setReceipt({
        status: res.isLate ? "LATE" : "SUBMITTED",
        reference: res.reference,
        submittedAt: res.submittedAt,
        isLate: res.isLate,
        finalScore: null,
        gradeReleased: false,
        lecturerRemarks: null,
      });
    } catch {
      setError("Network error while submitting. Your draft is saved — tap Submit again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (receipt && !["DRAFT", "RETURNED"].includes(receipt.status)) {
    return (
      <section className="panel p-6 space-y-4" aria-live="polite">
        <div className="flex items-center gap-3 text-emerald-700">
          <CheckCircle2 size={24} aria-hidden="true" />
          <div>
            <h2 className="text-lg font-bold text-[#111318]">Submission Receipt</h2>
            <p className="text-xs text-neutral-600">Reference: {receipt.reference}</p>
          </div>
        </div>
        <dl className="grid gap-3 rounded-xl bg-[#fffaf7] p-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-neutral-500">Assignment</dt>
            <dd className="font-bold">{assignmentTitle}</dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">Status</dt>
            <dd className="font-bold">{receipt.status}{receipt.isLate ? " (Late)" : ""}</dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">Submitted At</dt>
            <dd>{receipt.submittedAt ? new Date(receipt.submittedAt).toLocaleString() : "Recorded"}</dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">Grade</dt>
            <dd className="font-bold text-[#ff6b2b]">
              {receipt.gradeReleased && receipt.finalScore != null
                ? `${receipt.finalScore} marks`
                : "Pending lecturer release"}
            </dd>
          </div>
        </dl>
        {receipt.gradeReleased && receipt.lecturerRemarks ? (
          <div className="rounded-xl border border-black/10 p-4 text-sm">
            <strong className="block text-xs uppercase tracking-wider text-neutral-500">Lecturer Feedback</strong>
            <p className="mt-1 text-[#111318]">{receipt.lecturerRemarks}</p>
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-black/10 bg-white px-4 py-2.5 text-xs font-semibold">
        <span>Draft Autosave</span>
        <span className="inline-flex items-center gap-1.5 text-neutral-600">
          {saveState === "saving" ? <><RefreshCw size={13} className="animate-spin" /> Saving…</> : null}
          {saveState === "saved" ? <><Save size={13} className="text-emerald-600" /> Saved</> : null}
          {saveState === "offline" ? <><ShieldAlert size={13} className="text-amber-600" /> Offline (saved locally)</> : null}
          {saveState === "failed" ? <span className="text-red-700">Save failed — retrying</span> : null}
        </span>
      </div>

      {questions.length > 0 ? (
        <div className="space-y-4">
          {questions.map((q) => (
            <article key={q.id} className="panel p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#ff6b2b]">
                  Question {q.position} · {q.questionType.replaceAll("_", " ")}
                </span>
                <span className="text-xs font-semibold text-neutral-600">{q.marks} marks</span>
              </div>
              <p className="text-sm font-semibold text-[#111318]">{q.prompt}</p>
              {q.formulaLatex ? (
                <pre className="rounded-lg bg-neutral-100 p-2 text-xs font-mono">{q.formulaLatex}</pre>
              ) : null}

              {q.questionType === "MCQ" && q.options.length > 0 ? (
                <div className="space-y-2 pt-1">
                  {q.options.map((opt) => (
                    <label key={opt} className="flex items-center gap-2.5 text-sm">
                      <input
                        type="radio"
                        name={`q-${q.id}`}
                        value={opt}
                        checked={answers[q.id] === opt}
                        onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: opt }))}
                      />
                      <span>{opt}</span>
                    </label>
                  ))}
                </div>
              ) : q.questionType === "TRUE_FALSE" ? (
                <div className="flex gap-6 pt-1">
                  {["True", "False"].map((opt) => (
                    <label key={opt} className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name={`q-${q.id}`}
                        value={opt}
                        checked={answers[q.id] === opt}
                        onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: opt }))}
                      />
                      <span>{opt}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <textarea
                  value={answers[q.id] ?? ""}
                  onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                  rows={q.questionType === "ESSAY" || q.questionType === "LONG_ANSWER" ? 5 : 2}
                  placeholder="Write your answer…"
                  className="w-full rounded-xl border border-black/15 p-3 text-base"
                />
              )}
            </article>
          ))}
        </div>
      ) : null}

      {allowTextAnswer ? (
        <div className="panel p-5 space-y-2">
          <label className="block text-sm font-bold text-[#111318]">
            Written Response / Notes
            <textarea
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              rows={6}
              placeholder="Write or paste your response here…"
              className="mt-2 w-full rounded-xl border border-black/15 p-3.5 text-base"
            />
          </label>
        </div>
      ) : null}

      {(allowFileUpload || allowPhotoSubmission) ? (
        <div className="panel p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-[#111318]">Attachments &amp; Handwritten Pages</h3>
            <span className="text-xs text-neutral-500">
              {files.length} / {maxAttachments} files · Max {maxUploadMb} MB each
            </span>
          </div>
          <div className="flex flex-wrap gap-3">
            {allowFileUpload ? (
              <label className="button-secondary cursor-pointer">
                <Plus size={16} aria-hidden="true" />
                {uploading ? "Uploading…" : "Upload Document / File"}
                <input
                  type="file"
                  disabled={uploading || files.length >= maxAttachments}
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.rtf,.md,.csv,.jpg,.jpeg,.png,.webp,.heic,.zip,.dwg,.dxf,.step,.stp,.stl,.obj,.xlsx,.py,.js,.ts,.c,.cpp,.java"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (f) void handleFileSelect(f, false);
                  }}
                />
              </label>
            ) : null}
            {allowPhotoSubmission ? (
              <button
                type="button"
                disabled={uploading || files.length >= maxAttachments}
                onClick={() => setCameraOpen(true)}
                className="button-secondary"
              >
                <Camera size={16} aria-hidden="true" />
                Capture Handwritten Page
              </button>
            ) : null}
          </div>
          {files.length > 0 ? (
            <ul className="space-y-1.5 text-sm">
              {files.map((f) => (
                <li key={f.storagePath} className="flex items-center justify-between rounded-lg bg-[#fffaf7] px-3 py-2">
                  <span>
                    Page {f.pageOrder}: <strong>{f.fileName}</strong> ({Math.round(f.sizeBytes / 1024)} KB)
                  </span>
                  <button
                    type="button"
                    aria-label={`Remove ${f.fileName}`}
                    onClick={() =>
                      setFiles((prev) =>
                        prev
                          .filter((item) => item.storagePath !== f.storagePath)
                          .map((item, idx) => ({ ...item, pageOrder: idx + 1 })),
                      )
                    }
                    className="rounded-lg p-1 text-red-600 hover:bg-red-50"
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <DynamicCameraModal
        isOpen={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onConfirmPhoto={(url) => void handleCameraCapture(url)}
        title="Capture Handwritten Answer"
        description="Frame your handwritten page clearly in good lighting."
      />

      {error ? (
        <p className="notice warning" role="alert">
          {error}
        </p>
      ) : null}

      <button type="button" disabled={submitting} onClick={() => void handleSubmit()} className="button-primary">
        <ArrowRight size={16} aria-hidden="true" />
        {submitting ? "Submitting…" : "Submit Assignment"}
      </button>
    </div>
  );
}
