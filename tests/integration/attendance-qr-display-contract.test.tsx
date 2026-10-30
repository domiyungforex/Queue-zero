// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PNG } from "pngjs";
import jsQR from "jsqr";

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@clerk/nextjs/server", () => ({ auth: async () => ({ userId: "user_testlecturer" }) }));
vi.mock("@/lib/db/server", () => ({ createUserSupabaseClient: async () => ({ rpc: mocks.rpc }) }));
vi.mock("next/image", () => ({ default: ({ alt, src, onLoad }: { alt: string; src: string; onLoad: () => void }) =>
  // eslint-disable-next-line @next/next/no-img-element
  <img alt={alt} src={src} data-src={src} onLoad={onLoad} /> }));

import { GET } from "@/app/api/school/classes/[classId]/qr/route";
import { AttendanceQr } from "@/components/school/attendance-qr";
import { validateAttendanceToken } from "@/lib/qr/validation";
import { attendanceSecret } from "@/lib/qr/secret";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it("displays a decodable signed class QR from the route's PostgreSQL offset response", async () => {
  const classId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const organizationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const nonce = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  const secret = "s".repeat(64);
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + 3600;
  vi.stubEnv("ATTENDANCE_QR_SECRET", secret);
  mocks.rpc.mockResolvedValue({ error: null, data: {
    organization_id: organizationId, session_id: classId, nonce,
    issued_at: new Date(issuedAt * 1000).toISOString().replace("Z", "+00:00"),
    expires_at: new Date(expiresAt * 1000).toISOString().replace("Z", "+00:00"),
  } });
  vi.stubGlobal("fetch", vi.fn(async () => GET(new Request(`http://localhost:3000/api/school/classes/${classId}/qr`), { params: Promise.resolve({ classId }) })));

  render(<AttendanceQr classId={classId} />);
  const image = await screen.findByRole("img", { name: "QR code for this class attendance form" });
  const source = image.getAttribute("data-src")!;
  const png = PNG.sync.read(Buffer.from(source.split(",")[1], "base64"));
  const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  expect(decoded).not.toBeNull();
  const url = new URL(decoded!.data);
  expect(url.pathname).toBe("/attend");
  expect(validateAttendanceToken(url.searchParams.get("token")!, attendanceSecret())).toMatchObject({
    organization_id: organizationId, session_id: classId, nonce, expires_at: expiresAt,
  });
  fireEvent.load(image);
  expect(screen.getByRole("link", { name: "Download PNG" }).getAttribute("href")).toBe(source);
  expect(screen.queryByText("QR unavailable")).toBeNull();
});
