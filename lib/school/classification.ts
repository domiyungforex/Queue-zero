export interface FacultyItem {
  id: string;
  name: string;
}

export interface DepartmentItem {
  id: string;
  faculty_id: string;
  name: string;
}

export interface ClassificationMatchResult<T> {
  status: "EXACT" | "ALIAS" | "AMBIGUOUS" | "UNMATCHED";
  matched: T | null;
  candidates: T[];
  normalizedInput: string;
}

const DEPARTMENT_ALIASES: Record<string, string[]> = {
  "computer science": ["csc", "cs", "comp sci", "computing"],
  "electrical engineering": ["eee", "ee", "elect elect", "electrical"],
  "mechanical engineering": ["mee", "me", "mech eng"],
  "civil engineering": ["cve", "ce", "civil"],
  "mathematics": ["mth", "math", "maths"],
  "physics": ["phy", "phys"],
  "chemistry": ["chm", "chem"],
  "biology": ["bio", "biol", "biological sciences"],
  "biochemistry": ["bch", "biochem"],
  "accounting": ["acc", "acct"],
  "business administration": ["bus", "bus admin", "bba"],
  "economics": ["eco", "econ"],
  "mass communication": ["mcm", "mass comm"],
};

export function normalizeFacultyName(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[.,]/g, " ")
    .replace(/\b(faculty|school|college)\s+of\b/g, " ")
    .replace(/\b(faculty|school|college)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeDepartmentName(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[.,]/g, " ")
    .replace(/\b(department|dept)\s+of\b/g, " ")
    .replace(/\b(department|dept)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function matchFaculty(
  rawInput: string,
  faculties: FacultyItem[],
): ClassificationMatchResult<FacultyItem> {
  const normalizedInput = normalizeFacultyName(rawInput);
  if (!normalizedInput) {
    return { status: "UNMATCHED", matched: null, candidates: [], normalizedInput };
  }

  const exact = faculties.find(
    (f) => f.name.trim().toLowerCase() === rawInput.trim().toLowerCase() || normalizeFacultyName(f.name) === normalizedInput,
  );
  if (exact) {
    return { status: "EXACT", matched: exact, candidates: [exact], normalizedInput };
  }

  const partial = faculties.filter((f) => {
    const norm = normalizeFacultyName(f.name);
    return norm.includes(normalizedInput) || normalizedInput.includes(norm);
  });

  if (partial.length === 1) {
    return { status: "ALIAS", matched: partial[0], candidates: partial, normalizedInput };
  }
  if (partial.length > 1) {
    return { status: "AMBIGUOUS", matched: null, candidates: partial, normalizedInput };
  }
  return { status: "UNMATCHED", matched: null, candidates: [], normalizedInput };
}

export function matchDepartment(
  rawInput: string,
  facultyId: string | null,
  departments: DepartmentItem[],
): ClassificationMatchResult<DepartmentItem> {
  const normalizedInput = normalizeDepartmentName(rawInput);
  if (!normalizedInput) {
    return { status: "UNMATCHED", matched: null, candidates: [], normalizedInput };
  }

  // Enforce faculty boundary so unrelated cross-faculty matches are never returned
  const scoped = facultyId ? departments.filter((d) => d.faculty_id === facultyId) : departments;

  const exact = scoped.find(
    (d) =>
      d.name.trim().toLowerCase() === rawInput.trim().toLowerCase() ||
      normalizeDepartmentName(d.name) === normalizedInput,
  );
  if (exact) {
    return { status: "EXACT", matched: exact, candidates: [exact], normalizedInput };
  }

  // Alias match (e.g. "CSC" -> "Computer Science")
  const aliasMatches = scoped.filter((d) => {
    const normDept = normalizeDepartmentName(d.name);
    const aliases = DEPARTMENT_ALIASES[normDept] ?? [];
    if (aliases.includes(normalizedInput)) return true;
    return normDept.includes(normalizedInput) || normalizedInput.includes(normDept);
  });

  if (aliasMatches.length === 1) {
    return { status: "ALIAS", matched: aliasMatches[0], candidates: aliasMatches, normalizedInput };
  }
  if (aliasMatches.length > 1) {
    return { status: "AMBIGUOUS", matched: null, candidates: aliasMatches, normalizedInput };
  }

  return { status: "UNMATCHED", matched: null, candidates: [], normalizedInput };
}
