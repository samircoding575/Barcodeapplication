import { z } from 'zod'

export const AuthChannels = {
  ADMIN_LOGIN: 'auth/admin-login',
  EMPLOYEE_LOGIN: 'auth/employee-login',
  EMPLOYEE_SIGNUP: 'auth/employee-signup',
  LOGOUT: 'auth/logout',
} as const

export const SessionChannels = {
  LIST: 'session/list',
  GET_ACTIVE: 'session/get-active',
  CREATE: 'session/create',
  SET_ACTIVE: 'session/set-active',
  DELETE: 'session/delete',
} as const

export const AdminChannels = {
  IMPORT_STUDENTS: 'admin/import-students',
  ADD_STUDENT: 'admin/add-student',
  DELETE_STUDENT: 'admin/delete-student',
  GET_STUDENTS: 'admin/get-students',
  GENERATE_BARCODE_BATCH: 'admin/generate-barcode-batch',
  LIST_BARCODES: 'admin/list-barcodes',
  GET_RESULTS: 'admin/get-results',
  EXPORT_CSV: 'admin/export-csv',
  GET_MASTER_VIEW: 'admin/get-master-view',
} as const

export const TeacherChannels = {
  LOOKUP_TOKEN: 'teacher/lookup-token',
  SAVE_GRADE: 'teacher/save-grade',
  UNDO_LAST: 'teacher/undo-last',
  IMPORT_PREVIEW: 'teacher/import/preview',
  IMPORT_COMMIT: 'teacher/import/commit',
  LIST_PROGRESS: 'teacher/list-progress',
} as const

export const FileChannels = {
  SAVE_CSV: 'file/save-csv',
} as const

export const ConfigChannels = {
  GET: 'config/get',
  UPDATE: 'config/update',
} as const

// Zod schemas — anonymity contract on Teacher channels
export const LookupTokenResponseSchema = z.object({
  valid: z.boolean(),
  alreadyGraded: z.boolean().nullish(),
  currentGrade: z.number().int().nullish(),
})

export const RowStatusSchema = z.enum([
  'ok',
  'unknown_token',
  'already_graded',
  'invalid_grade',
  'duplicate_in_file',
])

export const ValidatedRowSchema = z.object({
  token: z.string(),
  status: RowStatusSchema,
  proposedValue: z.number().int(),
  currentValue: z.number().int().nullish(),
  message: z.string().nullish(),
})

export const ImportPreviewSchema = z.object({
  rows: z.array(ValidatedRowSchema),
  summary: z.object({ ok: z.number(), conflicts: z.number(), errors: z.number() }),
})

// Anonymity contract: token + graded only — no names or externalId
export const TeacherProgressItemSchema = z.object({
  token: z.string(),
  graded: z.boolean(),
})
