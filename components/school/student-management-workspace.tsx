"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  Calendar,
  GraduationCap,
  Mail,
  Phone,
  Plus,
  Search,
  User,
  UsersRound,
  X,
} from "lucide-react";

function EditIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}
function FilterIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  );
}
function LinkIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}
function UploadIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}
import type { SchoolSnapshot } from "@/lib/school/contracts";
import type { EnrichedStudentRecord } from "@/lib/school/student-details";
import { correctStudentProfile, createStudentByAdmin } from "@/lib/school-student/registration";
import { deleteStudentProfile } from "@/lib/school/actions";
import { CustomDropdown } from "@/components/ui/custom-dropdown";
import { DeleteConfirmButton } from "./delete-confirm-button";
import { EnrollmentForm } from "./forms";
import { FeedbackNotice } from "./feedback-notice";
import { StudentAccessLinks } from "./student-access-links";
import styles from "./student-management.module.css";

type Props = {
  snapshot: SchoolSnapshot;
  students: EnrichedStudentRecord[];
  canManage: boolean;
};

type ActiveModal = null | "edit" | "add" | "import" | "share";

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "ST";
}

function formatRegisteredDate(value: string | null) {
  if (!value) return "Registered";
  try {
    return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(value));
  } catch {
    return "Registered";
  }
}

function statusDisplay(status: EnrichedStudentRecord["latest_status"]) {
  if (status === "PRESENT") return { label: "Present", tone: "success" as const };
  if (status === "LATE") return { label: "Late", tone: "warning" as const };
  if (status === "ABSENT") return { label: "Absent", tone: "danger" as const };
  return { label: "Active", tone: "success" as const };
}

