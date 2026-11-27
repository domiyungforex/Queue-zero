"use client";

import { useRef, useState } from "react";
import { ArrowRight, Camera, CheckCircle2, CreditCard, Plus, ShieldCheck, UserCheck } from "lucide-react";
import { DynamicCameraModal } from "@/components/school/dynamic-camera-modal";
import { submitGuestAssignmentAction, verifyGuestStudentForAssignment } from "@/lib/academic/guest-actions";
import { formatNgnFromMinor } from "@/lib/academic/allowance-ledger";

interface GuestQuestion {
  id: string;
  position: number;
  questionType: string;
  prompt: string;
  options: string[];
  marks: number;
}

interface UploadedFileItem {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  pageOrder: number;
}

export function GuestSubmissionPortal({
  token,
  assignmentTitle,
  courseCode,
  organizationName,
  dueAt,
  questions,
  referralCode,
}: {
  token: string;
  assignmentTitle: string;
  courseCode: string;
  organizationName: string;
  dueAt: string | null;
  questions: GuestQuestion[];
  referralCode?: string;
}) {
  const [matricNumber, setMatricNumber] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [student, setStudent] = useState<{ id: string; fullName: string; matricNumber: string; level: string } | null>(null);
  const [allowance, setAllowance] = useState<{
    requiresPayment: boolean;
    paymentSource: string;
    remainingFree: number;
    feeMinor: number;
    currency: string;
  } | null>(null);

  const [textContent, setTextContent] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<UploadedFileItem[]>([]);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<{ reference: string; submittedAt: string; isLate: boolean } | null>(null);
  const requestIdRef = useRef<string>(crypto.randomUUID());

  async function handleVerify() {
    setVerifying(true);
    setError("");
    const res = await verifyGuestStudentForAssignment({ token, matricNumber, referralCode });
    setVerifying(false);
    if (!res.ok) {
      setStudent(null);
      setAllowance(null);
      setError(res.error);
      return;
    }
    setStudent(res.student);
    setAllowance(res.allowance);
  }

  async function handleFileUpload(file: File) {
    setError("");
    const fd = new FormData();
    fd.set("file", file);
    const res = await fetch("/api/academic/files/upload", { method: "POST", body: fd });
    const json = (await res.json().catch(() => ({}))) as UploadedFileItem & { error?: string };
    if (!res.ok || !json.storagePath) {
      setError(json.error ?? "File upload failed.");
      return;
    }
    setFiles((prev) => [...prev, { ...json, pageOrder: prev.length + 1 }]);
  }

  async function startPaystackPayment() {
    if (!student) return;
    setPaying(true);
    setError("");
    try {
      const res = await fetch("/api/academic/payments/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, studentId: student.id }),
      });
      const json = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !json.url) {
        setError(json.error ?? "Could not start Paystack payment.");
        return;
      }
      location.assign(json.url);
    } catch {
      setError("Network error while starting Paystack checkout.");
    } finally {
      setPaying(false);
    }
  }

  async function handleSubmit() {
    if (!student || submitting) return;
    setSubmitting(true);
    setError("");
    const res = await submitGuestAssignmentAction({
      token,
      studentId: student.id,
      requestId: requestIdRef.current,
      textContent,
      answers,
      files,
    });
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setReceipt({ reference: res.reference, submittedAt: res.submittedAt, isLate: res.isLate });
  }

  if (receipt) {
    return (
      <section className="rounded-2xl border border-black/10 bg-white p-6 space-y-4">
        <div className="flex items-center gap-3 text-emerald-700">
          <CheckCircle2 size={24} aria-hidden="true" />
          <div>
            <h2 className="text-lg font-bold text-[#111318]">Assignment Submitted</h2>
            <p className="text-xs text-neutral-600">Reference: {receipt.reference}</p>
          </div>
        </div>
        <p className="text-sm text-neutral-700">
          Your submission for <strong>{courseCode} — {assignmentTitle}</strong> was recorded at{" "}
          {new Date(receipt.submittedAt).toLocaleString()}
          {receipt.isLate ? " (Late)" : ""}.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-black/10 bg-white p-6 space-y-4">
        <p className="text-xs font-bold uppercase tracking-wider text-[#ff6b2b]">
          {organizationName} · {courseCode}
        </p>
        <h1 className="text-2xl font-bold text-[#111318]">{assignmentTitle}</h1>
        {dueAt ? (
          <p className="text-xs text-neutral-600">Deadline: {new Date(dueAt).toLocaleString()}</p>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            value={matricNumber}
            onChange={(e) => setMatricNumber(e.target.value)}
            placeholder="Enter your matriculation number"
            className="min-h-12 flex-1 rounded-xl border border-black/15 px-3.5 text-base"
          />
          <button
            type="button"
            disabled={verifying || !matricNumber.trim()}
            onClick={() => void handleVerify()}
            className="min-h-12 rounded-xl bg-[#ff6b2b] px-5 text-sm font-bold text-white disabled:opacity-50"
          >
            {verifying ? "Verifying…" : "Verify Identity"}
          </button>
        </div>

        {student && allowance ? (
          <div className="rounded-xl border border-[#ffd9ca] bg-[#fffaf7] p-4 text-sm space-y-1">
            <div className="flex items-center gap-2 font-bold text-[#111318]">
              <UserCheck size={16} className="text-[#ff6b2b]" aria-hidden="true" />
              {student.fullName} ({student.matricNumber})
            </div>
            <p className="text-xs text-neutral-600">
              {allowance.requiresPayment
                ? `Free allowance used. Submission fee: ${formatNgnFromMinor(allowance.feeMinor, allowance.currency)}`
                : `Free submissions remaining: ${allowance.remainingFree} (${allowance.paymentSource.replaceAll("_", " ")})`}
            </p>
          </div>
        ) : null}
      </section>

      {student && allowance ? (
        allowance.requiresPayment ? (
          <section className="rounded-2xl border border-black/10 bg-white p-6 space-y-4">
            <h2 className="text-lg font-bold text-[#111318]">Submission Fee Required</h2>
            <p className="text-sm text-neutral-600">
              You have used your 5 free submissions. Pay{" "}
              <strong>{formatNgnFromMinor(allowance.feeMinor, allowance.currency)}</strong> via Paystack to unlock
              this submission.
            </p>
            <button
              type="button"
              disabled={paying}
              onClick={() => void startPaystackPayment()}
              className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#ff6b2b] px-6 text-sm font-bold text-white"
            >
              <CreditCard size={16} aria-hidden="true" />
              {paying ? "Opening Paystack…" : `Pay ${formatNgnFromMinor(allowance.feeMinor, allowance.currency)} with Paystack`}
            </button>
          </section>
        ) : (
          <section className="rounded-2xl border border-black/10 bg-white p-6 space-y-5">
            {questions.map((q) => (
              <div key={q.id} className="space-y-2 border-b border-black/5 pb-4">
                <p className="text-sm font-bold text-[#111318]">
                  Q{q.position}. {q.prompt} ({q.marks} marks)
                </p>
                {q.questionType === "MCQ" && q.options.length > 0 ? (
                  <div className="space-y-1.5">
                    {q.options.map((opt) => (
                      <label key={opt} className="flex items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name={`guest-q-${q.id}`}
                          checked={answers[q.id] === opt}
                          onChange={() => setAnswers((p) => ({ ...p, [q.id]: opt }))}
                        />
                        {opt}
                      </label>
                    ))}
                  </div>
                ) : (
                  <textarea
                    value={answers[q.id] ?? ""}
                    onChange={(e) => setAnswers((p) => ({ ...p, [q.id]: e.target.value }))}
                    rows={3}
                    placeholder="Type your answer…"
                    className="w-full rounded-xl border border-black/15 p-3 text-base"
                  />
                )}
              </div>
            ))}

            <label className="block text-sm font-bold text-[#111318]">
              Written Notes / Project Explanation
              <textarea
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                rows={4}
                className="mt-1.5 w-full rounded-xl border border-black/15 p-3 text-base"
              />
            </label>

            <div className="flex flex-wrap gap-3">
              <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-black/15 px-4 text-sm font-semibold">
                <Plus size={16} aria-hidden="true" />
                Upload PDF, Art, CAD (DWG/DXF/STL) or ZIP
                <input
                  type="file"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleFileUpload(f);
                  }}
                />
              </label>
              <button
                type="button"
                onClick={() => setCameraOpen(true)}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-black/15 px-4 text-sm font-semibold"
              >
                <Camera size={16} aria-hidden="true" />
                Capture Photo
              </button>
            </div>

            {files.length > 0 ? (
              <ul className="space-y-1 text-xs text-neutral-700">
                {files.map((f) => (
                  <li key={f.storagePath}>
                    Page {f.pageOrder}: <strong>{f.fileName}</strong> ({Math.round(f.sizeBytes / 1024)} KB)
                  </li>
                ))}
              </ul>
            ) : null}

            <DynamicCameraModal
              isOpen={cameraOpen}
              onClose={() => setCameraOpen(false)}
              onConfirmPhoto={async (url) => {
                const blob = await (await fetch(url)).blob();
                await handleFileUpload(new File([blob], `photo-${files.length + 1}.jpg`, { type: "image/jpeg" }));
              }}
            />

            <button
              type="button"
              disabled={submitting}
              onClick={() => void handleSubmit()}
              className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#111318] px-6 text-sm font-bold text-white"
            >
              <ArrowRight size={16} aria-hidden="true" />
              {submitting ? "Submitting…" : "Submit Assignment"}
            </button>
          </section>
        )
      ) : null}

      {error ? (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">
          {error}
        </p>
      ) : null}

      <p className="flex items-center justify-center gap-2 text-xs text-neutral-500">
        <ShieldCheck size={14} aria-hidden="true" />
        No student account required · Verified institutional submission
      </p>
    </div>
  );
}
