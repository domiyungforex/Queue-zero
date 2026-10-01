// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
import { QueueForm } from "@/components/queue/queue-form";
import { QueueStatusControls } from "@/components/queue/queue-status-controls";
import type { QueueState, QueueValues } from "@/lib/validation/queue";
afterEach(cleanup);
const locations = [{ id: "30000000-0000-4000-8000-000000000001", name: "Main Branch", is_active: true }, { id: "30000000-0000-4000-8000-000000000002", name: "Second Branch", is_active: true }];
const values: QueueValues = { name: "Consultation", description: "Helpful details", locationId: locations[1].id, serviceMinutes: "7.5", warningThreshold: "2", phoneMode: "required" };
function fill() {
  for (const [field, value] of Object.entries(values)) fireEvent.change(document.getElementById(field)!, { target: { value } });
  return screen.getByRole("button", { name: "Create queue" }).closest("form")!;
}
describe("queue settings form", () => {
  it("labels all fields and defaults service time and threshold", () => {
    render(<QueueForm locations={locations} action={async () => ({ status: "idle" })} />);
    for (const label of ["Queue name", /Description/, "Location", "Typical service time (minutes)", "Notification threshold", "Customer phone number"]) expect(screen.getByLabelText(label)).toBeTruthy();
    expect((screen.getByLabelText("Notification threshold") as HTMLInputElement).value).toBe("3");
    expect((screen.getByLabelText("Typical service time (minutes)") as HTMLInputElement).value).toBe("5");
  });
  it("prevents repeat clicks while pending and reenables after errors", async () => {
    let finish!: (state: QueueState) => void;
    const action = vi.fn(() => new Promise<QueueState>((resolve) => { finish = resolve; }));
    render(<QueueForm locations={locations} action={action} />);
    fireEvent.submit(fill());
    const button = await screen.findByRole("button", { name: "Saving queue…" });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(document.querySelector("fieldset")?.disabled).toBe(true);
    fireEvent.click(button);
    expect(action).toHaveBeenCalledOnce();
    await act(async () => finish({ status: "error", message: "Try again.", values }));
    expect((screen.getByRole("button", { name: "Create queue" }) as HTMLButtonElement).disabled).toBe(false);
  });
  it("retains text and selected options after failure and focuses the invalid field", async () => {
    const action = async (): Promise<QueueState> => ({ status: "error", message: "Check your details.", values, fieldErrors: { name: ["Choose a name."] } });
    render(<QueueForm locations={locations} action={action} />);
    fireEvent.submit(fill());
    await screen.findByRole("alert");
    const name = screen.getByLabelText("Queue name");
    await waitFor(() => expect(document.activeElement).toBe(name));
    for (const [field, value] of Object.entries(values)) expect((document.getElementById(field) as HTMLInputElement).value).toBe(value);
    expect(name.getAttribute("aria-describedby")).toBe(screen.getByText("Choose a name.").id);
  });
  it("blocks stale saves until the user reloads the latest revision", async () => {
    render(<QueueForm locations={locations} action={async () => ({ status: "error", conflict: true, message: "Queue changed.", values })} />);
    fireEvent.submit(fill());
    const reload = await screen.findByRole("button", { name: "Reload latest details" });
    expect((screen.getByRole("button", { name: "Create queue" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(reload);
    expect(refresh).toHaveBeenCalledOnce();
  });
  it("blocks submission without an active location", () => {
    render(<QueueForm locations={locations.map((location) => ({ ...location, is_active: false }))} action={async () => ({ status: "idle" })} />);
    expect((screen.getByRole("button", { name: "Create queue" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
describe("queue status controls", () => {
  it.each([
    ["open", ["Pause queue", "Close queue"]],
    ["paused", ["Resume queue", "Close queue"]],
    ["closed", ["Reopen queue"]],
  ] as const)("offers appropriate controls for %s", (status, labels) => {
    render(<QueueStatusControls status={status} action={async () => ({ status: "idle" })} />);
    expect(screen.getAllByRole("button").map((button) => button.textContent)).toEqual(labels);
  });
  it("reports status update errors and offers reload on conflict", async () => {
    render(<QueueStatusControls status="open" action={async () => ({ status: "error", conflict: true, message: "Queue changed." })} />);
    fireEvent.click(screen.getByRole("button", { name: "Pause queue" }));
    await screen.findByRole("alert");
    expect((screen.getByRole("button", { name: "Pause queue" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Reload latest details" }));
    expect(refresh).toHaveBeenCalledOnce();
  });
});
