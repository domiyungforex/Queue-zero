import { describe, expect, it } from "vitest";
import { attendancePhotoSrc } from "@/lib/school/photo-src";

describe("attendance photo sources", () => {
  it("rejects private storage paths that crash the attendance page", () => {
    expect(attendancePhotoSrc("org/class/selfie.jpg")).toBeNull();
    expect(attendancePhotoSrc("attendance-photos/org/file.jpg")).toBeNull();
  });

  it("allows only absolute http URLs and same-site paths", () => {
    expect(attendancePhotoSrc("https://cdn.example/photo.jpg")).toBe("https://cdn.example/photo.jpg");
    expect(attendancePhotoSrc("/photos/selfie.jpg")).toBe("/photos/selfie.jpg");
    expect(attendancePhotoSrc("javascript:alert(1)")).toBeNull();
    expect(attendancePhotoSrc(null)).toBeNull();
  });
});
