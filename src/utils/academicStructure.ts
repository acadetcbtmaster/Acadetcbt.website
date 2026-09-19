import {
  Course,
  Department,
  Faculty,
  FacultyGroup,
  University,
} from '../types';

export const ACADEMIC_LEVELS = [
  '100 Level',
  '200 Level',
  '300 Level',
  '400 Level',
  '500 Level',
  '600 Level',
] as const;

export type AcademicLevel = typeof ACADEMIC_LEVELS[number];

export const ACADEMIC_SEMESTERS = [
  'First Semester',
  'Second Semester',
] as const;

export type AcademicSemester = typeof ACADEMIC_SEMESTERS[number];

export function normalizeLevel(level?: string): string {
  if (!level) return '100 Level';
  const clean = level.toString().trim();
  if (clean.startsWith('100') || clean.toLowerCase().includes('100')) return '100 Level';
  if (clean.startsWith('200') || clean.toLowerCase().includes('200')) return '200 Level';
  if (clean.startsWith('300') || clean.toLowerCase().includes('300')) return '300 Level';
  if (clean.startsWith('400') || clean.toLowerCase().includes('400')) return '400 Level';
  if (clean.startsWith('500') || clean.toLowerCase().includes('500')) return '500 Level';
  if (clean.startsWith('600') || clean.toLowerCase().includes('600')) return '600 Level';
  return '100 Level';
}

export function normalizeSemester(semester?: string): string {
  if (!semester) return 'First Semester';
  const clean = semester.toString().trim().toLowerCase();
  if (
    clean === 'first' ||
    clean === 'first semester' ||
    clean === '1st' ||
    clean.includes('1st') ||
    clean.includes('first')
  ) {
    return 'First Semester';
  }
  if (
    clean === 'second' ||
    clean === 'second semester' ||
    clean === '2nd' ||
    clean.includes('2nd') ||
    clean.includes('second')
  ) {
    return 'Second Semester';
  }
  return 'First Semester';
}

/**
 * Universal university ID matcher resolving compatibility between Supabase UUIDs and legacy Firestore IDs
 */
export function isMatchingUniversityId(idA?: string, idB?: string): boolean {
  if (!idA || !idB || idA === 'all' || idB === 'all') return true;
  if (idA === idB) return true;
  const isFulA = idA === 'uni-ful' || idA === '963a2101-99ec-4f24-a3d4-d744cbc22b87';
  const isFulB = idB === 'uni-ful' || idB === '963a2101-99ec-4f24-a3d4-d744cbc22b87';
  if (isFulA && isFulB) return true;
  const isFuahseA = idA === 'uni-fuahse' || idA === '05e96031-bc94-44e5-a8c5-611644dba5ba';
  const isFuahseB = idB === 'uni-fuahse' || idB === '05e96031-bc94-44e5-a8c5-611644dba5ba';
  if (isFuahseA && isFuahseB) return true;
  return false;
}

/**
 * Universal department ID matcher resolving compatibility between Supabase UUIDs and legacy Firestore IDs
 */
export function isMatchingDepartmentId(idA?: string, idB?: string): boolean {
  if (!idA || !idB || idA === 'all' || idB === 'all') return true;
  if (idA === idB) return true;
  const is100A = idA === 'dept-1' || idA === '297656eb-016e-410a-ac72-fda4b1e704f1';
  const is100B = idB === 'dept-1' || idB === '297656eb-016e-410a-ac72-fda4b1e704f1';
  if (is100A && is100B) return true;
  return false;
}

/**
 * Universal faculty ID matcher resolving compatibility between Supabase UUIDs and legacy Firestore IDs
 */
export function isMatchingFacultyId(idA?: string, idB?: string): boolean {
  if (!idA || !idB || idA === 'all' || idB === 'all') return true;
  if (idA === idB) return true;
  const is100FacA = idA === 'fac-100-fuahse' || idA === 'fac-1' || idA === '4a7996d7-ce9b-42da-a809-04bec2924b04';
  const is100FacB = idB === 'fac-100-fuahse' || idB === 'fac-1' || idB === '4a7996d7-ce9b-42da-a809-04bec2924b04';
  if (is100FacA && is100FacB) return true;
  return false;
}

/**
 * Returns strictly the faculties registered in the database for the given university.
 * If no faculties are saved in the database for this university, returns an empty array.
 */
export function getFacultiesForUniversity(
  universityId?: string,
  registeredFaculties: Faculty[] = []
): Faculty[] {
  if (!Array.isArray(registeredFaculties) || registeredFaculties.length === 0) {
    return [];
  }
  if (!universityId || universityId === 'all') {
    return registeredFaculties;
  }

  // Return ONLY explicit faculties saved in database for this university (or common/all faculties)
  return registeredFaculties.filter(
    (f) => !f.universityId || f.universityId === 'all' || isMatchingUniversityId(f.universityId, universityId)
  );
}

