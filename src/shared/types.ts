export const MIN_GRADE_HUNDREDTHS = 0
// FALLBACK_MAX_GRADE_HUNDREDTHS is used only when no exam context is available.
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
  isActive: boolean
  createdAt: string
  exams?: Exam[]
}

export interface Exam {
  id: string
  sessionId: string
  name: string
  order: number
  maxGrade: number       // in hundredths, e.g. 2000 = 20.00
  step: string           // '1' | '0.5' | '0.25'
  passingGrade: number   // in hundredths, e.g. 1000 = 10.00
  maxPassCount: number | null
  createdAt: string
}

export interface AppConfig {
  orgName: string
  orgNameAr: string
  printTopMm: number
  printLeftMm: number
  printStickerW: number
  printStickerH: number
}

export interface AdminBarcode {
  id: string
  token: string
  studentId: string
  examId: string
  examName: string
  student: { externalId: string; name: string }
  graded: boolean
  gradeValue: number | null
  gradedAt: string | null
  isModified: boolean
}

export interface TeacherSafeBarcode {
  token: string
}

export interface GradeResult {
  id: string
  barcodeId: string
  value: number
  gradedAt: string
  isModified: boolean
  originalValue: number | null
  modifiedById: string | null
  modifiedReason: string | null
  modifiedAt: string | null
  barcode: {
    token: string
    examId: string
    examName: string
    student: { externalId: string; name: string }
  }
}

export interface TeacherProgressItem {
  token: string
  graded: boolean
  isModified: boolean
}

export interface MasterCandidate {
  id: string
  externalId: string
  name: string
  barcodes: {
    examId: string
    examName: string
    token: string
    graded: boolean
    gradeValue: number | null
    gradedAt: string | null
    isModified: boolean
  }[]
}

export interface AuthUser {
  id: string
  email: string
  role: 'ADMIN' | 'USER1'
}

export interface User1Account {
  id: string
  email: string
  role: string
  createdAt: string
}

export interface SystemStats {
  totalSessions: number
  totalStudents: number
  totalGrades: number
  totalUsers: number
}

export type CandidateOutcome = 'admitted' | 'eligible_not_admitted' | 'failed' | 'ungraded'

export interface CandidateResult {
  rank: number | null
  externalId: string
  name: string
  token: string
  barcodeId: string
  grade: number | null  // in hundredths, null if ungraded
  outcome: CandidateOutcome
  isModified: boolean
  modifiedById: string | null
  modifiedReason: string | null
}

export interface GradeDistributionBucket {
  label: string  // e.g. '0–2'
  from: number   // in hundredths
  to: number     // in hundredths
  count: number
}

export interface ExamDashboardSummary {
  examId: string
  examName: string
  totalCandidates: number
  attendedCount: number
  modifiedGradeCount: number
  passedCount: number
  failedCount: number
  avgGrade: number | null
  passRate: number
  admittedCount: number
  eligibleNotAdmittedCount: number
  medianGrade: number | null
  highestGrade: number | null
  lowestGrade: number | null
  stdDev: number | null
  distribution: GradeDistributionBucket[]
  candidates: CandidateResult[]
}

export interface DashboardData {
  sessionId: string
  examId: string | null  // null = all exams rollup
  exams: ExamDashboardSummary[]
  // Active (filtered) summary — either a single exam or session-wide rollup
  totalCandidates: number
  attendedCount: number
  modifiedGradeCount: number
  gradedCount: number
  ungradedCount: number
  admittedCount: number
  eligibleNotAdmittedCount: number
  failedCount: number
  passRate: number
  avgGrade: number | null
  medianGrade: number | null
  highestGrade: number | null
  lowestGrade: number | null
  stdDev: number | null
  distribution: GradeDistributionBucket[]
  candidates: CandidateResult[]
}

export interface GradeLogEntry {
  id: string           // Grade.id
  barcodeId: string
  token: string
  examName: string
  studentExternalId: string
  studentName: string
  originalValue: number
  newValue: number
  modifiedReason: string
  modifiedAt: string
  modifiedByEmail: string
}

export type Role = 'admin' | 'user1'

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
    importStudents: (data: { sessionId: string; examIds: string[] }) => Promise<{ success: boolean; count: number; barcodesGenerated: number; error?: string }>
    addStudent: (data: { externalId: string; name: string; examIds: string[] }) => Promise<{ success: boolean; student?: Student; error?: string }>
    deleteStudent: (data: { id: string }) => Promise<{ success: boolean; error?: string }>
    deleteStudentsBatch: (data: { ids: string[] }) => Promise<{ success: boolean; count?: number; error?: string }>
    getStudents: () => Promise<Student[]>
    generateBarcodeBatch: (data: { examId: string }) => Promise<{ count: number; error?: string }>
    listBarcodes: (data: { sessionId: string; examId?: string }) => Promise<AdminBarcode[]>
    getResults: (data: { sessionId: string; examId?: string }) => Promise<GradeResult[]>
    exportCsv: (data: { sessionId: string; sessionLabel: string }) => Promise<{ success: boolean; path?: string }>
    exportXlsx: (data: { sessionId: string; sessionLabel: string }) => Promise<{ success: boolean; path?: string; error?: string }>
    getMasterView: (data: { sessionId: string; examId?: string }) => Promise<MasterCandidate[]>
    listUsers: () => Promise<User1Account[]>
    deleteUser: (data: { id: string }) => Promise<{ success: boolean; error?: string }>
    clearSessionGrades: (data: { sessionId: string }) => Promise<{ success: boolean; count: number; error?: string }>
    resetSystem: () => Promise<{ success: boolean; error?: string }>
    getSystemStats: () => Promise<SystemStats>
    getConfig: () => Promise<AppConfig>
    updateConfig: (data: Partial<AppConfig>) => Promise<{ success: boolean; error?: string }>
    getDashboardData: (data: { sessionId: string; examId?: string }) => Promise<DashboardData>
    modifyGrade: (data: { barcodeId: string; newValue: number; reason: string }) => Promise<{ success: boolean; error?: string }>
    getGradeLog: (data: { sessionId?: string; examId?: string }) => Promise<GradeLogEntry[]>
    exportBarcodesDocx: (data: { records: Array<{ token: string; studentName: string; externalId: string; examName: string }> }) => Promise<{ success?: boolean; canceled?: boolean; error?: string }>
  }
  exam: {
    list: (data: { sessionId: string }) => Promise<Exam[]>
    create: (data: { sessionId: string; name: string; order: number; maxGrade: number; step: string; passingGrade: number; maxPassCount?: number | null }) => Promise<{ success: boolean; exam?: Exam; error?: string }>
    update: (data: { examId: string; name?: string; order?: number; maxGrade?: number; step?: string; passingGrade?: number; maxPassCount?: number | null }) => Promise<{ success: boolean; error?: string }>
    delete: (data: { examId: string }) => Promise<{ success: boolean; error?: string }>
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
    user1Login: (data: { email: string; password: string }) => Promise<{ success: boolean; user?: AuthUser; error?: string }>
    user1Signup: (data: { email: string; password: string }) => Promise<{ success: boolean; user?: AuthUser; error?: string }>
    logout: () => Promise<{ success: boolean }>
  }
  session: {
    list: () => Promise<ExamSession[]>
    getActive: () => Promise<ExamSession | null>
    create: (data: { title: string; year: number; semester?: string | null }) => Promise<{ success: boolean; session?: ExamSession; error?: string }>
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
