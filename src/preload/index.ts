import { contextBridge, ipcRenderer } from 'electron'
import {
  AdminChannels, TeacherChannels, FileChannels,
  AuthChannels, SessionChannels, ExamChannels,
} from '@shared/ipc'
import type { ValidatedRow, RowStatus, AppConfig } from '@shared/types'

const api = {
  admin: {
    importStudents: (data: { sessionId: string; examIds: string[] }) => ipcRenderer.invoke(AdminChannels.IMPORT_STUDENTS, data),
    addStudent: (data: { externalId: string; name: string; examIds: string[] }) => ipcRenderer.invoke(AdminChannels.ADD_STUDENT, data),
    deleteStudent: (data: { id: string }) => ipcRenderer.invoke(AdminChannels.DELETE_STUDENT, data),
    deleteStudentsBatch: (data: { ids: string[] }) => ipcRenderer.invoke(AdminChannels.DELETE_STUDENTS_BATCH, data),
    getStudents: () => ipcRenderer.invoke(AdminChannels.GET_STUDENTS),
    generateBarcodeBatch: (data: { examId: string }) => ipcRenderer.invoke(AdminChannels.GENERATE_BARCODE_BATCH, data),
    listBarcodes: (data: { sessionId: string; examId?: string }) => ipcRenderer.invoke(AdminChannels.LIST_BARCODES, data),
    getResults: (data: { sessionId: string; examId?: string }) => ipcRenderer.invoke(AdminChannels.GET_RESULTS, data),
    exportCsv: (data: { sessionId: string; sessionLabel: string }) => ipcRenderer.invoke(AdminChannels.EXPORT_CSV, data),
    exportXlsx: (data: { sessionId: string; sessionLabel: string }) => ipcRenderer.invoke(AdminChannels.EXPORT_XLSX, data),
    getMasterView: (data: { sessionId: string; examId?: string }) => ipcRenderer.invoke(AdminChannels.GET_MASTER_VIEW, data),
    listUsers: () => ipcRenderer.invoke(AdminChannels.LIST_USERS),
    deleteUser: (data: { id: string }) => ipcRenderer.invoke(AdminChannels.DELETE_USER, data),
    clearSessionGrades: (data: { sessionId: string }) => ipcRenderer.invoke(AdminChannels.CLEAR_SESSION_GRADES, data),
    resetSystem: () => ipcRenderer.invoke(AdminChannels.RESET_SYSTEM),
    getSystemStats: () => ipcRenderer.invoke(AdminChannels.GET_SYSTEM_STATS),
    getConfig: () => ipcRenderer.invoke(AdminChannels.GET_CONFIG),
    updateConfig: (data: Partial<AppConfig>) => ipcRenderer.invoke(AdminChannels.UPDATE_CONFIG, data),
    getDashboardData: (data: { sessionId: string; examId?: string }) => ipcRenderer.invoke(AdminChannels.GET_DASHBOARD_DATA, data),
    modifyGrade: (data: { barcodeId: string; newValue: number; reason: string }) => ipcRenderer.invoke(AdminChannels.MODIFY_GRADE, data),
    getGradeLog: (data?: { sessionId?: string; examId?: string }) => ipcRenderer.invoke(AdminChannels.GET_GRADE_LOG, data ?? {}),
    exportBarcodesDocx: (data: { records: Array<{ token: string; studentName: string; externalId: string; examName: string }> }) =>
      ipcRenderer.invoke(AdminChannels.EXPORT_BARCODES_DOCX, data),
  },
  exam: {
    list: (data: { sessionId: string }) => ipcRenderer.invoke(ExamChannels.LIST, data),
    create: (data: { sessionId: string; name: string; order: number; maxGrade: number; step: string; passingGrade: number; maxPassCount?: number | null }) => ipcRenderer.invoke(ExamChannels.CREATE, data),
    update: (data: { examId: string; name?: string; order?: number; maxGrade?: number; step?: string; passingGrade?: number; maxPassCount?: number | null }) => ipcRenderer.invoke(ExamChannels.UPDATE, data),
    delete: (data: { examId: string }) => ipcRenderer.invoke(ExamChannels.DELETE, data),
  },
  teacher: {
    lookupToken: (data: { token: string }) => ipcRenderer.invoke(TeacherChannels.LOOKUP_TOKEN, data),
    saveGrade: (data: { token: string; value: number }) => ipcRenderer.invoke(TeacherChannels.SAVE_GRADE, data),
    undoLast: () => ipcRenderer.invoke(TeacherChannels.UNDO_LAST),
    importPreview: () => ipcRenderer.invoke(TeacherChannels.IMPORT_PREVIEW),
    importCommit: (data: { rows: ValidatedRow[]; acceptedStatuses: RowStatus[] }) => ipcRenderer.invoke(TeacherChannels.IMPORT_COMMIT, data),
    listProgress: () => ipcRenderer.invoke(TeacherChannels.LIST_PROGRESS),
  },
  file: {
    saveCsv: (data: { content: string; defaultName: string }) => ipcRenderer.invoke(FileChannels.SAVE_CSV, data),
  },
  auth: {
    adminLogin: (data: { email: string; password: string }) => ipcRenderer.invoke(AuthChannels.ADMIN_LOGIN, data),
    user1Login: (data: { email: string; password: string }) => ipcRenderer.invoke(AuthChannels.USER1_LOGIN, data),
    user1Signup: (data: { email: string; password: string }) => ipcRenderer.invoke(AuthChannels.USER1_SIGNUP, data),
    logout: () => ipcRenderer.invoke(AuthChannels.LOGOUT),
  },
  session: {
    list: () => ipcRenderer.invoke(SessionChannels.LIST),
    getActive: () => ipcRenderer.invoke(SessionChannels.GET_ACTIVE),
    create: (data: { title: string; year: number; semester?: string | null }) => ipcRenderer.invoke(SessionChannels.CREATE, data),
    setActive: (data: { id: string }) => ipcRenderer.invoke(SessionChannels.SET_ACTIVE, data),
    delete: (data: { id: string }) => ipcRenderer.invoke(SessionChannels.DELETE, data),
  },
}

contextBridge.exposeInMainWorld('api', api)
