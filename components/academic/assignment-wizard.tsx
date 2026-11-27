"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, BookOpen, Camera, Check, CheckCircle2, FileText, Plus, Sparkles, X } from "lucide-react";
import { CustomDropdown } from "@/components/ui/custom-dropdown";
import { DynamicCameraModal } from "@/components/school/dynamic-camera-modal";
import { createAssignmentAction, updateAssignmentAction } from "@/lib/academic/actions";
import type { SmartAssignmentExtraction } from "@/lib/academic/ingestion";
import { ASSIGNMENT_CATEGORIES, MARKING_MODES, QUESTION_TYPES, type QuestionType } from "@/lib/academic/types";

export interface InitialAssignmentQuestion {
  id: string;
  questionType: string;
  prompt: string;
  description: string;
  formulaLatex: string;
  optionsText: string;
  acceptedAnswersText: string;
  modelAnswer: string;
  expectedUnit: string;
  numericTolerance: number;
  marks: number;
  negativeMarks: number;
  partialCredit: boolean;
  caseSensitive: boolean;
}

export interface InitialAssignmentData {
  id: string;
  title: string;
  courseId: string;
  manualCourseCode: string;
  manualCourseName: string;
  manualDepartment: string;
  manualFaculty: string;
  manualLevel: string;
  category: string;
  academicSession: string;
  semester: string;
  description: string;
  instructions: string;
  dueAt: string;
  latePolicy: string;
  submissionMode: string;
  allowTextAnswer: boolean;
  allowFileUpload: boolean;
  allowPhotoSubmission: boolean;
  maxAttempts: number;
  markingMode: string;
  releaseMarksImmediately: boolean;
  status: string;
  questions: InitialAssignmentQuestion[];
}

interface QuestionDraft {
  id: string;
  questionType: QuestionType;
  prompt: string;
  description: string;
  formulaLatex: string;
  optionsText: string;
  acceptedAnswersText: string;
  modelAnswer: string;
  expectedUnit: string;
  numericTolerance: number;
  marks: number;
  negativeMarks: number;
  partialCredit: boolean;
  caseSensitive: boolean;
}

function emptyQuestion(): QuestionDraft {
  return {
    id: crypto.randomUUID(),
    questionType: "SHORT_ANSWER",
    prompt: "",
    description: "",
    formulaLatex: "",
    optionsText: "",
    acceptedAnswersText: "",
    modelAnswer: "",
    expectedUnit: "",
    numericTolerance: 0,
    marks: 10,
    negativeMarks: 0,
    partialCredit: false,
    caseSensitive: false,
  };
}