export function StudentManagementWorkspace({ snapshot, students, canManage }: Props) {
  const [selectedId, setSelectedId] = useState<string>(students[0]?.id ?? "");
  const selectedStudent = students.find((s) => s.id === selectedId) ?? students[0] ?? null;

  // Search, Filters, Sort, Pagination
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [facultyFilter, setFacultyFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [levelFilter, setLevelFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"name" | "matric" | "newest">("name");
  const [page, setPage] = useState(1);

  // Modals & Toast
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [toast, setToast] = useState<{ ok: boolean; message: string } | null>(null);

  // Edit / Add form states
  const [formBusy, setFormBusy] = useState(false);
  const [formFeedback, setFormFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const [editFacultyId, setEditFacultyId] = useState(selectedStudent?.faculty_id || snapshot.faculties[0]?.id || "");
  const [editDepartmentId, setEditDepartmentId] = useState(selectedStudent?.department_id || snapshot.departments[0]?.id || "");

  const [addFacultyId, setAddFacultyId] = useState(snapshot.faculties[0]?.id ?? "");
  const [addDepartmentId, setAddDepartmentId] = useState(snapshot.departments[0]?.id ?? "");

  // Close modals on Escape
  useEffect(() => {
    if (!activeModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setActiveModal(null);
        setFormFeedback(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeModal]);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(id);
  }, [toast]);

  const openEditModal = (student: EnrichedStudentRecord) => {
    setSelectedId(student.id);
    setEditFacultyId(student.faculty_id || snapshot.faculties[0]?.id || "");
    setEditDepartmentId(student.department_id);
    setFormFeedback(null);
    setActiveModal("edit");
  };

  const openAddModal = () => {
    const firstFac = snapshot.faculties[0]?.id ?? "";
    const firstDept = snapshot.departments.find((d) => d.faculty_id === firstFac)?.id ?? snapshot.departments[0]?.id ?? "";
    setAddFacultyId(firstFac);
    setAddDepartmentId(firstDept);
    setFormFeedback(null);
    setActiveModal("add");
  };

  // Distinct academic levels from real student data
  const levelOptions = useMemo(() => {
    const levels = Array.from(new Set(students.map((s) => s.level.trim()).filter(Boolean))).sort();
    return [{ value: "all", label: "All levels" }, ...levels.map((lvl) => ({ value: lvl, label: lvl }))];
  }, [students]);

  const facultyOptions = useMemo(
    () => [{ value: "all", label: "All faculties" }, ...snapshot.faculties.map((f) => ({ value: f.id, label: f.name }))],
    [snapshot.faculties],
  );

  const departmentFilterOptions = useMemo(() => {
    const list = facultyFilter === "all"
      ? snapshot.departments
      : snapshot.departments.filter((d) => d.faculty_id === facultyFilter);
    return [{ value: "all", label: "All departments" }, ...list.map((d) => ({ value: d.id, label: d.name }))];
  }, [snapshot.departments, facultyFilter]);

  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = students.filter((s) => {
      if (q && !s.full_name.toLowerCase().includes(q) && !s.matric_number.toLowerCase().includes(q)) return false;
      if (facultyFilter !== "all" && s.faculty_id !== facultyFilter) return false;
      if (departmentFilter !== "all" && s.department_id !== departmentFilter) return false;
      if (levelFilter !== "all" && s.level !== levelFilter) return false;
      if (statusFilter === "present" && s.latest_status !== "PRESENT") return false;
      if (statusFilter === "late" && s.latest_status !== "LATE") return false;
      if (statusFilter === "absent" && s.latest_status !== "ABSENT") return false;
      if (statusFilter === "active" && s.latest_status !== null) return false;
      return true;
    });

    return list.sort((a, b) => {
      if (sortBy === "matric") return a.matric_number.localeCompare(b.matric_number);
      if (sortBy === "newest") return (b.created_at ?? "").localeCompare(a.created_at ?? "");
      return a.full_name.localeCompare(b.full_name);
    });
  }, [students, search, facultyFilter, departmentFilter, levelFilter, statusFilter, sortBy]);

  const pageSize = 15;
  const pageCount = Math.max(1, Math.ceil(filteredStudents.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const visibleStudents = filteredStudents.slice((safePage - 1) * pageSize, safePage * pageSize);

  const hasActiveFilters =
    Boolean(search.trim()) ||
    facultyFilter !== "all" ||
    departmentFilter !== "all" ||
    levelFilter !== "all" ||
    statusFilter !== "all";

  const resetFilters = () => {
    setSearch("");
    setFacultyFilter("all");
    setDepartmentFilter("all");
    setLevelFilter("all");
    setStatusFilter("all");
    setPage(1);
  };

  return (
    <main className={styles.page}>
      {/* Top Header */}
      <div className={styles.topBar}>
        <Link href="/dashboard" className={styles.backLink}>
          <ArrowLeft size={15} aria-hidden="true" />
          <span>Dashboard</span>
        </Link>
        <div className={styles.headerRow}>
          <div className={styles.headerCopy}>
            <h1>Student Profile Management</h1>
            <p>
              View and manage student details. Update records, add new students, or import rosters for{" "}
              {snapshot.organization.name}.
            </p>
          </div>
          <div className={styles.headerBadge} aria-hidden="true">
            <UsersRound size={24} />
          </div>
        </div>
      </div>

      {/* Selected Student Profile Overview */}
      {selectedStudent ? (
        <>
          <section className={styles.card} aria-label="Student details">
            <div className={styles.cardTopRow}>
              <p className={styles.eyebrow}>Student details</p>
              {canManage ? (
                <button type="button" className={styles.editBtn} onClick={() => openEditModal(selectedStudent)}>
                  <EditIcon />
                  <span>Edit profile</span>
                </button>
              ) : null}
            </div>

            <div className={styles.identityRow}>
              <div className={styles.avatarLarge} aria-hidden="true">
                {getInitials(selectedStudent.full_name)}
              </div>
              <div className={styles.identityMeta}>
                <h2>{selectedStudent.full_name}</h2>
                <div className={styles.statusRow}>
                  {(() => {
                    const st = statusDisplay(selectedStudent.latest_status);
                    return (
                      <span className={styles.statusPill} data-tone={st.tone}>
                        <span className={styles.statusDot} />
                        {st.label}
                      </span>
                    );
                  })()}
                  {selectedStudent.has_photo ? (
                    <span className={styles.statusPill} data-tone="muted">
                      Photo on file
                    </span>
                  ) : null}
                </div>
                <div className={styles.matricBlock}>
                  <span className={styles.matricLabel}>
                    <GraduationCap size={14} aria-hidden="true" />
                    Matriculation number
                  </span>
                  <span className={styles.matricValue}>{selectedStudent.matric_number}</span>
                </div>
              </div>
            </div>

            <div className={styles.summaryStrip}>
              <div className={styles.summaryCell}>
                <span className={styles.summaryCellLabel}>
                  <User size={13} aria-hidden="true" />
                  Full legal name
                </span>
                <strong>{selectedStudent.full_name}</strong>
              </div>
              <div className={styles.summaryCell}>
                <span className={styles.summaryCellLabel}>
                  <Calendar size={13} aria-hidden="true" />
                  Date registered
                </span>
                <strong>{formatRegisteredDate(selectedStudent.created_at)}</strong>
              </div>
              <div className={styles.summaryCell}>
                <span className={styles.summaryCellLabel}>
                  <Building2 size={13} aria-hidden="true" />
                  Department
                </span>
                <strong>{selectedStudent.department_name}</strong>
              </div>
              <div className={styles.summaryCell}>
                <span className={styles.summaryCellLabel}>
                  <GraduationCap size={13} aria-hidden="true" />
                  Academic level
                </span>
                <strong>{selectedStudent.level}</strong>
              </div>
            </div>
          </section>

          {/* Personal Information Card */}
          <section className={styles.card} aria-label="Personal information">
            <div className={styles.sectionTitleRow}>
              <h2 className={styles.sectionTitle}>
                <User size={17} aria-hidden="true" />
                <span>Personal information</span>
              </h2>
              {canManage ? (
                <button
                  type="button"
                  onClick={() => openEditModal(selectedStudent)}
                  style={{
                    border: 0,
                    background: "transparent",
                    color: "#e05318",
                    fontSize: "13px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Update details
                </button>
              ) : null}
            </div>

            <div className={styles.infoGrid}>
              <div className={styles.infoItem}>
                <Phone size={16} className={styles.infoIcon} aria-hidden="true" />
                <div>
                  <span>Phone contact (optional)</span>
                  <strong>{selectedStudent.phone || "Not provided"}</strong>
                </div>
              </div>
              <div className={styles.infoItem}>
                <Mail size={16} className={styles.infoIcon} aria-hidden="true" />
                <div>
                  <span>Email address</span>
                  <strong>{selectedStudent.email || "Not provided"}</strong>
                </div>
              </div>
              <div className={styles.infoItem}>
                <Building2 size={16} className={styles.infoIcon} aria-hidden="true" />
                <div>
                  <span>Faculty</span>
                  <strong>{selectedStudent.faculty_name}</strong>
                </div>
              </div>
              <div className={styles.infoItem}>
                <UsersRound size={16} className={styles.infoIcon} aria-hidden="true" />
                <div>
                  <span>Programme</span>
                  <strong>{selectedStudent.programme || selectedStudent.department_name}</strong>
                </div>
              </div>
            </div>
          </section>
        </>
      ) : (
        <section className={styles.card} style={{ textAlign: "left" }}>
          <h2 style={{ margin: "0 0 8px", fontSize: "18px", fontWeight: 800 }}>No students registered yet</h2>
          <p style={{ margin: "0 0 16px", fontSize: "13.5px", color: "#647087", lineHeight: 1.55 }}>
            Add your first student directly, import an institutional roster, or share your institution’s self-registration link.
          </p>
        </section>
      )}

      {/* Three Primary Management Actions */}
      <section className={styles.actionsBar} aria-label="Student management actions">
        <button type="button" className={styles.actionPrimary} onClick={openAddModal}>
          <Plus size={16} aria-hidden="true" />
          <span>Add new student</span>
        </button>
        <button type="button" className={styles.actionSecondary} onClick={() => setActiveModal("import")}>
          <UploadIcon />
          <span>Import students</span>
        </button>
        <button type="button" className={styles.actionSecondary} onClick={() => setActiveModal("share")}>
          <LinkIcon />
          <span>Share registration link</span>
        </button>
      </section>

      {/* Important Notice */}
      <div className={styles.importantBox} role="note">
        <AlertTriangle size={18} aria-hidden="true" />
        <div>
          <strong>Important</strong>
          <p>
            Changing a student’s matriculation number updates their institutional identifier across attendance check-ins and records. Student identity remains separate from course enrollment so students can attend any open class.
          </p>
        </div>
      </div>

      {/* Student Records Section */}
      <section className={styles.card} aria-labelledby="student-records-heading">
        <div className={styles.recordsToolbar}>
          <h2 id="student-records-heading" className={styles.sectionTitle}>
            <UsersRound size={18} aria-hidden="true" />
            <span>Student records</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "#647087" }}>
              ({filteredStudents.length})
            </span>
          </h2>

          <div className={styles.searchRow}>
            <label className={styles.searchInputWrap}>
              <Search size={15} aria-hidden="true" style={{ color: "#647087", flexShrink: 0 }} />
              <span className="sr-only">Search students by name or matriculation number</span>
              <input
                type="search"
                enterKeyHint="search"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search by name or matric number…"
              />
            </label>
            <button
              type="button"
              className={styles.filterToggleBtn}
              data-active={showFilters || hasActiveFilters}
              aria-expanded={showFilters}
              onClick={() => setShowFilters((prev) => !prev)}
            >
              <FilterIcon />
              <span>Filters</span>
            </button>
          </div>
        </div>

        {/* Filter Panel */}
        {showFilters ? (
          <div className={styles.filtersPanel}>
            <CustomDropdown
              label="Faculty"
              value={facultyFilter}
              options={facultyOptions}
              onChange={(val) => {
                setFacultyFilter(val);
                setDepartmentFilter("all");
                setPage(1);
              }}
            />
            <CustomDropdown
              label="Department"
              value={departmentFilter}
              options={departmentFilterOptions}
              onChange={(val) => {
                setDepartmentFilter(val);
                setPage(1);
              }}
            />
            <CustomDropdown
              label="Academic level"
              value={levelFilter}
              options={levelOptions}
              onChange={(val) => {
                setLevelFilter(val);
                setPage(1);
              }}
            />
            <CustomDropdown
              label="Status"
              value={statusFilter}
              options={[
                { value: "all", label: "All statuses" },
                { value: "present", label: "Present" },
                { value: "late", label: "Late" },
                { value: "absent", label: "Absent" },
                { value: "active", label: "Registered (no session yet)" },
              ]}
              onChange={(val) => {
                setStatusFilter(val);
                setPage(1);
              }}
            />
            <CustomDropdown
              label="Sort by"
              value={sortBy}
              options={[
                { value: "name", label: "Name (A–Z)" },
                { value: "matric", label: "Matric number (A–Z)" },
                { value: "newest", label: "Newest registered" },
              ]}
              onChange={(val) => setSortBy(val as "name" | "matric" | "newest")}
            />
          </div>
        ) : null}

        {/* Active Filter Indicators */}
        {hasActiveFilters ? (
          <div className={styles.activeChips}>
            {search.trim() ? <span className={styles.chip}>Search: {search.trim()}</span> : null}
            {facultyFilter !== "all" ? (
              <span className={styles.chip}>
                Faculty: {snapshot.faculties.find((f) => f.id === facultyFilter)?.name ?? facultyFilter}
              </span>
            ) : null}
            {departmentFilter !== "all" ? (
              <span className={styles.chip}>
                Department: {snapshot.departments.find((d) => d.id === departmentFilter)?.name ?? departmentFilter}
              </span>
            ) : null}
            {levelFilter !== "all" ? <span className={styles.chip}>Level: {levelFilter}</span> : null}
            {statusFilter !== "all" ? <span className={styles.chip}>Status: {statusFilter}</span> : null}
            <button type="button" className={styles.resetBtn} onClick={resetFilters}>
              Reset filters
            </button>
          </div>
        ) : null}

        {visibleStudents.length === 0 ? (
          <div style={{ padding: "32px 16px", textAlign: "left", border: "1px dashed #dfe5ee", borderRadius: "14px" }}>
            <strong style={{ display: "block", fontSize: "15px", marginBottom: "6px" }}>
              {hasActiveFilters ? "No matching student records" : "No student records yet"}
            </strong>
            <p style={{ margin: "0 0 14px", fontSize: "13px", color: "#647087" }}>
              {hasActiveFilters
                ? "Adjust your search or filters to see registered students."
                : "Register a student or share your institution’s registration link to get started."}
            </p>
            {hasActiveFilters ? (
              <button type="button" className={styles.actionSecondary} onClick={resetFilters}>
                Reset filters
              </button>
            ) : (
              <button type="button" className={styles.actionPrimary} onClick={openAddModal}>
                <Plus size={15} aria-hidden="true" />
                <span>Add new student</span>
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Matric number</th>
                    <th>Department</th>
                    <th>Level</th>
                    <th>Status</th>
                    <th data-numeric="true">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleStudents.map((student) => {
                    const st = statusDisplay(student.latest_status);
                    const isSelected = selectedStudent?.id === student.id;
                    return (
                      <tr
                        key={student.id}
                        className={styles.tableRow}
                        data-selected={isSelected}
                        onClick={() => setSelectedId(student.id)}
                      >
                        <td>
                          <div className={styles.nameCell}>
                            <span className={styles.miniAvatar}>{getInitials(student.full_name)}</span>
                            <strong style={{ fontWeight: 700, color: "#111318" }}>{student.full_name}</strong>
                          </div>
                        </td>
                        <td style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontWeight: 600 }}>
                          {student.matric_number}
                        </td>
                        <td style={{ color: "#4c576c" }}>{student.department_name}</td>
                        <td style={{ color: "#4c576c" }}>{student.level}</td>
                        <td>
                          <span className={styles.statusPill} data-tone={st.tone}>
                            <span className={styles.statusDot} />
                            {st.label}
                          </span>
                        </td>
                        <td
                          data-numeric="true"
                          onClick={(e) => e.stopPropagation()}
                          style={{ whiteSpace: "nowrap" }}
                        >
                          {canManage ? (
                            <button
                              type="button"
                              onClick={() => openEditModal(student)}
                              style={{
                                minHeight: "34px",
                                padding: "4px 12px",
                                borderRadius: "8px",
                                border: "1px solid #dfe5ee",
                                background: "#ffffff",
                                color: "#111318",
                                fontSize: "12px",
                                fontWeight: 700,
                                cursor: "pointer",
                              }}
                            >
                              Edit
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setSelectedId(student.id)}
                              style={{
                                minHeight: "34px",
                                padding: "4px 12px",
                                borderRadius: "8px",
                                border: "1px solid #dfe5ee",
                                background: "#ffffff",
                                color: "#111318",
                                fontSize: "12px",
                                fontWeight: 700,
                                cursor: "pointer",
                              }}
                            >
                              View
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className={styles.mobileCards}>
              {visibleStudents.map((student) => {
                const st = statusDisplay(student.latest_status);
                const isSelected = selectedStudent?.id === student.id;
                return (
                  <article
                    key={student.id}
                    className={styles.mobileStudentCard}
                    data-selected={isSelected}
                  >
                    <div className={styles.mobileCardTop}>
                      <div className={styles.nameCell}>
                        <span className={styles.miniAvatar}>{getInitials(student.full_name)}</span>
                        <div style={{ minWidth: 0 }}>
                          <strong style={{ display: "block", fontSize: "14px", color: "#111318" }}>
                            {student.full_name}
                          </strong>
                          <span
                            style={{
                              fontSize: "12px",
                              color: "#647087",
                              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                            }}
                          >
                            {student.matric_number}
                          </span>
                        </div>
                      </div>
                      <span className={styles.statusPill} data-tone={st.tone}>
                        <span className={styles.statusDot} />
                        {st.label}
                      </span>
                    </div>

                    <div className={styles.mobileCardMeta}>
                      <div>
                        <span>Department</span>
                        <strong>{student.department_name}</strong>
                      </div>
                      <div>
                        <span>Level</span>
                        <strong>{student.level}</strong>
                      </div>
                    </div>

                    <div className={styles.mobileCardActions}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedId(student.id);
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                      >
                        View profile
                      </button>
                      {canManage ? (
                        <button type="button" onClick={() => openEditModal(student)}>
                          Edit profile
                        </button>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>

            {/* Pagination */}
            {pageCount > 1 ? (
              <div className={styles.pagination}>
                <span className={styles.paginationInfo}>
                  Showing {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, filteredStudents.length)} of{" "}
                  {filteredStudents.length} students
                </span>
                <div className={styles.paginationBtns}>
                  <button
                    type="button"
                    className={styles.pageBtn}
                    disabled={safePage <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </button>
                  <span className={styles.paginationInfo} style={{ padding: "0 8px" }}>
                    Page {safePage} of {pageCount}
                  </span>
                  <button
                    type="button"
                    className={styles.pageBtn}
                    disabled={safePage >= pageCount}
                    onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                  >
                    Next
                  </button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </section>

      {/* Edit Profile Modal */}
      {activeModal === "edit" && selectedStudent ? (
        <div className={styles.modalBackdrop} role="dialog" aria-modal="true" aria-labelledby="edit-student-title">
          <div className={styles.modalPanel}>
            <div className={styles.modalHeader}>
              <div>
                <h2 id="edit-student-title">Edit student profile</h2>
                <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#647087" }}>
                  Update {selectedStudent.full_name}’s institutional details.
                </p>
              </div>
              <button
                type="button"
                className={styles.modalCloseBtn}
                aria-label="Close edit profile modal"
                onClick={() => setActiveModal(null)}
              >
                <X size={18} />
              </button>
            </div>

            <form
              key={selectedStudent.id}
              action={async (formData) => {
                setFormBusy(true);
                setFormFeedback(null);
                try {
                  const res = await correctStudentProfile({ ok: false, message: "" }, formData);
                  setFormFeedback(res);
                  if (res.ok) {
                    setToast({ ok: true, message: res.message });
                    setActiveModal(null);
                  }
                } finally {
                  setFormBusy(false);
                }
              }}
              style={{ display: "grid", gap: "18px" }}
            >
              <input type="hidden" name="student_id" value={selectedStudent.id} />
              <div className={styles.formGrid}>
                <label className={styles.fieldLabel}>
                  <span>Full legal name</span>
                  <input
                    name="full_name"
                    className={styles.fieldInput}
                    defaultValue={selectedStudent.full_name}
                    required
                    maxLength={160}
                  />
                </label>
                <label className={styles.fieldLabel}>
                  <span>Matriculation number</span>
                  <input
                    name="matric_number"
                    className={styles.fieldInput}
                    defaultValue={selectedStudent.matric_number}
                    required
                    maxLength={80}
                    autoComplete="off"
                  />
                </label>
                <CustomDropdown
                  label="Faculty"
                  value={editFacultyId}
                  options={snapshot.faculties.map((f) => ({ value: f.id, label: f.name }))}
                  onChange={(nextFac) => {
                    setEditFacultyId(nextFac);
                    const firstDept = snapshot.departments.find((d) => d.faculty_id === nextFac);
                    if (firstDept) setEditDepartmentId(firstDept.id);
                  }}
                />
                <CustomDropdown
                  name="department_id"
                  label="Department"
                  value={editDepartmentId}
                  options={snapshot.departments
                    .filter((d) => !editFacultyId || d.faculty_id === editFacultyId)
                    .map((d) => ({ value: d.id, label: d.name }))}
                  onChange={setEditDepartmentId}
                  required
                />
                <label className={styles.fieldLabel}>
                  <span>Programme</span>
                  <input
                    name="programme"
                    className={styles.fieldInput}
                    defaultValue={selectedStudent.programme}
                    maxLength={160}
                    placeholder="e.g. Agricultural Engineering"
                  />
                </label>
                <label className={styles.fieldLabel}>
                  <span>Academic level</span>
                  <input
                    name="level"
                    className={styles.fieldInput}
                    defaultValue={selectedStudent.level}
                    inputMode="numeric"
                    required
                    maxLength={40}
                  />
                </label>
                <label className={styles.fieldLabel}>
                  <span>Phone contact (optional)</span>
                  <input
                    name="phone"
                    type="tel"
                    inputMode="tel"
                    className={styles.fieldInput}
                    defaultValue={selectedStudent.phone}
                    maxLength={20}
                  />
                </label>
                <label className={styles.fieldLabel}>
                  <span>Email address (optional)</span>
                  <input
                    name="email"
                    type="email"
                    inputMode="email"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    className={styles.fieldInput}
                    defaultValue={selectedStudent.email}
                    maxLength={254}
                  />
                </label>
              </div>

              {formFeedback ? <FeedbackNotice ok={formFeedback.ok} message={formFeedback.message} /> : null}

              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", flexWrap: "wrap" }}>
                <button
                  type="button"
                  className={styles.actionSecondary}
                  onClick={() => setActiveModal(null)}
                >
                  Cancel
                </button>
                <button type="submit" className={styles.actionPrimary} disabled={formBusy}>
                  {formBusy ? "Saving changes…" : "Save student profile"}
                </button>
              </div>
            </form>

            {/* Separated Delete Bar */}
            <div
              style={{
                marginTop: "22px",
                paddingTop: "16px",
                borderTop: "1px solid #eef2f7",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "12px",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <strong style={{ display: "block", fontSize: "13px", color: "#111318" }}>
                  Delete student profile
                </strong>
                <span style={{ fontSize: "12px", color: "#647087" }}>
                  Removes {selectedStudent.full_name} and their attendance records.
                </span>
              </div>
              <DeleteConfirmButton
                label="Delete student"
                confirmLabel="Confirm delete"
                onDelete={() => deleteStudentProfile(selectedStudent.id)}
                onResult={(res) => {
                  setFormFeedback(res);
                  if (res.ok) {
                    setToast({ ok: true, message: res.message });
                    setActiveModal(null);
                  }
                }}
              />
            </div>
          </div>
        </div>
      ) : null}

      {/* Add New Student Modal */}
      {activeModal === "add" ? (
        <div className={styles.modalBackdrop} role="dialog" aria-modal="true" aria-labelledby="add-student-title">
          <div className={styles.modalPanel}>
            <div className={styles.modalHeader}>
              <div>
                <h2 id="add-student-title">Add new student</h2>
                <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#647087" }}>
                  Register a student at {snapshot.organization.name} without requiring course enrollment.
                </p>
              </div>
              <button
                type="button"
                className={styles.modalCloseBtn}
                aria-label="Close add student modal"
                onClick={() => setActiveModal(null)}
              >
                <X size={18} />
              </button>
            </div>

            {snapshot.departments.length === 0 ? (
              <FeedbackNotice
                ok={false}
                message="Create at least one faculty and department in Academic Setup before registering students."
              />
            ) : (
              <form
                action={async (formData) => {
                  setFormBusy(true);
                  setFormFeedback(null);
                  try {
                    const res = await createStudentByAdmin({ ok: false, message: "" }, formData);
                    setFormFeedback(res);
                    if (res.ok) {
                      setToast({ ok: true, message: res.message });
                      setActiveModal(null);
                    }
                  } finally {
                    setFormBusy(false);
                  }
                }}
                style={{ display: "grid", gap: "18px" }}
              >
                <div className={styles.formGrid}>
                  <label className={styles.fieldLabel}>
                    <span>Full legal name</span>
                    <input name="full_name" className={styles.fieldInput} required maxLength={160} placeholder="e.g. Aisha Bello" />
                  </label>
                  <label className={styles.fieldLabel}>
                    <span>Matriculation number</span>
                    <input name="matric_number" className={styles.fieldInput} required maxLength={80} autoComplete="off" placeholder="e.g. CSC/2023/045" />
                  </label>
                  <CustomDropdown
                    label="Faculty"
                    value={addFacultyId}
                    options={snapshot.faculties.map((f) => ({ value: f.id, label: f.name }))}
                    onChange={(nextFac) => {
                      setAddFacultyId(nextFac);
                      const firstDept = snapshot.departments.find((d) => d.faculty_id === nextFac);
                      if (firstDept) setAddDepartmentId(firstDept.id);
                    }}
                  />
                  <CustomDropdown
                    name="department_id"
                    label="Department"
                    value={addDepartmentId}
                    options={snapshot.departments
                      .filter((d) => !addFacultyId || d.faculty_id === addFacultyId)
                      .map((d) => ({ value: d.id, label: d.name }))}
                    onChange={setAddDepartmentId}
                    required
                  />
                  <label className={styles.fieldLabel}>
                    <span>Programme</span>
                    <input name="programme" className={styles.fieldInput} maxLength={160} placeholder="e.g. Computer Science" />
                  </label>
                  <label className={styles.fieldLabel}>
                    <span>Academic level</span>
                    <input name="level" className={styles.fieldInput} inputMode="numeric" required maxLength={40} placeholder="e.g. 300" />
                  </label>
                  <label className={styles.fieldLabel}>
                    <span>Phone contact (optional)</span>
                    <input name="phone" type="tel" inputMode="tel" className={styles.fieldInput} maxLength={20} placeholder="+234 800 000 0000" />
                  </label>
                  <label className={styles.fieldLabel}>
                    <span>Email address (optional)</span>
                    <input name="email" type="email" inputMode="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} className={styles.fieldInput} maxLength={254} placeholder="student@university.edu" />
                  </label>
                </div>

                {formFeedback ? <FeedbackNotice ok={formFeedback.ok} message={formFeedback.message} /> : null}

                <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", flexWrap: "wrap" }}>
                  <button type="button" className={styles.actionSecondary} onClick={() => setActiveModal(null)}>
                    Cancel
                  </button>
                  <button type="submit" className={styles.actionPrimary} disabled={formBusy}>
                    {formBusy ? "Registering student…" : "Register student"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : null}

      {/* Import Students Modal */}
      {activeModal === "import" ? (
        <div className={styles.modalBackdrop} role="dialog" aria-modal="true" aria-labelledby="import-students-title">
          <div className={styles.modalPanel}>
            <div className={styles.modalHeader}>
              <div>
                <h2 id="import-students-title">Import students</h2>
                <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#647087" }}>
                  Preview, validate duplicates, and import student rosters from CSV.
                </p>
              </div>
              <button
                type="button"
                className={styles.modalCloseBtn}
                aria-label="Close import students modal"
                onClick={() => setActiveModal(null)}
              >
                <X size={18} />
              </button>
            </div>
            {snapshot.courses.length > 0 ? (
              <EnrollmentForm snapshot={snapshot} />
            ) : (
              <FeedbackNotice
                ok={false}
                message="Create at least one course before importing a course roster CSV, or use Add New Student to register students directly."
              />
            )}
          </div>
        </div>
      ) : null}

      {/* Share Registration Link Modal */}
      {activeModal === "share" ? (
        <div className={styles.modalBackdrop} role="dialog" aria-modal="true" aria-labelledby="share-links-title">
          <div className={styles.modalPanel}>
            <div className={styles.modalHeader}>
              <div>
                <h2 id="share-links-title">Share registration link</h2>
                <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#647087" }}>
                  Students register once using your institution’s link—no TuRnMaRk account required.
                </p>
              </div>
              <button
                type="button"
                className={styles.modalCloseBtn}
                aria-label="Close share links modal"
                onClick={() => setActiveModal(null)}
              >
                <X size={18} />
              </button>
            </div>
            <StudentAccessLinks
              organizationId={snapshot.organization.id}
              organizationName={snapshot.organization.name}
            />
          </div>
        </div>
      ) : null}

      {/* Toast Notification */}
      {toast ? (
        <div className={styles.toast} role="status" aria-live="polite">
          <FeedbackNotice ok={toast.ok} message={toast.message} />
        </div>
      ) : null}
    </main>
  );
}
