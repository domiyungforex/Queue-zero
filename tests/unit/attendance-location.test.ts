import { describe, expect, it } from "vitest";
import { assessAttendanceLocation, geolocationFailureMessage, haversineMeters } from "@/lib/school/location";

describe("attendance location", () => {
  it("measures a zero distance for the same point", () => {
    expect(haversineMeters(6.5244, 3.3792, 6.5244, 3.3792)).toBe(0);
  });

  it("accepts a reading inside the configured radius", () => {
    const result = assessAttendanceLocation({
      sessionLatitude: 6.5244,
      sessionLongitude: 3.3792,
      radiusMeters: 100,
      latitude: 6.52445,
      longitude: 3.3792,
      accuracyMeters: 20,
    });
    expect(result.status).toBe("WITHIN_RADIUS");
    expect(result.verified).toBe(true);
    expect(result.distanceMeters).toBeLessThan(100);
  });

  it("rejects a reading outside the radius without calling it verified", () => {
    const result = assessAttendanceLocation({
      sessionLatitude: 6.5244,
      sessionLongitude: 3.3792,
      radiusMeters: 100,
      latitude: 6.54,
      longitude: 3.3792,
      accuracyMeters: 15,
    });
    expect(result.status).toBe("OUTSIDE_RADIUS");
    expect(result.verified).toBe(false);
  });

  it("does not invent coordinates when capture fails", () => {
    const result = assessAttendanceLocation({ sessionLatitude: 6.5, sessionLongitude: 3.3, radiusMeters: 80 });
    expect(result.status).toBe("UNAVAILABLE");
    expect(result.verified).toBe(false);
    expect(result.distanceMeters).toBeNull();
  });

  it("labels an optional session instead of pretending it was verified", () => {
    expect(assessAttendanceLocation({}).status).toBe("NOT_REQUIRED");
  });

  it("refuses a reading that is too inaccurate to trust", () => {
    const result = assessAttendanceLocation({
      sessionLatitude: 6.5244,
      sessionLongitude: 3.3792,
      radiusMeters: 100,
      latitude: 6.5244,
      longitude: 3.3792,
      accuracyMeters: 2500,
    });
    expect(result.status).toBe("INACCURATE");
    expect(result.verified).toBe(false);
  });

  it("explains a denied permission", () => {
    expect(geolocationFailureMessage(1)).toMatch(/denied/i);
  });
});
