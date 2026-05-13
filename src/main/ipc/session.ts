import { ipcMain } from 'electron'
import { listSessions, getActiveSession, createSession, setActiveSession, deleteSession } from '../services/session'
import { SessionChannels } from '../../shared/ipc'

function serializeSession(s: {
  id: string; title: string; year: number; semester: string | null
  isActive: boolean; createdAt: Date
  exams: { id: string; sessionId: string; name: string; order: number; maxGrade: number; step: string; passingGrade: number; maxPassCount: number | null; createdAt: Date }[]
}) {
  return {
    ...s,
    createdAt: s.createdAt.toISOString(),
    exams: s.exams.map((e) => ({ ...e, createdAt: e.createdAt.toISOString() })),
  }
}

export function registerSessionHandlers(): void {
  ipcMain.handle(SessionChannels.LIST, async () => {
    try {
      const sessions = await listSessions()
      return sessions.map(serializeSession)
    } catch (err) {
      console.error('[session/list]', err)
      return []
    }
  })

  ipcMain.handle(SessionChannels.GET_ACTIVE, async () => {
    try {
      const s = await getActiveSession()
      return s ? serializeSession(s) : null
    } catch (err) {
      console.error('[session/get-active]', err)
      return null
    }
  })

  ipcMain.handle(SessionChannels.CREATE, async (_, data: { title: string; year: number; semester?: string | null }) => {
    try {
      const s = await createSession(data)
      return { success: true, session: serializeSession(s) }
    } catch (err) {
      console.error('[session/create]', err)
      return { success: false, error: (err as Error).message }
    }
  })

  ipcMain.handle(SessionChannels.SET_ACTIVE, async (_, { id }: { id: string }) => {
    try {
      await setActiveSession(id)
      return { success: true }
    } catch (err) {
      console.error('[session/set-active]', err)
      return { success: false, error: (err as Error).message }
    }
  })

  ipcMain.handle(SessionChannels.DELETE, async (_, { id }: { id: string }) => {
    try {
      await deleteSession(id)
      return { success: true }
    } catch (err) {
      console.error('[session/delete]', err)
      return { success: false, error: (err as Error).message }
    }
  })
}
