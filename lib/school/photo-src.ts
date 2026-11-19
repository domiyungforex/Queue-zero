/** Attendance photos are private. next/image throws unless the value is a real URL. */
const RECORD_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function attendancePhotoSrc(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\")) return value;
  try {
    const url = new URL(value);
    if (url.protocol === "https:" || url.protocol === "http:") return url.href;
  } catch {
    return null;
  }
  return null;
}

/** Lecturer pages must not receive the stored bytes, a storage path, or a signed URL. */
export function displayAttendancePhoto(recordId: string, stored: string | null | undefined): string | null {
  if (!stored || !RECORD_ID.test(recordId)) return null;
  return `/api/school/attendance-photos/${recordId}`;
}

/** Object key inside the private attendance-photos bucket. Rejects anything else. */
export function privatePhotoObjectPath(value: string): string | null {
  const fromText = (raw: string) => {
    const path = raw.replace(/^attendance-photos\//, "");
    if (!path || path.includes("..") || path.startsWith("/") || !/^[A-Za-z0-9/_.-]+$/.test(path)) return null;
    return path;
  };
  if (!value.includes("://")) return fromText(value);
  try {
    const url = new URL(value);
    const marker = "/attendance-photos/";
    const index = url.pathname.indexOf(marker);
    if (index === -1) return null;
    return fromText(decodeURIComponent(url.pathname.slice(index + marker.length)));
  } catch {
    return null;
  }
}
