// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.hoisted(() => vi.fn());
const lookupVerifiedStudent = vi.hoisted(() => vi.fn());
const recordAttendance = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/lib/school-student/actions", () => ({
  loadAttendanceDirectory: vi.fn(),
  lookupVerifiedStudent,
  recordAttendance,
  registerForAttendanceSession: vi.fn(),
}));
vi.mock("@/lib/analytics/client", () => ({ captureAnalytics: vi.fn() }));
vi.mock("@/components/school/dynamic-camera-modal", () => ({
  DynamicCameraModal: ({
    isOpen,
    onConfirmPhoto,
  }: {
    isOpen: boolean;
    onConfirmPhoto: (dataUrl: string) => void;
  }) =>
    isOpen ? (
      <div data-testid="mock-camera-modal">
        <button
          type="button"
          onClick={() => onConfirmPhoto("data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/")}
        >
          Confirm Mock Photo
        </button>
      </div>
    ) : null,
}));

import { StudentScan, type PublicClass } from "@/components/school/student-scan";

function makeTwoPartToken(sessionId: string, nonce: string) {
  const payload = btoa(JSON.stringify({ session_id: sessionId, nonce }))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `${payload}.fakeSignatureBase64UrlStringOf43CharsLong12345`;
}

const baseClass: PublicClass = {
  organization_name: "State University",
  course_code: "CSC 301",
  course_title: "Algorithms",
  starts_at: "2026-11-26T09:00:00Z",
  planned_ends_at: "2026-11-26T11:00:00Z",
  attendance_closes_at: "2026-11-26T11:00:00Z",
  verification_mode: "STANDARD",
  location_required: true,
  location_lat: 6.5244,
  location_lng: 3.3792,
  geofence_radius_meters: 150,
  open: true,
};

describe("StudentScan GPS & photo workflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });
    lookupVerifiedStudent.mockResolvedValue({
      ok: true,
      found: true,
      full_name: "Ada Lovelace",
      matric_number: "CSC/2022/045",
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("shows iOS Safari recovery instructions on location permission denial and allows retry", async () => {
    const getCurrentPosition = vi.fn((_ok, err) => err({ code: 1 }));
    Object.defineProperty(navigator, "geolocation", {
      value: { getCurrentPosition },
      configurable: true,
    });

    const token = makeTwoPartToken("11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222");
    render(<StudentScan token={token} classInfo={baseClass} />);

    await screen.findByText(/Location permission was denied/i);
    expect(screen.getByText(/iPhone Safari/i)).toBeTruthy();

    getCurrentPosition.mockImplementationOnce((ok) =>
      ok({
        coords: { latitude: 6.5244, longitude: 3.3792, accuracy: 25 },
        timestamp: Date.now(),
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: /Retry Location/i }));
    await screen.findByText(/GPS reading accepted/i);
  });

  it("falls back to network-assisted geolocation on timeout and uploads photo using 2-part token", async () => {
    let callCount = 0;
    const getCurrentPosition = vi.fn((ok, err) => {
      callCount += 1;
      if (callCount === 1) {
        err({ code: 3 }); // timeout on high-accuracy
      } else {
        ok({
          coords: { latitude: 6.5245, longitude: 3.3792, accuracy: 45 },
          timestamp: Date.now(),
        });
      }
    });
    Object.defineProperty(navigator, "geolocation", {
      value: { getCurrentPosition },
      configurable: true,
    });

    const sessionId = "11111111-1111-4111-8111-111111111111";
    const nonce = "22222222-2222-4222-8222-222222222222";
    const token = makeTwoPartToken(sessionId, nonce);

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ path: `org/${sessionId}/${nonce}.jpg` }),
    } as Response);

    recordAttendance.mockResolvedValue({
      ok: true,
      status: "PRESENT",
      message: "Recorded",
      full_name: "Ada Lovelace",
      matric_number: "CSC/2022/045",
      course_code: "CSC 301",
    });

    render(<StudentScan token={token} classInfo={baseClass} />);

    await screen.findByText(/GPS reading accepted/i);
    expect(getCurrentPosition).toHaveBeenCalledTimes(2);

    fireEvent.change(screen.getByLabelText(/Matriculation number/i), {
      target: { value: "CSC/2022/045" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Find me/i }));
    await screen.findByText("Ada Lovelace");

    fireEvent.click(screen.getByRole("button", { name: /Continue to Selfie/i }));
    fireEvent.click(await screen.findByRole("button", { name: "Confirm Mock Photo" }));
    fireEvent.click(await screen.findByRole("button", { name: /Confirm & Submit/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      `/api/school/classes/${sessionId}/photo`,
      expect.objectContaining({ method: "POST" }),
    ));
    await waitFor(() => expect(recordAttendance).toHaveBeenCalledWith(
      expect.objectContaining({
        photo: `org/${sessionId}/${nonce}.jpg`,
        latitude: 6.5245,
        longitude: 3.3792,
      }),
    ));
  });

  it("aborts attendance submission and shows error when photo upload fails", async () => {
    Object.defineProperty(navigator, "geolocation", {
      value: {
        getCurrentPosition: vi.fn((ok) =>
          ok({
            coords: { latitude: 6.5244, longitude: 3.3792, accuracy: 20 },
            timestamp: Date.now(),
          }),
        ),
      },
      configurable: true,
    });

    const sessionId = "11111111-1111-4111-8111-111111111111";
    const nonce = "22222222-2222-4222-8222-222222222222";
    const token = makeTwoPartToken(sessionId, nonce);

    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Photo storage is unavailable." }),
    } as Response);

    render(<StudentScan token={token} classInfo={baseClass} />);
    await screen.findByText(/GPS reading accepted/i);

    fireEvent.change(screen.getByLabelText(/Matriculation number/i), {
      target: { value: "CSC/2022/045" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Find me/i }));
    await screen.findByText("Ada Lovelace");

    fireEvent.click(screen.getByRole("button", { name: /Continue to Selfie/i }));
    fireEvent.click(await screen.findByRole("button", { name: "Confirm Mock Photo" }));
    fireEvent.click(await screen.findByRole("button", { name: /Confirm & Submit/i }));

    await screen.findByText("Photo storage is unavailable.");
    expect(recordAttendance).not.toHaveBeenCalled();
  });
});
