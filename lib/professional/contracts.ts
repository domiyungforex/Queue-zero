import type { Database } from "@/lib/db/database.types";

export type ProfessionalCategory = Database["public"]["Enums"]["professional_category"];

export const PROFESSIONAL_LABELS: Record<ProfessionalCategory, string> = {
  LECTURER_TEACHER: "Lecturer / Teacher",
  DOCTOR: "Doctor",
  NURSE: "Nurse",
  BANKER: "Banker",
  BARBER_STYLIST: "Barber / Stylist",
  CONSULTANT: "Consultant",
  OTHER_PROFESSIONAL: "Professional",
};

export const PROFESSIONAL_DASHBOARD_COPY: Record<Exclude<ProfessionalCategory, "LECTURER_TEACHER">, {
  eyebrow: string;
  title: string;
  description: string;
  queueLabel: string;
}> = {
  DOCTOR: {
    eyebrow: "YOUR PRACTICE",
    title: "Make every arrival calmer.",
    description: "Manage consultation arrivals and waiting time without collecting medical records.",
    queueLabel: "consultation queue",
  },
  NURSE: {
    eyebrow: "YOUR PRACTICE",
    title: "Keep care arrivals moving.",
    description: "Manage your authorized service queue and keep waiting time visible.",
    queueLabel: "service queue",
  },
  BANKER: {
    eyebrow: "YOUR SERVICE",
    title: "A clearer personal service flow.",
    description: "Manage your own customer queue without representing an employer or collecting financial credentials.",
    queueLabel: "service queue",
  },
  BARBER_STYLIST: {
    eyebrow: "YOUR CHAIR",
    title: "Keep clients moving, not standing.",
    description: "Run your customer queue from arrival to completed service.",
    queueLabel: "customer queue",
  },
  CONSULTANT: {
    eyebrow: "YOUR SERVICE",
    title: "Give every client a clear turn.",
    description: "Manage arrivals and waiting time for your independent service.",
    queueLabel: "client queue",
  },
  OTHER_PROFESSIONAL: {
    eyebrow: "YOUR SERVICE",
    title: "Make every arrival easier.",
    description: "Manage your independent service queue from one focused workspace.",
    queueLabel: "service queue",
  },
};
