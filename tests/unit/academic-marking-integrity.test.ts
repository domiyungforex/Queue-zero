import { describe, expect, it } from "vitest";
import { gradeObjectiveSubmission } from "@/lib/academic/marking";
import { analyzeSubmissionSimilarity, assessAiWritingRisk } from "@/lib/academic/integrity";

describe("Academic objective & mathematical marking engine", () => {
  it("grades MCQ, case-insensitive short answers, numeric tolerances, and partial credit", () => {
    const result = gradeObjectiveSubmission(
      [
        {
          questionId: "q1",
          questionType: "MCQ",
          marks: 5,
          negativeMarks: 0,
          partialCredit: false,
          acceptedAnswers: ["Merge Sort"],
        },
        {
          questionId: "q2",
          questionType: "MATH",
          marks: 10,
          negativeMarks: 0,
          partialCredit: true,
          acceptedAnswers: ["9.81"],
          expectedUnit: "m/s2",
          numericTolerance: 0.05,
        },
        {
          questionId: "q3",
          questionType: "SHORT_ANSWER",
          marks: 5,
          negativeMarks: 1,
          partialCredit: false,
          acceptedAnswers: ["O(n log n)"],
          caseSensitive: false,
        },
      ],
      {
        q1: "merge sort",
        q2: "9.80 m/s2",
        q3: "O(n^2)",
      },
    );

    expect(result.hasSubjective).toBe(false);
    expect(result.results[0].awardedMarks).toBe(5);
    expect(result.results[1].awardedMarks).toBe(10);
    expect(result.results[2].awardedMarks).toBe(-1);
    expect(result.totalAutoScore).toBe(14);
  });
});

describe("Academic integrity & AI-writing risk engine", () => {
  it("flags high n-gram overlap between two student submissions with evidence", () => {
    const sharedText =
      "Dynamic programming solves complex problems by breaking them down into simpler overlapping subproblems and storing their results in memory to avoid redundant computation.";
    const pairs = analyzeSubmissionSimilarity(
      [
        {
          submissionId: "sub-a",
          studentName: "Student A",
          matricNumber: "CSC/01",
          text: sharedText,
          submittedAt: "2026-11-26T10:00:00Z",
        },
        {
          submissionId: "sub-b",
          studentName: "Student B",
          matricNumber: "CSC/02",
          text: sharedText,
          submittedAt: "2026-11-26T10:05:00Z",
        },
      ],
      25,
    );

    expect(pairs.length).toBe(1);
    expect(pairs[0].similarityScore).toBe(100);
    expect(pairs[0].matchingPassages.length).toBeGreaterThan(0);
  });

  it("marks short responses as INCONCLUSIVE and includes limitations notice", () => {
    const risk = assessAiWritingRisk("sub-short", "Binary search takes O(log n) time.");
    expect(risk.riskCategory).toBe("INCONCLUSIVE");
    expect(risk.limitationsNote).toContain("never conclusive proof");
  });
});
