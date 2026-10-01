// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { JoinQueueForm } from "@/components/customer/join-queue-form";
import type { JoinOptions, JoinState } from "@/lib/validation/join";
const options: JoinOptions = { slug: "clinic", business_name: "Clinic", queue_name: "Consultation", status: "open", allow_phone: false, require_phone: false };
afterEach(cleanup);
it("only collects a phone when enabled, and reflects required configuration", () => {
  const action = vi.fn();
  const { rerender } = render(<JoinQueueForm options={options} action={action} />);
  expect(screen.queryByLabelText(/Phone/)).toBeNull();
  rerender(<JoinQueueForm options={{ ...options, allow_phone: true, require_phone: true }} action={action} />);
  expect((screen.getByLabelText(/Phone/) as HTMLInputElement).required).toBe(true);
});
it("prevents repeated submissions while pending and preserves values after failure", async () => {
  let finish!: (state: JoinState) => void;
  const action = vi.fn(() => new Promise<JoinState>((resolve) => { finish = resolve; }));
  render(<JoinQueueForm options={options} action={action} />);
  fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Ada" } });
  await act(async () => { fireEvent.submit(screen.getByRole("button", { name: "Join queue" }).closest("form")!); });
  expect((screen.getByRole("button", { name: "Joining…" }) as HTMLButtonElement).disabled).toBe(true);
  await act(async () => { finish({ status: "error", message: "Please retry", values: { firstName: "Ada", phone: "" } }); });
  expect(screen.getByRole("alert").textContent).toBe("Please retry");
  expect((screen.getByLabelText("First name") as HTMLInputElement).value).toBe("Ada");
  expect((screen.getByRole("button", { name: "Join queue" }) as HTMLButtonElement).disabled).toBe(false);
});