/**
 * Returns strictly the departments registered in the database belonging to a specific Faculty and University.
 * If no departments are saved in the database for this faculty, returns an empty array.
 */
export function getDepartmentsForFaculty(
  facultyId?: string,
  universityId?: string,
  registeredDepartments: Department[] = [],
  _registeredFaculties: Faculty[] = []
): Department[] {
  if (!Array.isArray(registeredDepartments) || registeredDepartments.length === 0) {
    return [];
  }

  if (!facultyId || facultyId === 'all') {
    if (universityId && universityId !== 'all') {
      return registeredDepartments.filter(
        (d) => !d.universityId || d.universityId === 'all' || isMatchingUniversityId(d.universityId, universityId)
      );
    }
    return registeredDepartments;
  }

  // Return ONLY registered database departments matching facultyId
  return registeredDepartments.filter((d) => {
    if (d.facultyId !== facultyId) return false;
    if (
      universityId &&
      universityId !== 'all' &&
      d.universityId &&
      d.universityId !== 'all' &&
      !isMatchingUniversityId(d.universityId, universityId)
    ) {
      return false;
    }
    return true;
  });
}

/**
 * Discipline code prefix map for intelligent department matching
 */
const DISCIPLINE_PREFIX_MAP: Record<string, string[]> = {
  'Medicine and Surgery': ['MED', 'SUR', 'CLN'],
  'Nursing Science': ['NUR', 'NSC'],
  'Radiography and Radiation Science': ['RAD', 'RSC'],
  'Physiotherapy': ['PHT', 'PST'],
  'Medical Laboratory Science': ['MLS', 'MLB'],
  'Human Anatomy': ['ANA', 'ANT'],
  'Human Physiology': ['PIO', 'PHS', 'PHYSIO'],
  'Human Nutrition and Dietetics': ['NUT', 'HND'],
  'Public Health': ['PBH', 'PUH', 'EHS'],
  'Health Information Management': ['HIM', 'HIT'],
  'Biomedical Engineering': ['BME', 'BIE'],
  'General Studies Unit': ['GST', 'GES', 'GNS', 'GSE'],
  'General Studies': ['GST', 'GES', 'GNS', 'GSE'],
  'Mathematics': ['MTH', 'MAT'],
  'Physics': ['PHY'],
  'Computer Science': ['COS', 'CSC', 'CMP', 'CPT'],
  'Chemistry': ['CHM', 'CHE'],
  'History and International Studies': ['HIS'],
  'Economics': ['ECO', 'ECN'],
  'Sociology': ['SOC'],
  'Biochemistry': ['BCH', 'BIO'],
  'Microbiology': ['MCB', 'MIC'],
  'Geology': ['GLY', 'GEO'],
};

/**
 * Filter courses with strict hierarchical precision:
 * FACULTY -> DEPARTMENT -> LEVEL -> SEMESTER -> COURSE
 *
 * Rules:
 * - A course from another department or faculty must NEVER appear.
 * - First Semester and Second Semester courses must NEVER be mixed.
 * - 'All' respects the parent scope (e.g. All Departments in Faculty of Science only returns Science courses).
 * - No loose cross-department fallback matching.
 */
