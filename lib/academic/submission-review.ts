/**
 * Pure helpers for the staff submission reviewer: join a submission's stored
 * answers to the assignment's questions, and resolve real student identities
 * for display. Kept free of I/O so the mapping is unit-testable.
 */

export interface ReviewQuestion {
  id: string;
  position: number;
  prompt: string;
  marks: number;
}

export interface QuestionAnswer {
  questionPrompt: string;
  marks: number;
  answer: string;
}

/** Render one stored answer value as display text. */
export function formatAnswerValue(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

/**
 * Build the ordered per-question answer list for one submission.
 * `answersJson` is the submission's `answers_json` value: an object mapping
 * question id -> answer (usually a string). Questions with no stored answer
 * are skipped; answers stored for questions that no longer exist are ignored.
 */
export function buildQuestionAnswers(
  questions: ReviewQuestion[],
  answersJson: unknown,
): QuestionAnswer[] {
  let answers: Record<string, unknown> = {};
  if (answersJson && typeof answersJson === "object" && !Array.isArray(answersJson)) {
    answers = answersJson as Record<string, unknown>;
  } else if (typeof answersJson === "string") {
    try {
      const parsed: unknown = JSON.parse(answersJson);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        answers = parsed as Record<string, unknown>;
      }
    } catch {
      answers = {};
    }
  }

  return [...questions]
    .sort((a, b) => a.position - b.position)
    .flatMap((q) => {
      if (!Object.prototype.hasOwnProperty.call(answers, q.id)) return [];
      const answer = formatAnswerValue(answers[q.id]).trim();
      if (!answer) return [];
      return [{ questionPrompt: q.prompt, marks: q.marks, answer }];
    });
}

export interface StudentIdentity {
  fullName: string | null;
  matricNumber: string;
}

/**
 * Map student id -> display identity from `people` and `school_profiles`
 * rows. A student with no profile row gets an empty matric — never invent
 * one from the id.
 */
export function buildStudentIdentityMap(
  peopleRows: Array<{ id: string; full_name: unknown }>,
  profileRows: Array<{ id: string; matric_number: unknown }>,
): Map<string, StudentIdentity> {
  const profiles = new Map<string, string>();
  for (const row of profileRows) {
    profiles.set(row.id, row.matric_number ? String(row.matric_number) : "");
  }
  const map = new Map<string, StudentIdentity>();
  for (const row of peopleRows) {
    map.set(row.id, {
      fullName: row.full_name ? String(row.full_name) : null,
      matricNumber: profiles.get(row.id) ?? "",
    });
  }
  for (const [id, matricNumber] of profiles) {
    if (!map.has(id)) map.set(id, { fullName: null, matricNumber });
  }
  return map;
}

/** Display name for a submission: the person's real name when known. */
export function submissionStudentName(
  studentId: string,
  identity: StudentIdentity | undefined,
): string {
  return identity?.fullName ?? `Student ${studentId.slice(0, 6)}`;
}
