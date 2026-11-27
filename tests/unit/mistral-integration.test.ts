import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import {
  extractAssignmentWithMistralSmall,
  isMistralConfigured,
  runMistralOcr,
} from "@/lib/ai/mistral";

describe("Mistral AI OCR & Assignment Extraction", () => {
  const originalKey = process.env.MISTRAL_API_KEY;

  afterEach(() => {
    if (originalKey === undefined) delete process.env.MISTRAL_API_KEY;
    else process.env.MISTRAL_API_KEY = originalKey;
    vi.restoreAllMocks();
  });

  it("detects missing MISTRAL_API_KEY safely without crashing", async () => {
    delete process.env.MISTRAL_API_KEY;
    expect(isMistralConfigured()).toBe(false);

    const res = await runMistralOcr({
      buffer: Buffer.from("fake-image"),
      mimeType: "image/jpeg",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toContain("MISTRAL_API_KEY");
    }
  });

  it("processes OCR with mistral-ocr-latest and structures questions with mistral-small-latest", async () => {
    process.env.MISTRAL_API_KEY = "test-mistral-key";
    expect(isMistralConfigured()).toBe(true);

    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          pages: [{ index: 0, markdown: "CSC 301 Quiz\n1. What is Big-O of Binary Search? [5 marks]" }],
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  title: "CSC 301 Quiz",
                  courseCode: "CSC 301",
                  category: "CLASSWORK",
                  instructions: "Answer all questions.",
                  learningObjectives: "",
                  dueAt: null,
                  questions: [
                    {
                      questionType: "SHORT_ANSWER",
                      prompt: "What is Big-O of Binary Search?",
                      options: [],
                      marks: 5,
                      formulaLatex: "",
                      uncertain: false,
                    },
                  ],
                }),
              },
            },
          ],
        }),
      } as Response);

    const ocr = await runMistralOcr({
      buffer: Buffer.from("pdf-bytes"),
      mimeType: "application/pdf",
    });
    expect(ocr.ok).toBe(true);
    if (ocr.ok) {
      const structured = await extractAssignmentWithMistralSmall({
        text: ocr.text,
        authorizedCourses: [{ id: "c1", code: "CSC 301", title: "Algorithms" }],
      });
      expect(structured.ok).toBe(true);
      if (structured.ok) {
        expect(structured.extraction.matchedCourseId).toBe("c1");
        expect(structured.extraction.dueAt).toBeNull();
        expect(structured.extraction.questions[0].marks).toBe(5);
      }
    }
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns a safe auth error on 401 without leaking the API key", async () => {
    process.env.MISTRAL_API_KEY = "mstrl_secret_should_never_leak";
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 401,
    } as Response);

    const res = await runMistralOcr({
      buffer: Buffer.from("img"),
      mimeType: "image/png",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toContain("authentication failed");
      expect(res.error).not.toContain("mstrl_secret_should_never_leak");
    }
  });
});
