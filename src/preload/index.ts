import { contextBridge, ipcRenderer } from 'electron'
import {
  AdminChannels, TeacherChannels, FileChannels,
  AuthChannels, SessionChannels,
} from '@shared/ipc'
import type { ValidatedRow, RowStatus } from '@shared/types'

const api = {
  admin: {
    importStudents: (data: { sessionId: string }) => ipcRenderer.invoke(AdminChannels.IMPORT_STUDENTS, data),
    addStudent: (data: { externalId: string; name: string; sessionId: string }) => ipcRenderer.invoke(AdminChannels.ADD_STUDENT, data),
    deleteStudent: (data: { id: string }) => ipcRenderer.invoke(AdminChannels.DELETE_STUDENT, data),
    getStudents: () => ipcRenderer.invoke(AdminChannels.GET_STUDENTS),
    generateBarcodeBatch: (data: { sessionId: string }) => ipcRenderer.invoke(AdminChannels.GENERATE_BARCODE_BATCH, data),
    listBarcodes: (data: { sessionId: string }) => ipcRenderer.invoke(AdminChannels.LIST_BARCODES, data),
    getResults: (data: { sessionId: string }) => ipcRenderer.invoke(AdminChannels.GET_RESULTS, data),
    exportCsv: (data: { sessionId: string; sessionLabel: string }) => ipcRenderer.invoke(AdminChannels.EXPORT_CSV, data),
    getMasterView: (data: { sessionId: string }) => ipcRenderer.invoke(AdminChannels.GET_MASTER_VIEW, data),
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
    employeeLogin: (data: { email: string; password: string }) => ipcRenderer.invoke(AuthChannels.EMPLOYEE_LOGIN, data),
    employeeSignup: (data: { email: string; password: string }) => ipcRenderer.invoke(AuthChannels.EMPLOYEE_SIGNUP, data),
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
