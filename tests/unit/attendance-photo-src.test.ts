import { describe, expect, it } from "vitest";
import { attendancePhotoSrc, displayAttendancePhoto, privatePhotoObjectPath } from "@/lib/school/photo-src";

const recordId = "11111111-1111-4111-8111-111111111111";

describe("attendance photo sources", () => {
  it("rejects private storage paths that crash the attendance page", () => {
    expect(attendancePhotoSrc("org/class/selfie.jpg")).toBeNull();
    expect(attendancePhotoSrc("attendance-photos/org/file.jpg")).toBeNull();
    expect(attendancePhotoSrc("data:image/jpeg;base64,aaaa")).toBeNull();
  });

  it("allows only absolute http URLs and same-site paths", () => {
    expect(attendancePhotoSrc("https://cdn.example/photo.jpg")).toBe("https://cdn.example/photo.jpg");
    expect(attendancePhotoSrc("/photos/selfie.jpg")).toBe("/photos/selfie.jpg");
    expect(attendancePhotoSrc("javascript:alert(1)")).toBeNull();
    expect(attendancePhotoSrc(null)).toBeNull();
  });

  it("shows a stored selfie through the staff photo route", () => {
    expect(displayAttendancePhoto(recordId, "attendance/org/class/selfie.jpg")).toBe(`/api/school/attendance-photos/${recordId}`);
    expect(displayAttendancePhoto(recordId, "data:image/jpeg;base64,aaaa")).toBe(`/api/school/attendance-photos/${recordId}`);
    expect(displayAttendancePhoto(recordId, null)).toBeNull();
    expect(displayAttendancePhoto("not-an-id", "attendance/file.jpg")).toBeNull();
  });

  it("reads the object key from a path or an expired signed URL", () => {
    expect(privatePhotoObjectPath("attendance/org/class/selfie.jpg")).toBe("attendance/org/class/selfie.jpg");
    expect(privatePhotoObjectPath("https://demo.supabase.co/storage/v1/object/sign/attendance-photos/attendance/org/class/selfie.jpg?token=abc")).toBe("attendance/org/class/selfie.jpg");
    expect(privatePhotoObjectPath("../secret.jpg")).toBeNull();
    expect(privatePhotoObjectPath("https://evil.example/attendance-photos/secret.jpg")).toBe("secret.jpg");
  });
});
