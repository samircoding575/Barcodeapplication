export const MIN_GRADE_HUNDREDTHS = 0
// MAX_GRADE_HUNDREDTHS is now per-session (stored in ExamSession.maxGrade).
// This fallback is used only when no active session is available.
export const FALLBACK_MAX_GRADE_HUNDREDTHS = 2000

export interface Student {
  id: string
  externalId: string
  name: string
  createdAt: string
}

export interface ExamSession {
  id: string
  title: string
  year: number
  semester?: string | null
  maxGrade: number        // in hundredths, e.g. 2000 = 20.00
  step: string            // '1' | '0.5' | '0.25'
  passingGrade: number    // in hundredths, e.g. 1000 = 10.00
  maxPassCount: number | null  // null = no quota
  isActive: boolean
  createdAt: string
}

export interface AppConfig {
  orgName: string
  orgNameAr: string
  defaultMaxGrade: number  // in hundredths
  defaultStep: string      // '1' | '0.5' | '0.25'
}

export interface AdminBarcode {
  id: string
  token: string
  studentId: string
  student: { externalId: string; name: string }
  graded: boolean
  gradeValue: number | null
  gradedAt: string | null
}

export interface TeacherSafeBarcode {
  token: string
}

export interface GradeResult {
  id: string
  value: number
  gradedAt: string
  barcode: {
    token: string
    student: { externalId: string; name: string }
  }
}

export interface TeacherProgressItem {
  token: string
  graded: boolean
}

export interface MasterCandidate {
  id: string
  externalId: string
  name: string
  token: string | null
  graded: boolean
  gradeValue: number | null
  gradedAt: string | null
}

export interface AuthUser {
  id: string
  email: string
  role: 'ADMIN' | 'TEACHER'
}

export interface ExaminerAccount {
  id: string
  email: string
  createdAt: string
}

export interface SystemStats {
  totalSessions: number
  totalStudents: number
  totalGrades: number
  totalExaminers: number
}

export type CandidateOutcome = 'admitted' | 'eligible_not_admitted' | 'failed' | 'ungraded'

export interface CandidateResult {
  rank: number | null
  externalId: string
  name: string
  token: string
  grade: number | null  // in hundredths, null if ungraded
  outcome: CandidateOutcome
}

export interface GradeDistributionBucket {
  label: string       // e.g. '0–2'
  from: number        // in hundredths
  to: number          // in hundredths
  count: number
}

export interface DashboardData {
  sessionId: string
  totalCandidates: number
  gradedCount: number
  ungradedCount: number
  admittedCount: number
  eligibleNotAdmittedCount: number
  failedCount: number
  passRate: number         // 0–100
  avgGrade: number | null  // in hundredths
  medianGrade: number | null
  highestGrade: number | null
  lowestGrade: number | null
  stdDev: number | null
  distribution: GradeDistributionBucket[]
  candidates: CandidateResult[]
}

export type Role = 'admin' | 'teacher'

export function formatGrade(hundredths: number): string {
  return (hundredths / 100).toFixed(2)
}

export function parseGradeInput(input: string): number {
  const n = parseFloat(input.replace(',', '.'))
  if (isNaN(n)) return NaN
  return Math.round(n * 100)
}

export interface WindowAPI {
  admin: {
    importStudents: (data: { sessionId: string }) => Promise<{ success: boolean; count: number; barcodesGenerated: number; error?: string }>
    addStudent: (data: { externalId: string; name: string; sessionId: string }) => Promise<{ success: boolean; student?: Student; error?: string }>
    deleteStudent: (data: { id: string }) => Promise<{ success: boolean; error?: string }>
    getStudents: () => Promise<Student[]>
    generateBarcodeBatch: (data: { sessionId: string }) => Promise<{ count: number; error?: string }>
    listBarcodes: (data: { sessionId: string }) => Promise<AdminBarcode[]>
    getResults: (data: { sessionId: string }) => Promise<GradeResult[]>
    exportCsv: (data: { sessionId: string; sessionLabel: string }) => Promise<{ success: boolean; path?: string }>
    getMasterView: (data: { sessionId: string }) => Promise<MasterCandidate[]>
    listExaminers: () => Promise<ExaminerAccount[]>
    deleteExaminer: (data: { id: string }) => Promise<{ success: boolean; error?: string }>
    clearSessionGrades: (data: { sessionId: string }) => Promise<{ success: boolean; count: number; error?: string }>
    resetSystem: () => Promise<{ success: boolean; error?: string }>
    getSystemStats: () => Promise<SystemStats>
    getConfig: () => Promise<AppConfig>
    updateConfig: (data: Partial<AppConfig>) => Promise<{ success: boolean; error?: string }>
    getDashboardData: (data: { sessionId: string }) => Promise<DashboardData>
    updateSessionThresholds: (data: { sessionId: string; passingGrade: number; maxPassCount: number | null }) => Promise<{ success: boolean; error?: string }>
  }
  teacher: {
    lookupToken: (data: { token: string }) => Promise<{ valid: boolean; alreadyGraded?: boolean | null; currentGrade?: number | null }>
    saveGrade: (data: { token: string; value: number }) => Promise<{ success: boolean; error?: string }>
    undoLast: () => Promise<{ success: boolean; token?: string }>
    importPreview: () => Promise<ImportPreview | null>
    importCommit: (data: { rows: ValidatedRow[]; acceptedStatuses: RowStatus[] }) => Promise<{ committed: number }>
    listProgress: () => Promise<TeacherProgressItem[]>
  }
  file: {
    saveCsv: (data: { content: string; defaultName: string }) => Promise<{ success: boolean; path?: string }>
  }
  auth: {
    adminLogin: (data: { email: string; password: string }) => Promise<{ success: boolean; user?: AuthUser; error?: string }>
    employeeLogin: (data: { email: string; password: string }) => Promise<{ success: boolean; user?: AuthUser; error?: string }>
    employeeSignup: (data: { email: string; password: string }) => Promise<{ success: boolean; user?: AuthUser; error?: string }>
    logout: () => Promise<{ success: boolean }>
  }
  session: {
    list: () => Promise<ExamSession[]>
    getActive: () => Promise<ExamSession | null>
    create: (data: { title: string; year: number; semester?: string | null; maxGrade?: number; step?: string; passingGrade?: number; maxPassCount?: number | null }) => Promise<{ success: boolean; session?: ExamSession; error?: string }>
    setActive: (data: { id: string }) => Promise<{ success: boolean; error?: string }>
    delete: (data: { id: string }) => Promise<{ success: boolean; error?: string }>
  }
}

export type RowStatus = 'ok' | 'unknown_token' | 'already_graded' | 'invalid_grade' | 'duplicate_in_file'

export interface ValidatedRow {
  token: string
  status: RowStatus
  proposedValue: number
  currentValue?: number | null
  message?: string | null
}

export interface ImportPreview {
  rows: ValidatedRow[]
  summary: { ok: number; conflicts: number; errors: number }
}
