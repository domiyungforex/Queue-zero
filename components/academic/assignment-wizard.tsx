"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Plus, X } from "lucide-react";
import { CustomDropdown } from "@/components/ui/custom-dropdown";
import { createAssignmentAction } from "@/lib/academic/actions";
import { ASSIGNMENT_CATEGORIES, MARKING_MODES, QUESTION_TYPES, type QuestionType } from "@/lib/academic/types";

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

export function AssignmentWizard({ courses }: { courses: Array<{ id: string; code: string; title: string }> }) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Step 1: Basic Info
  const [title, setTitle] = useState("");
  const [courseId, setCourseId] = useState(courses[0]?.id ?? "");
  const [category, setCategory] = useState<(typeof ASSIGNMENT_CATEGORIES)[number]>("HOMEWORK");
  const [academicSession, setAcademicSession] = useState("2025/2026");
  const [semester, setSemester] = useState("First");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [learningObjectives, setLearningObjectives] = useState("");

  // Step 2: Questions
  const [questions, setQuestions] = useState<QuestionDraft[]>([emptyQuestion()]);

  // Step 3: Submission Config
  const [dueAt, setDueAt] = useState("");
  const [latePolicy, setLatePolicy] = useState<"BLOCK" | "ALLOW_WITH_FLAG" | "ALLOW_PENALTY">("ALLOW_WITH_FLAG");
  const [submissionMode, setSubmissionMode] = useState<"INDIVIDUAL" | "GROUP">("INDIVIDUAL");
  const [allowTextAnswer, setAllowTextAnswer] = useState(true);
  const [allowFileUpload, setAllowFileUpload] = useState(true);
  const [allowPhotoSubmission, setAllowPhotoSubmission] = useState(true);
  const [maxAttempts, setMaxAttempts] = useState(1);

  // Step 4: Marking Config
  const [markingMode, setMarkingMode] = useState<(typeof MARKING_MODES)[number]>("HYBRID");
  const [releaseMarksImmediately, setReleaseMarksImmediately] = useState(false);

  const totalMarks = questions.reduce((sum, q) => sum + Number(q.marks || 0), 0) || 100;

  function updateQuestion(id: string, patch: Partial<QuestionDraft>) {
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  }

  async function save(publishNow: boolean) {
    setBusy(true);
    setError("");
    try {
      const payload = {
        title,
        courseId,
        category,
        academicSession,
        semester,
        description,
        instructions,
        learningObjectives,
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
        questions: questions.map((q) => ({
          questionType: q.questionType,
          prompt: q.prompt,
          description: q.description,
          formulaLatex: q.formulaLatex,
          options: q.optionsText
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean),
          acceptedAnswers: q.acceptedAnswersText
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          modelAnswer: q.modelAnswer,
          expectedUnit: q.expectedUnit,
          numericTolerance: Number(q.numericTolerance || 0),
          marks: Number(q.marks || 0),
          negativeMarks: Number(q.negativeMarks || 0),
          partialCredit: q.partialCredit,
          caseSensitive: q.caseSensitive,
        })),
      };

      const res = await createAssignmentAction(payload);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push(`/dashboard/academic/assignments/${res.assignmentId}`);
    } catch {
      setError("Could not save assignment. Check your inputs and try again.");
    } finally {
      setBusy(false);
    }
  }

  const steps = ["Basic Info", "Questions", "Submission", "Marking", "Review & Publish"];

  return (
    <div className="space-y-6">
      <div className="panel flex flex-wrap items-center gap-2 p-4" aria-label="Wizard steps">
        {steps.map((label, idx) => {
          const num = (idx + 1) as 1 | 2 | 3 | 4 | 5;
          const active = step === num;
          return (
            <button
              key={label}
              type="button"
              onClick={() => setStep(num)}
              className={`min-h-10 rounded-xl px-3.5 text-xs font-bold transition ${
                active ? "bg-[#ff6b2b] text-white" : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
              }`}
            >
              {num}. {label}
            </button>
          );
        })}
      </div>

      {error ? (
        <p className="notice warning" role="alert">
          {error}
        </p>
      ) : null}

      <div className="panel p-6">
        {step === 1 ? (
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-sm font-bold text-[#111318]">
                Assignment title
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Week 4 Algorithms Problem Set"
                  className="mt-1.5 min-h-12 w-full rounded-xl border border-black/15 px-3.5 text-base"
                />
              </label>
            </div>
            <CustomDropdown
              name="courseId"
              label="Course"
              value={courseId}
              onChange={setCourseId}
              options={courses.map((c) => ({ value: c.id, label: `${c.code} — ${c.title}` }))}
            />
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
            <div className="flex flex-wrap gap-3 pt-2">
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
                disabled={busy || !title.trim() || !courseId}
                onClick={() => void save(true)}
                className="button-primary"
              >
                <Check size={16} aria-hidden="true" />
                {busy ? "Publishing…" : "Publish Assignment"}
              </button>
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
    </div>
  );
}
