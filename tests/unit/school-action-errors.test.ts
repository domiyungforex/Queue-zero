import { describe, expect, it } from "vitest";
import { schoolActionErrorMessage } from "@/lib/school/action-errors";

describe("school attendance error mapping", () => {
  it.each([
    [{ code: "22023", message: "Attendance is closed" }, "This attendance session has ended."],
    [{ code: "22023", message: "Class cannot finish before its scheduled start" }, "This class cannot be finished before its scheduled start."],
    [{ code: "23505", message: "duplicate key value violates unique constraint secret" }, "Attendance has already been recorded."],
    [{ code: "42501", message: "private policy detail" }, "You don’t have permission to update this class."],
    [{ code: "PGRST000", message: "provider detail" }, "We couldn’t connect. Try again."],
  ])("maps %# to customer-safe copy", (error, message) => {
    expect(schoolActionErrorMessage(error)).toBe(message);
  });
});
