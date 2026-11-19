import { describe, expect, it } from "vitest";
import { attendanceObjectKey, objectKeyOrganization, planImageMigration, profileObjectKey, thumbnailKey } from "@/lib/storage/keys";
import { readR2Settings } from "@/lib/storage/r2-env";
import { attendanceCsv, buildRegister } from "@/lib/school/exports";
import { schoolFixture, classId } from "./school-fixture";

const org = "11111111-1111-4111-8111-111111111111";
const other = "99999999-9999-4999-8999-999999999999";
const klass = "33333333-3333-4333-8333-333333333333";
const nonce = "44444444-4444-4444-8444-444444444444";
const image = "55555555-5555-4555-8555-555555555555";

describe("private image keys", () => {
  it("keeps attendance photographs away from the profile photograph and the matric number", () => {
    const attendance = attendanceObjectKey(org, klass, nonce, "jpg");
    const profile = profileObjectKey(org, image, "jpg");
    expect(attendance).not.toBe(profile);
    expect(attendance).not.toContain("CSC");
    expect(profile.startsWith(`reference/${org}/`)).toBe(true);
    expect(objectKeyOrganization(attendance)).toBe(org);
    expect(objectKeyOrganization(`organizations/${other}/attendance/${klass}/${nonce}.jpg`)).not.toBe(org);
    expect(thumbnailKey(attendance)).toBe(`organizations/${org}/attendance/${klass}/${nonce}.thumb.jpg`);
  });

  it("plans a copy and never deletes the source", () => {
    const planned = planImageMigration({ organizationId: org, classId: klass, recordId: nonce, photoUrl: "data:image/jpeg;base64,aaaa" });
    expect(planned.action).toBe("upload");
    expect(planned.deleteSource).toBe(false);
    expect(planned.targetKey).toContain(org);
    const again = planImageMigration({ organizationId: org, classId: klass, recordId: nonce, photoUrl: planned.targetKey });
    expect(again.action).toBe("already-stored");
    expect(again.deleteSource).toBe(false);
    expect(planImageMigration({ organizationId: org, recordId: nonce, photoUrl: null }).action).toBe("skip");
  });

  it("does not treat missing credentials as a configured bucket", () => {
    expect(readR2Settings({} as NodeJS.ProcessEnv)).toBeNull();
  });

  it("does not put photograph addresses in the CSV register", () => {
    const data = schoolFixture();
    data.attendance[0].photo_url = `/api/school/attendance-photos/${data.attendance[0].id}`;
    const csv = attendanceCsv(buildRegister(data, classId));
    expect(csv).toContain("On file");
    expect(csv).not.toContain("https://");
    expect(csv).not.toContain("/api/school/attendance-photos/");
  });
});
