import { describe, expect, it } from "vitest";
import { decodeAttendancePhoto, clientPhotoQuality } from "@/lib/school/photo-quality";
import { issueIdentityTicket, readIdentityTicket } from "@/lib/school/identity-ticket";

const secret = "test-secret-that-is-long-enough-for-hmac";
const org = "11111111-1111-4111-8111-111111111111";
const student = "22222222-2222-4222-8222-222222222222";
const klass = "33333333-3333-4333-8333-333333333333";

describe("student registration safeguards", () => {
  it("rejects photographs that are too small or the wrong type", () => {
    expect(decodeAttendancePhoto("data:text/plain;base64,aGVsbG8=").ok).toBe(false);
    expect(decodeAttendancePhoto(`data:image/jpeg;base64,${Buffer.from("tiny").toString("base64")}`).ok).toBe(false);
    const jpeg = Buffer.alloc(13_000);
    jpeg[0] = 0xff; jpeg[1] = 0xd8; jpeg[2] = 0xff;
    expect(decodeAttendancePhoto(`data:image/jpeg;base64,${Buffer.alloc(13_000, 7).toString("base64")}`).ok).toBe(false);
    const photo = decodeAttendancePhoto(`data:image/jpeg;base64,${jpeg.toString("base64")}`);
    expect(photo.ok).toBe(true);
  });

  it("asks for a retake when the frame is too small or blank", () => {
    expect(clientPhotoQuality(200, 400, 40)).toMatch(/closer/);
    expect(clientPhotoQuality(400, 400, 2)).toMatch(/blank|dark/);
    expect(clientPhotoQuality(480, 480, 40)).toBeNull();
  });

  it("keeps the student id inside a short-lived ticket and rejects another session", () => {
    const ticket = issueIdentityTicket({ org, student, classes: [klass] }, secret, 1_000);
    const decoded = readIdentityTicket(ticket, secret, 2_000);
    expect(decoded.student).toBe(student);
    expect(decoded.classes).toEqual([klass]);
    expect(() => readIdentityTicket(ticket, secret, 1_000 + 11 * 60 * 1000)).toThrow(/timed out/);
  });
});
