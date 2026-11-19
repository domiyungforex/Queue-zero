const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string) {
  return UUID.test(value);
}

/** Attendance captures and profile photographs never share an object key. */
export function attendanceObjectKey(organizationId: string, classId: string, nonce: string, ext: "jpg" | "png" | "webp") {
  if (!isUuid(organizationId) || !isUuid(classId) || !isUuid(nonce)) throw new Error("Invalid attendance photo key");
  return `organizations/${organizationId}/attendance/${classId}/${nonce}.${ext}`;
}

/** Kept compatible with school_register_student until that check is widened. */
export function profileObjectKey(organizationId: string, imageId: string, ext: "jpg" | "png" | "webp") {
  if (!isUuid(organizationId) || !isUuid(imageId)) throw new Error("Invalid profile photo key");
  return `reference/${organizationId}/${imageId}.${ext}`;
}

export function thumbnailKey(key: string) {
  return key.replace(/(\.[a-z]+)$/i, ".thumb$1");
}

export function objectKeyOrganization(key: string) {
  const match = /^(?:organizations|reference|attendance)\/([0-9a-f-]{36})\//i.exec(key);
  return match?.[1]?.toLowerCase() ?? null;
}

export type ImageMigrationPlan = {
  action: "upload" | "already-stored" | "skip";
  targetKey: string | null;
  reason: string;
  deleteSource: false;
};

/** Plans a copy to R2. It never deletes the source object or rewrites a matriculation number. */
export function planImageMigration(input: { organizationId: string; classId?: string | null; recordId: string; photoUrl: string | null; ext?: "jpg" | "png" | "webp" }): ImageMigrationPlan {
  const photo = input.photoUrl?.trim() ?? "";
  if (!photo) return { action: "skip", targetKey: null, reason: "No photograph is stored.", deleteSource: false };
  if (!isUuid(input.organizationId) || !isUuid(input.recordId)) return { action: "skip", targetKey: null, reason: "The record has no stable organization or attendance id.", deleteSource: false };
  if (photo.startsWith(`organizations/${input.organizationId}/`)) return { action: "already-stored", targetKey: photo, reason: "The object key is already in the private R2 layout.", deleteSource: false };
  const ext = input.ext ?? (photo.includes("png") ? "png" : photo.includes("webp") ? "webp" : "jpg");
  const classId = input.classId && isUuid(input.classId) ? input.classId : input.recordId;
  return { action: "upload", targetKey: attendanceObjectKey(input.organizationId, classId, input.recordId, ext), reason: "Copy the existing photograph, then verify retrieval before any later cleanup.", deleteSource: false };
}
