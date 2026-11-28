import { describe, expect, it } from "vitest";
import {
  buildQuestionAnswers,
  buildStudentIdentityMap,
  formatAnswerValue,
  submissionStudentName,
  type ReviewQuestion,
} from "@/lib/academic/submission-review";

const QUESTIONS: ReviewQuestion[] = [
  { id: "q2", position: 2, prompt: "Give one everyday example.", marks: 4 },
  { id: "q1", position: 1, prompt: "What is thermodynamics?", marks: 10 },
  { id: "q3", position: 3, prompt: "Unanswered question.", marks: 6 },
];

describe("buildQuestionAnswers", () => {
  it("joins stored answers to their questions in position order", () => {
    const result = buildQuestionAnswers(QUESTIONS, {
      q1: "The study of heat and energy.",
      q2: "A pressure cooker cooking faster under steam pressure.",
    });
    expect(result).toEqual([
      { questionPrompt: "What is thermodynamics?", marks: 10, answer: "The study of heat and energy." },
      {
        questionPrompt: "Give one everyday example.",
        marks: 4,
        answer: "A pressure cooker cooking faster under steam pressure.",
      },
    ]);
  });

  it("skips questions with no answer entry and ignores answers for unknown questions", () => {
    const result = buildQuestionAnswers(QUESTIONS, {
      q1: "Only answer.",
      "deleted-question": "Orphaned answer.",
    });
    expect(result).toEqual([
      { questionPrompt: "What is thermodynamics?", marks: 10, answer: "Only answer." },
    ]);
  });

  it("stringifies non-string answers (arrays, objects, numbers, booleans)", () => {
    const result = buildQuestionAnswers(QUESTIONS, {
      q1: ["option-a", "option-c"],
      q2: { choice: "B" },
      q3: 42,
    });
    expect(result).toEqual([
      { questionPrompt: "What is thermodynamics?", marks: 10, answer: '["option-a","option-c"]' },
      { questionPrompt: "Give one everyday example.", marks: 4, answer: '{"choice":"B"}' },
      { questionPrompt: "Unanswered question.", marks: 6, answer: "42" },
    ]);
  });

  it("returns an empty list for null, empty, or malformed answers_json", () => {
    expect(buildQuestionAnswers(QUESTIONS, null)).toEqual([]);
    expect(buildQuestionAnswers(QUESTIONS, undefined)).toEqual([]);
    expect(buildQuestionAnswers(QUESTIONS, {})).toEqual([]);
    expect(buildQuestionAnswers(QUESTIONS, "not json")).toEqual([]);
    expect(buildQuestionAnswers(QUESTIONS, { q1: "   " })).toEqual([]);
  });

  it("accepts a JSON-string answers_json payload", () => {
    expect(buildQuestionAnswers(QUESTIONS, JSON.stringify({ q2: "Kettle boiling." }))).toEqual([
      { questionPrompt: "Give one everyday example.", marks: 4, answer: "Kettle boiling." },
    ]);
  });
});

describe("formatAnswerValue", () => {
  it("passes strings through and formats scalars and structures", () => {
    expect(formatAnswerValue("plain")).toBe("plain");
    expect(formatAnswerValue(3.5)).toBe("3.5");
    expect(formatAnswerValue(true)).toBe("true");
    expect(formatAnswerValue(null)).toBe("");
    expect(formatAnswerValue(["a", 1])).toBe('["a",1]');
  });
});

describe("buildStudentIdentityMap + submissionStudentName", () => {
  it("maps people names and profile matrics by student id", () => {
    const map = buildStudentIdentityMap(
      [{ id: "stu-1", full_name: "Akinyele Dominion" }],
      [{ id: "stu-1", matric_number: "EES/23/24/0191" }],
    );
    expect(map.get("stu-1")).toEqual({ fullName: "Akinyele Dominion", matricNumber: "EES/23/24/0191" });
    expect(submissionStudentName("stu-1", map.get("stu-1"))).toBe("Akinyele Dominion");
  });

  it("never fabricates a matric from the student id", () => {
    const map = buildStudentIdentityMap([{ id: "stu-2", full_name: "No Profile" }], []);
    expect(map.get("stu-2")).toEqual({ fullName: "No Profile", matricNumber: "" });
  });

  it("falls back to a truncated-id label only when no people row exists", () => {
    expect(submissionStudentName("15368cc7-b6d4-4e4b", undefined)).toBe("Student 15368c");
    const map = buildStudentIdentityMap([], [{ id: "stu-3", matric_number: "EES/23/24/2026" }]);
    expect(map.get("stu-3")).toEqual({ fullName: null, matricNumber: "EES/23/24/2026" });
    expect(submissionStudentName("stu-3", map.get("stu-3"))).toBe("Student stu-3");
  });
});
