import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const createMock = vi.fn();

vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: class MockAnthropic {
      messages = {
        create: createMock,
      };
    },
  };
});

import {
  DEFAULT_ANTHROPIC_MODEL,
  getAiProviderStatus,
  getAnthropicModel,
  getPrimaryAiProvider,
  isAnthropicConfigured,
} from "@/lib/ai/provider";
import {
  evaluateSubjectiveAnswerWithClaude,
  extractAssignmentFromDocumentWithClaude,
  extractAssignmentFromTextWithClaude,
  generateQuestionsWithClaude,
} from "@/lib/ai/anthropic";
import { runSmartAssignmentExtraction } from "@/lib/ai/service";

describe("Anthropic Claude primary AI provider", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_MODEL;
    delete process.env.AI_PRIMARY_PROVIDER;
    delete process.env.MISTRAL_API_KEY;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("defaults to anthropic as primary provider and handles missing credentials safely", async () => {
    expect(getPrimaryAiProvider()).toBe("anthropic");
    expect(getAnthropicModel()).toBe(DEFAULT_ANTHROPIC_MODEL);
    expect(isAnthropicConfigured()).toBe(false);
    expect(getAiProviderStatus().activeProvider).toBeNull();

    const res = await extractAssignmentFromTextWithClaude({
      text: "1. Explain recursion.",
      authorizedCourses: [],
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toContain("TuRnMaRk AI is not configured");
    }
  });

  it("extracts multi-question assignment without inventing missing deadline or course", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test-key";
    createMock.mockResolvedValueOnce({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            title: "General Ethics Problem Set",
            courseCode: null,
            courseName: null,
            category: "HOMEWORK",
            instructions: "Answer all questions clearly.",
            learningObjectives: "",
            dueAt: null,
            totalMarks: 25,
            submissionRequirements: "PDF or typed",
            questions: [
              { questionType: "SHORT_ANSWER", prompt: "Define academic integrity.", options: [], marks: 10, formulaLatex: "", modelAnswer: "", uncertain: false },
              { questionType: "MATH", prompt: "Compute time complexity of heapify.", options: [], marks: 15, formulaLatex: "O(n)", modelAnswer: "", uncertain: false },
            ],
          }),
        },
      ],
      usage: { input_tokens: 120, output_tokens: 80 },
    });

    const res = await extractAssignmentFromTextWithClaude({
      text: "General Ethics Problem Set\n1. Define academic integrity [10]\n2. Compute time complexity of heapify [15]",
      authorizedCourses: [{ id: "11111111-1111-4111-8111-111111111111", code: "CSC 201", title: "Data Structures" }],
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.extraction.title).toBe("General Ethics Problem Set");
      expect(res.extraction.dueAt).toBeNull();
      expect(res.extraction.matchedCourseId).toBeNull();
      expect(res.extraction.questions).toHaveLength(2);
      expect(res.usage.inputTokens).toBe(120);
    }
  });

  it("supports PDF and image document extraction via Claude native blocks", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test-key";
    createMock.mockResolvedValue({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            title: "Physics Lab 2",
            courseCode: "PHY 201",
            courseName: "Optics",
            category: "LAB_REPORT",
            instructions: "Show all derivations.",
            dueAt: null,
            questions: [{ questionType: "LONG_ANSWER", prompt: "Derive Snell's law.", marks: 20 }],
          }),
        },
      ],
      usage: { input_tokens: 300, output_tokens: 90 },
    });

    const pdfRes = await extractAssignmentFromDocumentWithClaude({
      buffer: Buffer.from("%PDF-1.4 sample"),
      mimeType: "application/pdf",
      authorizedCourses: [{ id: "11111111-1111-4111-8111-111111111111", code: "PHY 201", title: "Optics" }],
    });
    expect(pdfRes.ok).toBe(true);

    const imgRes = await extractAssignmentFromDocumentWithClaude({
      buffer: Buffer.from([0xff, 0xd8, 0xff]),
      mimeType: "image/jpeg",
      authorizedCourses: [],
    });
    expect(imgRes.ok).toBe(true);
  });

  it("evaluates subjective answers against rubric with bounded marks and lecturer review flag", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test-key";
    createMock.mockResolvedValueOnce({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            suggestedMarks: 99,
            confidence: "MEDIUM",
            explanation: "Covers core concept but misses edge cases.",
            criteriaSatisfied: ["Explained base case"],
            criteriaMissing: ["Stack overflow discussion"],
            requiresLecturerReview: true,
          }),
        },
      ],
      usage: { input_tokens: 90, output_tokens: 45 },
    });

    const mark = await evaluateSubjectiveAnswerWithClaude({
      questionPrompt: "Explain recursion.",
      maxMarks: 10,
      modelAnswer: "Base case + recursive step.",
      rubricCriteria: ["Base case", "Recursive step", "Termination"],
      studentResponse: "A function that calls itself with a base case.",
    });

    expect(mark.ok).toBe(true);
    if (mark.ok) {
      expect(mark.suggestedMarks).toBe(10); // Bounded to maxMarks
      expect(mark.requiresLecturerReview).toBe(true);
    }
  });

  it("generates questions with separated answer keys and marking guides", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test-key";
    createMock.mockResolvedValueOnce({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            questions: [
              {
                questionType: "MCQ",
                prompt: "What is the SI unit of force?",
                options: ["Newton", "Joule", "Watt"],
                marks: 5,
                formulaLatex: "",
                acceptedAnswers: ["Newton"],
                modelAnswer: "Newton",
                markingGuide: "Award 5 marks for Newton.",
              },
            ],
          }),
        },
      ],
      usage: { input_tokens: 80, output_tokens: 60 },
    });

    const gen = await generateQuestionsWithClaude({
      topic: "Newtonian Mechanics",
      courseCode: "PHY 101",
      difficulty: "EASY",
      count: 1,
      questionTypes: ["MCQ"],
    });
    expect(gen.ok).toBe(true);
    if (gen.ok) {
      expect(gen.questions[0]?.acceptedAnswers).toEqual(["Newton"]);
    }
  });

  it("handles 401 auth error without crashing and prevents duplicate extraction calls via idempotency cache", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-invalid";
    createMock.mockRejectedValueOnce({ status: 401 });

    const authFail = await extractAssignmentFromTextWithClaude({
      text: "Sample question",
      authorizedCourses: [],
    });
    expect(authFail.ok).toBe(false);
    if (!authFail.ok) {
      expect(authFail.error).toContain("TuRnMaRk AI is temporarily unavailable");
    }

    createMock.mockResolvedValueOnce({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            title: "Cached Assignment",
            questions: [{ questionType: "SHORT_ANSWER", prompt: "Q1", marks: 10 }],
          }),
        },
      ],
      usage: { input_tokens: 50, output_tokens: 30 },
    });

    const first = await runSmartAssignmentExtraction({
      organizationId: "org-1",
      authorizedCourses: [],
      contentHash: "hash-abc-123",
      extractedText: "Cached Assignment\n1. Q1",
    });
    const second = await runSmartAssignmentExtraction({
      organizationId: "org-1",
      authorizedCourses: [],
      contentHash: "hash-abc-123",
      extractedText: "Cached Assignment\n1. Q1",
    });

    expect(first.providerUsed).toBe("anthropic");
    expect(second.deduplicated).toBe(true);
    expect(createMock).toHaveBeenCalledTimes(2); // 1 for authFail + 1 for first, 0 for deduplicated second
  });

  it("preserves valid questions when other questions are malformed or fields are null", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test-key";
    createMock.mockResolvedValueOnce({
      content: [
        {
          type: "text",
          text: `Here is the extracted assignment:\n\`\`\`json
          {
            "title": "CSC 301 Quiz",
            "courseCode": "CSC 301",
            "courseName": null,
            "category": "QUIZ",
            "instructions": null,
            "learningObjectives": null,
            "dueAt": null,
            "totalMarks": null,
            "questions": [
              { "questionType": "MULTIPLE_CHOICE", "prompt": "What is a stack?", "options": ["LIFO", "FIFO"], "marks": 5, "formulaLatex": null, "uncertain": false },
              { "questionType": "SHORT_ANSWER", "prompt": "", "options": null, "marks": 5 },
              { "questionType": "CALCULATION", "prompt": "Compute 2^10.", "options": null, "marks": "10", "formulaLatex": "2^{10}" }
            ]
          }
          \`\`\``,
        },
      ],
      usage: { input_tokens: 100, output_tokens: 90 },
    });

    const res = await extractAssignmentFromTextWithClaude({
      text: "CSC 301 Quiz",
      authorizedCourses: [],
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.extraction.questions).toHaveLength(2);
      expect(res.extraction.questions[0]?.questionType).toBe("MCQ");
      expect(res.extraction.questions[1]?.questionType).toBe("MATH");
      expect(res.extraction.warnings.length).toBeGreaterThan(0);
    }
  });
});
