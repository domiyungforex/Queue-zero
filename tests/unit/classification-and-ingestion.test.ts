import { describe, expect, it } from "vitest";
import { matchDepartment, matchFaculty } from "@/lib/school/classification";
import { parseAssignmentFromText } from "@/lib/academic/ingestion";

describe("Student Faculty & Department Classification", () => {
  const faculties = [
    { id: "fac-sci", name: "Faculty of Science" },
    { id: "fac-eng", name: "Faculty of Engineering" },
  ];
  const departments = [
    { id: "dep-csc", faculty_id: "fac-sci", name: "Computer Science" },
    { id: "dep-mth", faculty_id: "fac-sci", name: "Mathematics" },
    { id: "dep-eee", faculty_id: "fac-eng", name: "Electrical Engineering" },
  ];

  it("matches faculty variations like 'Science Faculty' and 'SCIENCE'", () => {
    expect(matchFaculty("Faculty of Science", faculties).matched?.id).toBe("fac-sci");
    expect(matchFaculty("Science Faculty", faculties).matched?.id).toBe("fac-sci");
    expect(matchFaculty("SCIENCE", faculties).matched?.id).toBe("fac-sci");
  });

  it("matches department aliases within the selected faculty and blocks cross-faculty matches", () => {
    expect(matchDepartment("CSC", "fac-sci", departments).matched?.id).toBe("dep-csc");
    // Electrical Engineering belongs to fac-eng, so searching under fac-sci must NOT match
    expect(matchDepartment("Electrical Engineering", "fac-sci", departments).status).toBe("UNMATCHED");
    expect(matchDepartment("Unknown Quantum Dept", "fac-sci", departments).status).toBe("UNMATCHED");
  });
});

describe("Smart Assignment Extraction & Autofill", () => {
  const courses = [
    { id: "c1", code: "CSC 301", title: "Algorithms and Complexity" },
    { id: "c2", code: "MTH 201", title: "Linear Algebra" },
  ];

  it("extracts title, matched authorized course, MCQs, math questions, and marks without inventing deadlines", () => {
    const raw = `
CSC 301 Homework 2: Sorting & Equations
1. Which sorting algorithm has O(n log n) average time? [5 marks]
A. Bubble Sort
B. Merge Sort
C. Insertion Sort
2. Calculate the determinant of A = [[2, 1], [3, 4]] [10 marks]
    `.trim();

    const result = parseAssignmentFromText(raw, courses);
    expect(result.matchedCourseId).toBe("c1");
    expect(result.matchedCourseCode).toBe("CSC 301");
    expect(result.questions.length).toBe(2);
    expect(result.questions[0].questionType).toBe("MCQ");
    expect(result.questions[0].options).toEqual(["Bubble Sort", "Merge Sort", "Insertion Sort"]);
    expect(result.questions[0].marks).toBe(5);
    expect(result.questions[1].questionType).toBe("MATH");
    expect(result.questions[1].marks).toBe(10);
    expect(result.totalMarks).toBe(15);
    expect(result.dueAt).toBeNull();
    expect(result.missingFields.some((f) => f.toLowerCase().includes("deadline"))).toBe(true);
  });
});
