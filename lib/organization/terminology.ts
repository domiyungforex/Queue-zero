/**
 * Terminology Adaptability for TuRnMaRk Organization CMS
 * Dynamically provides context-aware labels across University, Corporate, Hospital, and Event domains.
 */

export type OrganizationCategory =
  | "UNIVERSITY"
  | "POLYTECHNIC"
  | "COLLEGE"
  | "SECONDARY_SCHOOL"
  | "CORPORATE"
  | "HOSPITAL"
  | "EVENT"
  | "DEFAULT";

export interface OrganizationTerminology {
  level1: string; // e.g. Faculty, Division, Facility
  level1Plural: string;
  level2: string; // e.g. Department
  level2Plural: string;
  level3: string; // e.g. Unit, Team, Clinic
  level3Plural: string;
  operationalItem: string; // e.g. Course, Service, Clinic, Track
  operationalItemPlural: string;
  assignedPersonnel: string; // e.g. Lecturer, Lead, Doctor, Coordinator
  assignedPersonnelPlural: string;
  participant: string; // e.g. Student, Staff, Patient, Attendee
  participantPlural: string;
  session: string; // e.g. Class, Shift, Consultation, Check-in
  sessionPlural: string;
}

export function getOrganizationTerminology(
  institutionType?: string | null,
  organizationType?: string | null
): OrganizationTerminology {
  const normInst = (institutionType || "").toUpperCase();
  const normOrg = (organizationType || "").toUpperCase();

  if (
    normInst === "UNIVERSITY" ||
    normInst === "POLYTECHNIC" ||
    normInst === "COLLEGE" ||
    normInst === "SECONDARY_SCHOOL" ||
    normOrg === "UNIVERSITY_SCHOOL"
  ) {
    return {
      level1: "Faculty",
      level1Plural: "Faculties",
      level2: "Department",
      level2Plural: "Departments",
      level3: "Unit",
      level3Plural: "Units",
      operationalItem: "Course",
      operationalItemPlural: "Courses",
      assignedPersonnel: "Lecturer",
      assignedPersonnelPlural: "Lecturers",
      participant: "Student",
      participantPlural: "Students",
      session: "Class Session",
      sessionPlural: "Class Sessions",
    };
  }

  if (normOrg.includes("HOSPITAL") || normOrg.includes("HEALTH") || normInst.includes("HOSPITAL")) {
    return {
      level1: "Facility",
      level1Plural: "Facilities",
      level2: "Department",
      level2Plural: "Departments",
      level3: "Clinic / Unit",
      level3Plural: "Clinics & Units",
      operationalItem: "Service",
      operationalItemPlural: "Services",
      assignedPersonnel: "Practitioner",
      assignedPersonnelPlural: "Practitioners",
      participant: "Patient",
      participantPlural: "Patients",
      session: "Visit Session",
      sessionPlural: "Visit Sessions",
    };
  }

  if (normOrg.includes("EVENT") || normOrg.includes("CONFERENCE")) {
    return {
      level1: "Stage",
      level1Plural: "Stages",
      level2: "Track",
      level2Plural: "Tracks",
      level3: "Area",
      level3Plural: "Areas",
      operationalItem: "Session",
      operationalItemPlural: "Sessions",
      assignedPersonnel: "Coordinator",
      assignedPersonnelPlural: "Coordinators",
      participant: "Participant",
      participantPlural: "Participants",
      session: "Check-in Session",
      sessionPlural: "Check-in Sessions",
    };
  }

  // Default / Corporate
  return {
    level1: "Division",
    level1Plural: "Divisions",
    level2: "Department",
    level2Plural: "Departments",
    level3: "Unit",
    level3Plural: "Units",
    operationalItem: "Service",
    operationalItemPlural: "Services",
    assignedPersonnel: "Lead / Manager",
    assignedPersonnelPlural: "Leads & Staff",
    participant: "Member",
    participantPlural: "Members",
    session: "Operation Session",
    sessionPlural: "Operation Sessions",
  };
}