function toDatetimeLocalValue(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function AssignmentWizard({
  courses,
  mode = "create",
  initialData,
}: {
  courses: Array<{ id: string; code: string; title: string }>;
  mode?: "create" | "edit";
  initialData?: InitialAssignmentData;
}) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [ingesting, setIngesting] = useState(false);
  const [smartPrompt, setSmartPrompt] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [extractionReport, setExtractionReport] = useState<SmartAssignmentExtraction | null>(null);

  // Step 1: Basic Info
  const [title, setTitle] = useState(initialData?.title ?? "");
  const [courseMode, setCourseMode] = useState<"catalog" | "manual">(
    initialData
      ? initialData.courseId
        ? "catalog"
        : "manual"
      : courses.length > 0
        ? "catalog"
        : "manual",
  );
  const [courseId, setCourseId] = useState(initialData?.courseId || courses[0]?.id || "");
  const [manualCourseCode, setManualCourseCode] = useState(initialData?.manualCourseCode ?? "");
  const [manualCourseName, setManualCourseName] = useState(initialData?.manualCourseName ?? "");
  const [manualDepartment, setManualDepartment] = useState(initialData?.manualDepartment ?? "");
  const [manualFaculty, setManualFaculty] = useState(initialData?.manualFaculty ?? "");
  const [manualLevel, setManualLevel] = useState(initialData?.manualLevel ?? "");
  const [category, setCategory] = useState<(typeof ASSIGNMENT_CATEGORIES)[number]>(
    (initialData?.category as (typeof ASSIGNMENT_CATEGORIES)[number]) ?? "HOMEWORK",
  );
  const [academicSession, setAcademicSession] = useState(initialData?.academicSession ?? "2025/2026");
  const [semester, setSemester] = useState(initialData?.semester ?? "First");
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [instructions, setInstructions] = useState(initialData?.instructions ?? "");
  const [learningObjectives] = useState("");

  // Step 2: Questions
  const [questions, setQuestions] = useState<QuestionDraft[]>(
    initialData && initialData.questions.length > 0
      ? initialData.questions.map((q) => ({
          ...q,
          questionType: q.questionType as QuestionType,
        }))
      : [emptyQuestion()],
  );

  // Step 3: Submission Config
  const [dueAt, setDueAt] = useState(toDatetimeLocalValue(initialData?.dueAt));
  const [latePolicy, setLatePolicy] = useState<"BLOCK" | "ALLOW_WITH_FLAG" | "ALLOW_PENALTY">(
    (initialData?.latePolicy as "BLOCK" | "ALLOW_WITH_FLAG" | "ALLOW_PENALTY") ?? "ALLOW_WITH_FLAG",
  );
  const [submissionMode, setSubmissionMode] = useState<"INDIVIDUAL" | "GROUP">(
    (initialData?.submissionMode as "INDIVIDUAL" | "GROUP") ?? "INDIVIDUAL",
  );
  const [allowTextAnswer, setAllowTextAnswer] = useState(initialData?.allowTextAnswer ?? true);
  const [allowFileUpload, setAllowFileUpload] = useState(initialData?.allowFileUpload ?? true);
  const [allowPhotoSubmission, setAllowPhotoSubmission] = useState(initialData?.allowPhotoSubmission ?? true);
  const [maxAttempts, setMaxAttempts] = useState(initialData?.maxAttempts ?? 1);

  // Step 4: Marking Config
  const [markingMode, setMarkingMode] = useState<(typeof MARKING_MODES)[number]>(
    (initialData?.markingMode as (typeof MARKING_MODES)[number]) ?? "HYBRID",
  );
  const [releaseMarksImmediately, setReleaseMarksImmediately] = useState(
    initialData?.releaseMarksImmediately ?? false,
  );
  const [changeSummary, setChangeSummary] = useState("");
  const [notifyStudents, setNotifyStudents] = useState(true);

  const totalMarks = questions.reduce((sum, q) => sum + Number(q.marks || 0), 0) || 100;

  function updateQuestion(id: string, patch: Partial<QuestionDraft>) {
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  }

  async function runSmartIngest(formData: FormData) {
    setIngesting(true);
    setError("");
    setFieldErrors({});
    try {
      const res = await fetch("/api/academic/assignments/ingest", { method: "POST", body: formData });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        extraction?: SmartAssignmentExtraction;
      };
      if (!res.ok || !json.extraction) {
        setError(json.error ?? "Could not extract assignment content.");
        return;
      }
      const ex = json.extraction;
      setExtractionReport(ex);
      if (ex.title) setTitle(ex.title);
      if (ex.matchedCourseId) {
        setCourseMode("catalog");
        setCourseId(ex.matchedCourseId);
      } else if (ex.matchedCourseCode) {
        setCourseMode("manual");
        setManualCourseCode(ex.matchedCourseCode);
      }
      if (ex.category) setCategory(ex.category);
      if (ex.instructions) setInstructions(ex.instructions);
      if (ex.questions.length > 0) {
        setQuestions(
          ex.questions.map((q) => ({
            id: crypto.randomUUID(),
            questionType: q.questionType,
            prompt: q.prompt,
            description: q.uncertain ? "Flagged as uncertain — please verify." : "",
            formulaLatex: q.formulaLatex,
            optionsText: q.options.join("\n"),
            acceptedAnswersText: "",
            modelAnswer: "",
            expectedUnit: "",
            numericTolerance: 0,
            marks: q.marks,
            negativeMarks: 0,
            partialCredit: false,
            caseSensitive: false,
          })),
        );
      }
    } catch {
      setError("Smart autofill failed. You can continue manually.");
    } finally {
      setIngesting(false);
    }
  }

  async function save(publishNow: boolean) {
    const nextFieldErrors: Record<string, string> = {};
    if (!title.trim()) {
      nextFieldErrors.title = "Assignment title is required.";
    }
    if (courseMode === "catalog" && !courseId) {
      nextFieldErrors.courseId = "Select a course or switch to manual course entry.";
    }
    if (courseMode === "manual" && !manualCourseName.trim() && !manualCourseCode.trim()) {
      nextFieldErrors.manualCourseName = "Enter a course name or course code.";
    }

    const nonEmptyQuestions = questions.filter((q) => Boolean(q.prompt.trim()));
    if (nonEmptyQuestions.length === 0 && !instructions.trim() && !description.trim()) {
      nextFieldErrors["questions.0.prompt"] = "Add at least one question prompt or provide assignment instructions.";
    }

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      const firstMsg = Object.values(nextFieldErrors)[0];
      setError(firstMsg);
      if (nextFieldErrors.title || nextFieldErrors.courseId || nextFieldErrors.manualCourseName) {
        setStep(1);
      } else if (nextFieldErrors["questions.0.prompt"]) {
        setStep(2);
      }
      return;
    }

    setBusy(true);
    setError("");
    setFieldErrors({});
    try {
      const payload = {
        ...(mode === "edit" && initialData ? { assignmentId: initialData.id, changeSummary, notifyStudents } : {}),
        title: title.trim(),
        courseId: courseMode === "catalog" ? courseId || null : null,
        manualCourseCode: courseMode === "manual" ? manualCourseCode.trim() : "",
        manualCourseName: courseMode === "manual" ? manualCourseName.trim() : "",
        manualDepartment: courseMode === "manual" ? manualDepartment.trim() : "",
        manualFaculty: courseMode === "manual" ? manualFaculty.trim() : "",
        manualLevel: courseMode === "manual" ? manualLevel.trim() : "",
        category,
        academicSession: academicSession.trim(),
        semester: semester.trim(),
        description: description.trim(),
        instructions: instructions.trim(),
        learningObjectives: learningObjectives.trim(),
        dueAt: dueAt ? new Date(dueAt).toISOString() : null,
        latePolicy,
        submissionMode,
        allowTextAnswer,
        allowFileUpload,
        allowPhotoSubmission,
        maxAttempts,
        markingMode,
        totalMarks,
        releaseMarksImmediately,
        publishNow,
        questions: nonEmptyQuestions.map((q) => ({
          questionType: q.questionType,
          prompt: q.prompt.trim(),
          description: q.description.trim(),
          formulaLatex: q.formulaLatex.trim(),
          options: q.optionsText
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean),
          acceptedAnswers: q.acceptedAnswersText
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          modelAnswer: q.modelAnswer.trim(),
          expectedUnit: q.expectedUnit.trim(),
          numericTolerance: Number(q.numericTolerance || 0),
          marks: Number(q.marks || 0),
          negativeMarks: Number(q.negativeMarks || 0),
          partialCredit: q.partialCredit,
          caseSensitive: q.caseSensitive,
        })),
      };

      const res =
        mode === "edit"
          ? await updateAssignmentAction(payload)
          : await createAssignmentAction(payload);
      if (!res.ok) {
        setError(res.error);
        if ("fieldErrors" in res && res.fieldErrors) {
          setFieldErrors(res.fieldErrors);
        }
        return;
      }
      router.push(`/dashboard/academic/assignments/${res.assignmentId}`);
      router.refresh();
    } catch {
      setError("Could not save assignment. Check your inputs and try again.");
    } finally {
      setBusy(false);
    }
  }

  const steps = ["Basic Info", "Questions", "Submission", "Marking", "Review & Publish"];

  return (
    <div className="space-y-6">
      <section className="panel border-[#ffd9ca] bg-[#fffaf7] p-5 space-y-4" aria-label="Smart Assignment Creation">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-bold text-[#111318]">
            <Sparkles size={18} className="text-[#ff6b2b]" aria-hidden="true" />
            Smart Assignment Autofill
          </div>
          <span className="text-xs text-neutral-600">Upload a document, snap a photo, or describe it in plain text</span>
        </div>

        <div className="flex flex-wrap gap-3">
          <label className="button-secondary cursor-pointer">
            <Plus size={16} aria-hidden="true" />
            {ingesting ? "Processing…" : "Upload Document (PDF / DOCX / Image)"}
            <input
              type="file"
              accept=".pdf,.docx,.txt,image/jpeg,image/png,image/webp"
              className="sr-only"
              disabled={ingesting}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  const fd = new FormData();
                  fd.set("method", "DOCUMENT");
                  fd.set("file", f);
                  void runSmartIngest(fd);
                }
              }}
            />
          </label>
          <button type="button" disabled={ingesting} onClick={() => setCameraOpen(true)} className="button-secondary">
            <Camera size={16} aria-hidden="true" />
            Take Photograph
          </button>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={smartPrompt}
            onChange={(e) => setSmartPrompt(e.target.value)}
            placeholder="Or paste/describe questions (e.g. 'CSC 301 Homework: 1. Explain Merge Sort [10 marks]...')"
            className="min-h-11 flex-1 rounded-xl border border-black/15 bg-white px-3.5 text-sm"
          />
          <button
            type="button"
            disabled={ingesting || !smartPrompt.trim()}
            onClick={() => {
              const fd = new FormData();
              fd.set("method", "DESCRIPTION");
              fd.set("description", smartPrompt);
              void runSmartIngest(fd);
            }}
            className="button-primary"
          >
            {ingesting ? "Extracting…" : "Autofill Form"}
          </button>
        </div>

        {extractionReport ? (
          <div className="rounded-xl border border-black/10 bg-white p-4 text-xs space-y-2">
            <p className="font-bold text-[#111318]">
              Smart Review: {extractionReport.questions.length} question(s) extracted
              {extractionReport.matchedCourseCode ? ` · Matched ${extractionReport.matchedCourseCode}` : ""}
            </p>
            {extractionReport.missingFields.length > 0 ? (
              <p className="text-amber-800">
                <strong>Needs confirmation:</strong> {extractionReport.missingFields.join("; ")}
              </p>
            ) : null}
            {extractionReport.warnings.map((w) => (
              <p key={w} className="text-neutral-600">• {w}</p>
            ))}
          </div>
        ) : null}

        <DynamicCameraModal
          isOpen={cameraOpen}
          onClose={() => setCameraOpen(false)}
          onConfirmPhoto={async (dataUrl) => {
            const blob = await (await fetch(dataUrl)).blob();
            const file = new File([blob], "assignment-sheet.jpg", { type: "image/jpeg" });
            const fd = new FormData();
            fd.set("method", "PHOTO");
            fd.set("file", file);
            void runSmartIngest(fd);
          }}
          title="Photograph Assignment Sheet"
          description="Capture a clear photograph of your printed or handwritten assignment."
        />
      </section>

      <div className="panel p-4 sm:p-5" aria-label="Wizard steps">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {steps.map((label, idx) => {
            const num = (idx + 1) as 1 | 2 | 3 | 4 | 5;
            const active = step === num;
            const completed = step > num;
            return (
              <button
                key={label}
                type="button"
                onClick={() => setStep(num)}
                className={`group flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition ${
                  active
                    ? "border-[#ff6b2b] bg-[#fff5ef] text-[#111318] shadow-sm"
                    : completed
                      ? "border-emerald-200 bg-emerald-50/60 text-emerald-900 hover:bg-emerald-50"
                      : "border-black/10 bg-white text-neutral-600 hover:border-black/20 hover:bg-neutral-50"
                }`}
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-extrabold ${
                    active
                      ? "bg-[#ff6b2b] text-white"
                      : completed
                        ? "bg-emerald-600 text-white"
                        : "bg-neutral-100 text-neutral-700"
                  }`}
                >
                  {completed ? <Check size={13} aria-hidden="true" /> : num}
                </span>
                <span className="truncate text-xs font-bold">{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {error ? (
        <p className="notice warning" role="alert">
          {error}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px] lg:items-start">
      <div className="panel p-6 sm:p-8">
        {step === 1 ? (
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-sm font-bold text-[#111318]">
                Assignment title
                <input
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    if (fieldErrors.title) setFieldErrors((prev) => ({ ...prev, title: "" }));
                  }}
                  placeholder="e.g. Week 4 Algorithms Problem Set"
                  aria-invalid={Boolean(fieldErrors.title)}
                  className={`mt-1.5 min-h-12 w-full rounded-xl border px-3.5 text-base ${
                    fieldErrors.title ? "border-red-500 bg-red-50/40" : "border-black/15"
                  }`}
                />
              </label>
              {fieldErrors.title ? <p className="mt-1 text-xs font-semibold text-red-600">{fieldErrors.title}</p> : null}
            </div>

            <div className="sm:col-span-2 rounded-2xl border border-black/10 bg-[#fffaf7] p-5 space-y-4">
              <div>
                <span className="text-sm font-bold text-[#111318]">Course Information</span>
                <p className="mt-0.5 text-xs text-neutral-600">
                  Link to an existing institutional course or enter course details manually.
                </p>
              </div>

              <div className={`grid gap-3 ${courses.length > 0 ? "sm:grid-cols-2" : "grid-cols-1"}`}>
                {courses.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setCourseMode("catalog")}
                    aria-pressed={courseMode === "catalog"}
                    className={`flex items-start gap-3 rounded-xl border p-3.5 text-left transition ${
                      courseMode === "catalog"
                        ? "border-[#ff6b2b] bg-white shadow-sm ring-2 ring-[#ff6b2b]/15"
                        : "border-black/10 bg-white/60 hover:border-black/20 hover:bg-white"
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                        courseMode === "catalog" ? "bg-[#fff0e8] text-[#d94b14]" : "bg-neutral-100 text-neutral-600"
                      }`}
                    >
                      <BookOpen size={18} aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2 text-sm font-bold text-[#111318]">
                        Select existing course
                        {courseMode === "catalog" ? (
                          <CheckCircle2 size={16} className="shrink-0 text-[#ff6b2b]" aria-hidden="true" />
                        ) : null}
                      </span>
                      <span className="mt-0.5 block text-xs text-neutral-600">
                        Choose from your institution&apos;s registered courses
                      </span>
                    </span>
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={() => setCourseMode("manual")}
                  aria-pressed={courseMode === "manual"}
                  className={`flex items-start gap-3 rounded-xl border p-3.5 text-left transition ${
                    courseMode === "manual"
                      ? "border-[#ff6b2b] bg-white shadow-sm ring-2 ring-[#ff6b2b]/15"
                      : "border-black/10 bg-white/60 hover:border-black/20 hover:bg-white"
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                      courseMode === "manual" ? "bg-[#fff0e8] text-[#d94b14]" : "bg-neutral-100 text-neutral-600"
                    }`}
                  >
                    <FileText size={18} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2 text-sm font-bold text-[#111318]">
                      Enter course manually
                      {courseMode === "manual" ? (
                        <CheckCircle2 size={16} className="shrink-0 text-[#ff6b2b]" aria-hidden="true" />
                      ) : null}
                    </span>
                    <span className="mt-0.5 block text-xs text-neutral-600">
                      Type course name, code, department, and level directly
                    </span>
                  </span>
                </button>
              </div>

              {courseMode === "catalog" && courses.length > 0 ? (
                <div>
                  <CustomDropdown
                    name="courseId"
                    label="Course"
                    value={courseId}
                    onChange={(val) => {
                      setCourseId(val);
                      if (fieldErrors.courseId) setFieldErrors((prev) => ({ ...prev, courseId: "" }));
                    }}
                    options={courses.map((c) => ({ value: c.id, label: `${c.code} — ${c.title}` }))}
                  />
                  {fieldErrors.courseId ? <p className="mt-1 text-xs font-semibold text-red-600">{fieldErrors.courseId}</p> : null}
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-sm font-bold text-[#111318]">
                    Course name
                    <input
                      value={manualCourseName}
                      onChange={(e) => {
                        setManualCourseName(e.target.value);
                        if (fieldErrors.manualCourseName) setFieldErrors((prev) => ({ ...prev, manualCourseName: "" }));
                      }}
                      placeholder="e.g. Introduction to Computer Science"
                      aria-invalid={Boolean(fieldErrors.manualCourseName)}
                      className={`mt-1.5 min-h-11 w-full rounded-xl border bg-white px-3.5 text-base ${
                        fieldErrors.manualCourseName ? "border-red-500 bg-red-50/40" : "border-black/15"
                      }`}
                    />
                    {fieldErrors.manualCourseName ? (
                      <span className="mt-1 block text-xs font-semibold text-red-600">{fieldErrors.manualCourseName}</span>
                    ) : null}
                  </label>
                  <label className="block text-sm font-bold text-[#111318]">
                    Course code (optional)
                    <input
                      value={manualCourseCode}
                      onChange={(e) => setManualCourseCode(e.target.value)}
                      placeholder="e.g. CSC 101"
                      className="mt-1.5 min-h-11 w-full rounded-xl border border-black/15 bg-white px-3.5 text-base"
                    />
                  </label>
                  <label className="block text-sm font-bold text-[#111318]">
                    Department (optional)
                    <input
                      value={manualDepartment}
                      onChange={(e) => setManualDepartment(e.target.value)}
                      placeholder="e.g. Computer Science"
                      className="mt-1.5 min-h-11 w-full rounded-xl border border-black/15 bg-white px-3.5 text-base"
                    />
                  </label>
                  <label className="block text-sm font-bold text-[#111318]">
                    Faculty (optional)
                    <input
                      value={manualFaculty}
                      onChange={(e) => setManualFaculty(e.target.value)}
                      placeholder="e.g. Physical Sciences"
                      className="mt-1.5 min-h-11 w-full rounded-xl border border-black/15 bg-white px-3.5 text-base"
                    />
                  </label>
                  <label className="block text-sm font-bold text-[#111318]">
                    Academic level (optional)
                    <input
                      value={manualLevel}
                      onChange={(e) => setManualLevel(e.target.value)}
                      placeholder="e.g. 200 Level"
                      className="mt-1.5 min-h-11 w-full rounded-xl border border-black/15 bg-white px-3.5 text-base"
                    />
                  </label>
                </div>
              )}
            </div>
            <CustomDropdown
              name="category"
              label="Assignment category"
              value={category}
              onChange={(val) => setCategory(val as (typeof ASSIGNMENT_CATEGORIES)[number])}
              options={ASSIGNMENT_CATEGORIES.map((c) => ({ value: c, label: c.replaceAll("_", " ") }))}
            />
            <label className="block text-sm font-bold text-[#111318]">
              Academic session
              <input
                value={academicSession}
                onChange={(e) => setAcademicSession(e.target.value)}
                className="mt-1.5 min-h-12 w-full rounded-xl border border-black/15 px-3.5 text-base"
              />
            </label>
            <label className="block text-sm font-bold text-[#111318]">
              Semester
              <input
                value={semester}
                onChange={(e) => setSemester(e.target.value)}
                className="mt-1.5 min-h-12 w-full rounded-xl border border-black/15 px-3.5 text-base"
              />
            </label>
            <div className="sm:col-span-2">
              <label className="block text-sm font-bold text-[#111318]">
                Instructions
                <textarea
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  rows={3}
                  placeholder="Clear instructions for students…"
                  className="mt-1.5 w-full rounded-xl border border-black/15 p-3.5 text-base"
                />
              </label>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-bold text-[#111318]">
                Description / Learning objectives
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="mt-1.5 w-full rounded-xl border border-black/15 p-3.5 text-base"
                />
              </label>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-6">
            {questions.map((q, index) => (
              <div key={q.id} className="rounded-2xl border border-black/10 bg-[#fffaf7] p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <strong className="text-sm font-bold text-[#111318]">Question {index + 1}</strong>
                  {questions.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => setQuestions((prev) => prev.filter((item) => item.id !== q.id))}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-red-700"
                    >
                      <X size={14} aria-hidden="true" /> Remove
                    </button>
                  ) : null}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <CustomDropdown
                    label="Question type"
                    value={q.questionType}
                    onChange={(val) => updateQuestion(q.id, { questionType: val as QuestionType })}
                    options={QUESTION_TYPES.map((t) => ({ value: t, label: t.replaceAll("_", " ") }))}
                  />
                  <label className="block text-sm font-bold text-[#111318]">
                    Marks
                    <input
                      type="number"
                      min={0}
                      value={q.marks}
                      onChange={(e) => updateQuestion(q.id, { marks: Number(e.target.value) })}
                      className="mt-1.5 min-h-12 w-full rounded-xl border border-black/15 bg-white px-3.5 text-base"
                    />
                  </label>
                </div>
                <label className="block text-sm font-bold text-[#111318]">
                  Question prompt
                  <textarea
                    value={q.prompt}
                    onChange={(e) => updateQuestion(q.id, { prompt: e.target.value })}
                    rows={3}
                    placeholder="Write the question prompt…"
                    className="mt-1.5 w-full rounded-xl border border-black/15 bg-white p-3.5 text-base"
                  />
                </label>
                {q.questionType === "MCQ" ? (
                  <label className="block text-sm font-bold text-[#111318]">
                    Options (one per line)
                    <textarea
                      value={q.optionsText}
                      onChange={(e) => updateQuestion(q.id, { optionsText: e.target.value })}
                      rows={3}
                      placeholder={"Option A\nOption B\nOption C"}
                      className="mt-1.5 w-full rounded-xl border border-black/15 bg-white p-3.5 text-base"
                    />
                  </label>
                ) : null}
                {q.questionType === "MATH" ? (
                  <div className="grid gap-4 sm:grid-cols-3">
                    <label className="block text-sm font-bold text-[#111318]">
                      LaTeX / Formula (optional)
                      <input
                        value={q.formulaLatex}
                        onChange={(e) => updateQuestion(q.id, { formulaLatex: e.target.value })}
                        placeholder="e.g. F = m * a"
                        className="mt-1.5 min-h-11 w-full rounded-xl border border-black/15 bg-white px-3 text-base"
                      />
                    </label>
                    <label className="block text-sm font-bold text-[#111318]">
                      Expected unit
                      <input
                        value={q.expectedUnit}
                        onChange={(e) => updateQuestion(q.id, { expectedUnit: e.target.value })}
                        placeholder="e.g. N, m/s"
                        className="mt-1.5 min-h-11 w-full rounded-xl border border-black/15 bg-white px-3 text-base"
                      />
                    </label>
                    <label className="block text-sm font-bold text-[#111318]">
                      Numeric tolerance (±)
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        value={q.numericTolerance}
                        onChange={(e) => updateQuestion(q.id, { numericTolerance: Number(e.target.value) })}
                        className="mt-1.5 min-h-11 w-full rounded-xl border border-black/15 bg-white px-3 text-base"
                      />
                    </label>
                  </div>
                ) : null}
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-sm font-bold text-[#111318]">
                    Accepted answers (comma-separated, for auto-marking)
                    <input
                      value={q.acceptedAnswersText}
                      onChange={(e) => updateQuestion(q.id, { acceptedAnswersText: e.target.value })}
                      placeholder="e.g. 42, forty-two"
                      className="mt-1.5 min-h-11 w-full rounded-xl border border-black/15 bg-white px-3 text-base"
                    />
                  </label>
                  <label className="block text-sm font-bold text-[#111318]">
                    Model answer / rubric guidance
                    <input
                      value={q.modelAnswer}
                      onChange={(e) => updateQuestion(q.id, { modelAnswer: e.target.value })}
                      className="mt-1.5 min-h-11 w-full rounded-xl border border-black/15 bg-white px-3 text-base"
                    />
                  </label>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setQuestions((prev) => [...prev, emptyQuestion()])}
              className="button-secondary"
            >
              <Plus size={16} aria-hidden="true" />
              Add Question
            </button>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block text-sm font-bold text-[#111318]">
              Submission deadline
              <input
                type="datetime-local"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
                className="mt-1.5 min-h-12 w-full rounded-xl border border-black/15 px-3.5 text-base"
              />
            </label>
            <CustomDropdown
              label="Late submission policy"
              value={latePolicy}
              onChange={(val) => setLatePolicy(val as "BLOCK" | "ALLOW_WITH_FLAG" | "ALLOW_PENALTY")}
              options={[
                { value: "ALLOW_WITH_FLAG", label: "Allow late (flag as late)" },
                { value: "ALLOW_PENALTY", label: "Allow late with penalty" },
                { value: "BLOCK", label: "Block after deadline" },
              ]}
            />
            <CustomDropdown
              label="Submission mode"
              value={submissionMode}
              onChange={(val) => setSubmissionMode(val as "INDIVIDUAL" | "GROUP")}
              options={[
                { value: "INDIVIDUAL", label: "Individual submission" },
                { value: "GROUP", label: "Group project submission" },
              ]}
            />
            <label className="block text-sm font-bold text-[#111318]">
              Maximum attempts
              <input
                type="number"
                min={1}
                max={20}
                value={maxAttempts}
                onChange={(e) => setMaxAttempts(Number(e.target.value))}
                className="mt-1.5 min-h-12 w-full rounded-xl border border-black/15 px-3.5 text-base"
              />
            </label>
            <div className="sm:col-span-2 flex flex-wrap gap-6 pt-2">
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input type="checkbox" checked={allowTextAnswer} onChange={(e) => setAllowTextAnswer(e.target.checked)} />
                Rich-text answers
              </label>
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input type="checkbox" checked={allowFileUpload} onChange={(e) => setAllowFileUpload(e.target.checked)} />
                PDF / DOCX uploads
              </label>
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input type="checkbox" checked={allowPhotoSubmission} onChange={(e) => setAllowPhotoSubmission(e.target.checked)} />
                Camera / handwritten photos
              </label>
            </div>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="grid gap-5 sm:grid-cols-2">
            <CustomDropdown
              label="Marking mode"
              value={markingMode}
              onChange={(val) => setMarkingMode(val as (typeof MARKING_MODES)[number])}
              options={[
                { value: "HYBRID", label: "Hybrid (Auto objective + Lecturer review)" },
                { value: "AUTO_OBJECTIVE", label: "Automatic objective marking" },
                { value: "MANUAL", label: "Manual lecturer marking" },
                { value: "AI_ASSISTED", label: "AI-assisted recommendation + Lecturer approval" },
              ]}
            />
            <div className="flex items-center pt-6">
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input
                  type="checkbox"
                  checked={releaseMarksImmediately}
                  onChange={(e) => setReleaseMarksImmediately(e.target.checked)}
                />
                Release objective marks immediately upon submission
              </label>
            </div>
          </div>
        ) : null}

        {step === 5 ? (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-[#111318]">Review Assignment</h2>
            <dl className="grid gap-3 rounded-2xl bg-[#fffaf7] p-5 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold text-neutral-500">Title</dt>
                <dd className="font-bold text-[#111318]">{title || "Untitled"}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-neutral-500">Category</dt>
                <dd className="font-bold text-[#111318]">{category.replaceAll("_", " ")}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-neutral-500">Questions</dt>
                <dd className="font-bold text-[#111318]">{questions.length} question(s) · {totalMarks} total marks</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-neutral-500">Marking</dt>
                <dd className="font-bold text-[#111318]">{markingMode.replaceAll("_", " ")}</dd>
              </div>
            </dl>
            {mode === "edit" ? (
              <div className="space-y-3 rounded-2xl border border-black/10 bg-white p-4">
                <label className="block text-sm font-bold text-[#111318]">
                  Change summary (optional, recorded in audit history)
                  <input
                    value={changeSummary}
                    onChange={(e) => setChangeSummary(e.target.value)}
                    placeholder="e.g. Extended deadline by 48 hours and clarified Question 2"
                    className="mt-1.5 min-h-11 w-full rounded-xl border border-black/15 px-3.5 text-sm"
                  />
                </label>
                {initialData?.status === "PUBLISHED" ? (
                  <label className="flex items-center gap-2 text-sm font-semibold text-[#111318]">
                    <input
                      type="checkbox"
                      checked={notifyStudents}
                      onChange={(e) => setNotifyStudents(e.target.checked)}
                    />
                    Notify students of material updates (title, instructions, or deadline)
                  </label>
                ) : null}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-3 pt-2">
              {mode === "edit" ? (
                <>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void save(false)}
                    className="button-primary"
                  >
                    <Check size={16} aria-hidden="true" />
                    {busy ? "Saving changes…" : "Save Changes"}
                  </button>
                  {initialData?.status === "DRAFT" ? (
                    <button
                      type="button"
                      disabled={busy || !title.trim()}
                      onClick={() => void save(true)}
                      className="button-secondary"
                    >
                      {busy ? "Publishing…" : "Save & Publish"}
                    </button>
                  ) : null}
                </>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void save(false)}
                    className="button-secondary"
                  >
                    {busy ? "Saving…" : "Save as Draft"}
                  </button>
                  <button
                    type="button"
                    disabled={busy || !title.trim()}
                    onClick={() => void save(true)}
                    className="button-primary"
                  >
                    <Check size={16} aria-hidden="true" />
                    {busy ? "Publishing…" : "Publish Assignment"}
                  </button>
                </>
              )}
            </div>
          </div>
        ) : null}

        <div className="mt-8 flex items-center justify-between border-t border-black/10 pt-5">
          <button
            type="button"
            disabled={step === 1}
            onClick={() => setStep((s) => Math.max(1, s - 1) as 1 | 2 | 3 | 4 | 5)}
            className="button-secondary"
          >
            <ArrowLeft size={16} aria-hidden="true" /> Previous
          </button>
          {step < 5 ? (
            <button
              type="button"
              onClick={() => setStep((s) => Math.min(5, s + 1) as 1 | 2 | 3 | 4 | 5)}
              className="button-primary"
            >
              Next <ArrowRight size={16} aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </div>

      <aside className="panel p-5 space-y-4 lg:sticky lg:top-6" aria-label="Assignment Live Summary">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-extrabold uppercase tracking-wider text-neutral-500">Live Summary</span>
          <span className="rounded-full bg-[#fff0e8] px-2.5 py-0.5 text-[11px] font-bold text-[#d94b14]">
            {mode === "edit" ? initialData?.status ?? "EDIT" : "NEW DRAFT"}
          </span>
        </div>

        <div>
          <h3 className="text-base font-bold text-[#111318] leading-snug">
            {title.trim() || "Untitled Assignment"}
          </h3>
          <p className="mt-1 text-xs font-semibold text-neutral-600">
            {courseMode === "catalog"
              ? (() => {
                  const found = courses.find((c) => c.id === courseId);
                  return found ? `${found.code} — ${found.title}` : "No course selected";
                })()
              : manualCourseName.trim() || manualCourseCode.trim()
                ? `${manualCourseCode.trim() ? `${manualCourseCode.trim()} — ` : ""}${manualCourseName.trim()}`
                : "Manual course not entered yet"}
          </p>
        </div>

        <dl className="space-y-2.5 border-t border-black/10 pt-3 text-xs">
          <div className="flex items-center justify-between">
            <dt className="text-neutral-500">Category</dt>
            <dd className="font-bold text-[#111318]">{category.replaceAll("_", " ")}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-neutral-500">Questions</dt>
            <dd className="font-bold text-[#111318]">{questions.filter((q) => q.prompt.trim()).length} active</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-neutral-500">Total Marks</dt>
            <dd className="font-bold text-[#111318]">{totalMarks}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-neutral-500">Marking</dt>
            <dd className="font-bold text-[#111318]">{markingMode.replaceAll("_", " ")}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-neutral-500">Deadline</dt>
            <dd className="font-bold text-[#111318]">
              {dueAt ? new Date(dueAt).toLocaleDateString() : "No deadline"}
            </dd>
          </div>
        </dl>

        <div className="space-y-2 border-t border-black/10 pt-4">
          {mode === "edit" ? (
            <button type="button" disabled={busy} onClick={() => void save(false)} className="button-primary w-full justify-center">
              <Check size={16} aria-hidden="true" />
              {busy ? "Saving…" : "Save Changes"}
            </button>
          ) : (
            <>
              <button
                type="button"
                disabled={busy || !title.trim()}
                onClick={() => void save(true)}
                className="button-primary w-full justify-center"
              >
                <Check size={16} aria-hidden="true" />
                {busy ? "Publishing…" : "Publish Assignment"}
              </button>
              <button type="button" disabled={busy} onClick={() => void save(false)} className="button-secondary w-full justify-center">
                {busy ? "Saving…" : "Save as Draft"}
              </button>
            </>
          )}
        </div>
      </aside>
      </div>
    </div>
  );
}
