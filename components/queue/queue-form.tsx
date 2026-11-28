"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { CustomDropdown } from "@/components/ui/custom-dropdown";
import { StickyActionBar } from "@/components/ui/flow";
import type { QueueAction, QueueField, QueueState, QueueValues } from "@/lib/validation/queue";

const control = "mt-2 min-h-12 w-full min-w-0 rounded-lg border border-black/20 bg-white px-3 py-3 text-base aria-invalid:border-red-700";
const initialState: QueueState = { status: "idle" };

export function QueueForm({ action, locations, initialValues, editing = false, units, selectedUnitId }: {
  action: QueueAction;
  locations: { id: string; name: string; is_active: boolean }[];
  initialValues?: QueueValues;
  editing?: boolean;
  units?: { id: string; name: string }[];
  selectedUnitId?: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const ref = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const values = state.values ?? initialValues ?? {
    name: "", serviceName: "", description: "", locationId: locations.find((location) => location.is_active)?.id ?? "",
    serviceMinutes: "5", capacity: "", opensAt: "", closesAt: "", status: "open", warningThreshold: "3", phoneMode: "none",
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
      {units && <div className="sm:col-span-2"><CustomDropdown name="unitId" label="Institution unit" placeholder="Choose a unit" defaultValue={values.unitId ?? selectedUnitId ?? ""} required options={units.map(unit => ({ value: unit.id, label: unit.name }))} /></div>}
      <div><label htmlFor="name" className="font-semibold">Queue name</label><input {...props("name")} required maxLength={160} placeholder="e.g. Walk-in Queue" />{error("name")}</div>
      <div><label htmlFor="serviceName" className="font-semibold">Service name</label><input {...props("serviceName")} required maxLength={160} placeholder="e.g. General Consultation" />{error("serviceName")}</div>
      <div className="sm:col-span-2"><label htmlFor="description" className="font-semibold">Description <span className="font-normal text-muted">(optional)</span></label><textarea {...props("description")} rows={3} maxLength={2000} />{error("description")}</div>
      <div className="sm:col-span-2"><CustomDropdown key={values.locationId} name="locationId" label="Location" placeholder="Choose a location" defaultValue={values.locationId ?? ""} required options={locations.filter((l) => l.is_active).map((location) => ({ value: location.id, label: location.name }))} />{error("locationId")}</div>
      <div><label htmlFor="serviceMinutes" className="font-semibold">Average service duration</label><input {...props("serviceMinutes")} required type="number" inputMode="decimal" min={1 / 60} max={1440} step="any" />{error("serviceMinutes")}<p className="mt-2 text-sm text-muted">Minutes spent serving one customer. TuRnMaRk improves estimates from real completed services.</p></div>
      <div><label htmlFor="capacity" className="font-semibold">Queue capacity <span className="font-normal text-muted">(optional)</span></label><input {...props("capacity")} type="number" inputMode="numeric" min={1} max={1000} step={1} placeholder="No custom limit" />{error("capacity")}</div>
      <div><label htmlFor="opensAt" className="font-semibold">Opens at <span className="font-normal text-muted">(optional)</span></label><input {...props("opensAt")} type="time" />{error("opensAt")}</div>
      <div><label htmlFor="closesAt" className="font-semibold">Closes at <span className="font-normal text-muted">(optional)</span></label><input {...props("closesAt")} type="time" />{error("closesAt")}</div>
      <div><CustomDropdown key={values.status} name="status" label="Status" defaultValue={values.status ?? "open"} options={[{ value: "open", label: "Open" }, { value: "paused", label: "Paused" }, { value: "closed", label: "Closed" }]} />{error("status")}</div>
      <div><label htmlFor="warningThreshold" className="font-semibold">Return notification threshold</label><input {...props("warningThreshold")} required type="number" inputMode="numeric" min={0} max={100} step={1} />{error("warningThreshold")}<p className="mt-2 text-sm text-muted">People ahead when a customer should start returning. Default: 3.</p></div>
      <div className="sm:col-span-2"><CustomDropdown key={values.phoneMode} name="phoneMode" label="Customer phone number" defaultValue={values.phoneMode ?? "none"} options={[{ value: "none", label: "Don’t collect phone numbers" }, { value: "optional", label: "Optional" }, { value: "required", label: "Required" }]} />{error("phoneMode")}</div>
    </fieldset>
    <StickyActionBar><button type="submit" disabled={pending || state.conflict || !locations.some((location) => location.is_active)} className="button-primary">{pending ? "Saving queue…" : editing ? "Save changes" : "Create queue"}</button></StickyActionBar>
    <p role="status" className="sr-only">{pending ? "Saving queue settings. Please wait." : ""}</p>
  </form>;
}
