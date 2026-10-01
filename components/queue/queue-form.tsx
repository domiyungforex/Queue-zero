"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { QueueAction, QueueField, QueueState, QueueValues } from "@/lib/validation/queue";

const control = "mt-2 min-h-12 w-full min-w-0 rounded-lg border border-black/20 bg-white px-3 py-3 text-base aria-invalid:border-red-700";
const initialState: QueueState = { status: "idle" };

export function QueueForm({ action, locations, initialValues, editing = false }: {
  action: QueueAction;
  locations: { id: string; name: string; is_active: boolean }[];
  initialValues?: QueueValues;
  editing?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const ref = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const values = state.values ?? initialValues ?? {
    name: "", description: "", locationId: locations.find((location) => location.is_active)?.id ?? "",
    serviceMinutes: "5", warningThreshold: "3", phoneMode: "none",
  };
  useEffect(() => {
    if (state.status === "error") {
      (ref.current?.querySelector<HTMLElement>('[aria-invalid="true"]') ?? ref.current?.querySelector<HTMLElement>('[role="alert"]'))?.focus();
    }
  }, [state]);

  function props(field: QueueField) {
    return { id: field, name: field, defaultValue: values[field], className: control,
      "aria-invalid": state.fieldErrors?.[field]?.length ? true : undefined,
      "aria-describedby": state.fieldErrors?.[field]?.length ? `${field}-error` : undefined };
  }
  function error(field: QueueField) {
    return state.fieldErrors?.[field]?.[0] && <p id={`${field}-error`} className="mt-2 text-sm text-red-800">{state.fieldErrors[field]?.[0]}</p>;
  }
  return <form ref={ref} action={formAction} aria-busy={pending} className="max-w-3xl space-y-6">
    {state.status === "error" && <div role="alert" tabIndex={-1} className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-900">
      <p>{state.message}</p>
      {state.conflict && <button type="button" onClick={() => router.refresh()} className="mt-3 min-h-11 rounded-lg border border-red-800 px-4">Reload latest details</button>}
    </div>}
    <fieldset disabled={pending || state.conflict} className="grid min-w-0 gap-6 rounded-2xl border border-black/10 bg-white p-5 sm:grid-cols-2 sm:p-8">
      <legend className="sr-only">Queue settings</legend>
      <div className="sm:col-span-2"><label htmlFor="name" className="font-semibold">Queue name</label><input {...props("name")} required maxLength={160} placeholder="e.g. Doctor Consultation" />{error("name")}</div>
      <div className="sm:col-span-2"><label htmlFor="description" className="font-semibold">Description <span className="font-normal text-muted">(optional)</span></label><textarea {...props("description")} rows={3} maxLength={2000} />{error("description")}</div>
      <div className="sm:col-span-2"><label htmlFor="locationId" className="font-semibold">Location</label><select key={values.locationId} {...props("locationId")} required><option value="" disabled>Choose a location</option>{locations.map((location) => <option key={location.id} value={location.id} disabled={!location.is_active}>{location.name}{location.is_active ? "" : " (inactive)"}</option>)}</select>{error("locationId")}</div>
      <div><label htmlFor="serviceMinutes" className="font-semibold">Typical service time (minutes)</label><input {...props("serviceMinutes")} required type="number" inputMode="decimal" min={1 / 60} max={1440} step="any" />{error("serviceMinutes")}<p className="mt-2 text-sm text-muted">Time spent serving one customer, e.g. 5 or 1.5 minutes.</p></div>
      <div><label htmlFor="warningThreshold" className="font-semibold">Notification threshold</label><input {...props("warningThreshold")} required type="number" inputMode="numeric" min={0} max={100} step={1} />{error("warningThreshold")}<p className="mt-2 text-sm text-muted">People ahead when a customer should start returning. Default: 3.</p></div>
      <div className="sm:col-span-2"><label htmlFor="phoneMode" className="font-semibold">Customer phone number</label><select key={values.phoneMode} {...props("phoneMode")}><option value="none">Don’t collect phone numbers</option><option value="optional">Optional</option><option value="required">Required</option></select>{error("phoneMode")}</div>
    </fieldset>
    <button type="submit" disabled={pending || state.conflict || !locations.some((location) => location.is_active)} className="min-h-12 rounded-xl bg-primary px-7 py-3 font-semibold text-white disabled:opacity-50">{pending ? "Saving queue…" : editing ? "Save changes" : "Create queue"}</button>
    <p role="status" className="sr-only">{pending ? "Saving queue settings. Please wait." : ""}</p>
  </form>;
}