export function getCoursesForHierarchy({
  universityId,
  facultyId,
  departmentId,
  level,
  semester,
  allCourses = [],
  faculties = [],
  departments = [],
}: {
  universityId?: string;
  facultyId?: string;
  departmentId?: string;
  level?: string;
  semester?: string;
  allCourses: Course[];
  allUniversities?: University[];
  faculties?: Faculty[];
  departments?: Department[];
  includeAllFallback?: boolean;
}): Course[] {
  if (!Array.isArray(allCourses) || allCourses.length === 0) return [];

  // Determine allowed department IDs for the selected faculty if department is 'all'
  let facultyDepartmentIds: Set<string> | null = null;
  if (facultyId && facultyId !== 'all' && (!departmentId || departmentId === 'all') && Array.isArray(departments) && departments.length > 0) {
    const matchingDepts = departments.filter((d) => d.facultyId === facultyId);
    if (matchingDepts.length > 0) {
      facultyDepartmentIds = new Set(matchingDepts.map((d) => d.id));
    }
  }

  const targetLevel = level && level !== 'all' ? normalizeLevel(level) : null;
  const targetSemester = semester && semester !== 'all' ? normalizeSemester(semester) : null;

  return allCourses.filter((c) => {
    // 1. University Filter (if scoped)
    if (universityId && universityId !== 'all') {
      if (c.universityId && !isMatchingUniversityId(c.universityId, universityId)) {
        return false;
      }
    }

    // 2. Faculty Filter (Step 1)
    if (facultyId && facultyId !== 'all') {
      if (c.facultyId) {
        if (!isMatchingFacultyId(c.facultyId, facultyId)) return false;
      } else if (facultyDepartmentIds && c.departmentId) {
        const matchesAny = Array.from(facultyDepartmentIds).some((fid) => isMatchingDepartmentId(fid, c.departmentId));
        if (!facultyDepartmentIds.has(c.departmentId) && !matchesAny) return false;
      }
    }

    // 3. Department Filter (Step 2)
    if (departmentId && departmentId !== 'all') {
      if (c.departmentId && !isMatchingDepartmentId(c.departmentId, departmentId)) {
        return false;
      }
    }

    // 4. Level Filter (Step 3)
    if (targetLevel) {
      if (c.level && normalizeLevel(c.level) !== targetLevel) {
        return false;
      }
    }

    // 5. Semester Filter (Step 4) - Strictly isolated: 1st and 2nd semester NEVER mix
    if (targetSemester) {
      if (c.semester && normalizeSemester(c.semester) !== targetSemester) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Filter questions with strict hierarchical precision:
 * FACULTY -> DEPARTMENT -> LEVEL -> SEMESTER -> COURSE -> QUESTIONS
 */
export function getQuestionsForHierarchy({
  universityId,
  facultyId,
  departmentId,
  level,
  semester,
  courseId,
  questions = [],
  courses = [],
  departments = [],
}: {
  universityId?: string;
  facultyId?: string;
  departmentId?: string;
  level?: string;
  semester?: string;
  courseId?: string;
  questions?: any[];
  courses?: Course[];
  faculties?: Faculty[];
  departments?: Department[];
}): any[] {
  if (!Array.isArray(questions) || questions.length === 0) return [];

  // Build course lookup for fast hierarchical resolution
  const courseMap = new Map<string, Course>();
  courses.forEach((c) => courseMap.set(c.id, c));

  let facultyDepartmentIds: Set<string> | null = null;
  if (facultyId && facultyId !== 'all' && (!departmentId || departmentId === 'all') && Array.isArray(departments) && departments.length > 0) {
    const matchingDepts = departments.filter((d) => d.facultyId === facultyId);
    if (matchingDepts.length > 0) {
      facultyDepartmentIds = new Set(matchingDepts.map((d) => d.id));
    }
  }

  const targetLevel = level && level !== 'all' ? normalizeLevel(level) : null;
  const targetSemester = semester && semester !== 'all' ? normalizeSemester(semester) : null;

  return questions.filter((q) => {
    const courseObj = q.courseId ? courseMap.get(q.courseId) : undefined;
    const qFacultyId = q.facultyId || courseObj?.facultyId;
    const qDeptId = q.departmentId || courseObj?.departmentId;
    const qLevel = q.level || courseObj?.level;
    const qSemester = q.semester || courseObj?.semester;
    const qUniId = q.universityId || courseObj?.universityId;

    // 1. University filter
    if (universityId && universityId !== 'all') {
      if (qUniId && !isMatchingUniversityId(qUniId, universityId)) return false;
    }

    // 2. Faculty filter
    if (facultyId && facultyId !== 'all') {
      if (qFacultyId) {
        if (!isMatchingFacultyId(qFacultyId, facultyId)) return false;
      } else if (facultyDepartmentIds && qDeptId) {
        const matchesAny = Array.from(facultyDepartmentIds).some((fid) => isMatchingDepartmentId(fid, qDeptId));
        if (!facultyDepartmentIds.has(qDeptId) && !matchesAny) return false;
      }
    }

    // 3. Department filter
    if (departmentId && departmentId !== 'all') {
      if (qDeptId && !isMatchingDepartmentId(qDeptId, departmentId)) return false;
    }

    // 4. Level filter
    if (targetLevel) {
      if (qLevel && normalizeLevel(qLevel) !== targetLevel) return false;
    }

    // 5. Semester filter
    if (targetSemester) {
      if (qSemester && normalizeSemester(qSemester) !== targetSemester) return false;
    }

    // 6. Course filter
    if (courseId && courseId !== 'all') {
      if (q.courseId && q.courseId !== courseId) return false;
    }

    return true;
  });
}

/**
 * Returns human-readable academic breadcrumb string
 */
export function formatAcademicBreadcrumb({
  universityName,
  facultyName,
  departmentName,
  level,
  semester,
  courseCode,
}: {
  universityName?: string;
  facultyName?: string;
  departmentName?: string;
  level?: string;
  semester?: string;
  courseCode?: string;
}): string {
  const parts: string[] = [];
  if (universityName) parts.push(universityName);
  if (facultyName) parts.push(facultyName);
  if (departmentName) parts.push(departmentName);
  if (level) parts.push(level);
  if (semester) parts.push(semester);
  if (courseCode) parts.push(courseCode);
  return parts.join(' › ');
}
