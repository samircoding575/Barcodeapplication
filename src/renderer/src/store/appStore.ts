import { create } from 'zustand'
import type { AuthUser, ExamSession, Exam } from '@shared/types'

interface AppState {
  // Auth
  user: AuthUser | null
  login: (user: AuthUser) => void
  logout: () => Promise<void>

  // Sessions + exams
  activeSession: ExamSession | null
  sessions: ExamSession[]
  loadSessions: () => Promise<void>
  setActiveSession: (id: string) => Promise<void>
  createSession: (data: { title: string; year: number; semester?: string | null }) => Promise<{ success: boolean; error?: string }>
  deleteSession: (id: string) => Promise<{ success: boolean; error?: string }>

  // Exam helpers
  getExamsForSession: (sessionId: string) => Exam[]
}

export const useAppStore = create<AppState>((set, get) => ({
  user: null,
  login: (user) => set({ user }),
  logout: async () => {
    await window.api.auth.logout()
    set({ user: null, activeSession: null, sessions: [] })
  },

  activeSession: null,
  sessions: [],

  loadSessions: async () => {
    const [sessions, active] = await Promise.all([
      window.api.session.list(),
      window.api.session.getActive(),
    ])
    set({ sessions, activeSession: active })
  },

  setActiveSession: async (id) => {
    const res = await window.api.session.setActive({ id })
    if (res.success) {
      const sessions = get().sessions.map((s) => ({ ...s, isActive: s.id === id }))
      const activeSession = sessions.find((s) => s.id === id) ?? null
      set({ sessions, activeSession })
    }
  },

  createSession: async (data) => {
    const res = await window.api.session.create(data)
    if (res.success && res.session) {
      set((s) => ({ sessions: [res.session!, ...s.sessions] }))
    }
    return { success: res.success, error: res.error }
  },

  deleteSession: async (id) => {
    const res = await window.api.session.delete({ id })
    if (res.success) {
      set((s) => ({
        sessions: s.sessions.filter((x) => x.id !== id),
        activeSession: s.activeSession?.id === id ? null : s.activeSession,
      }))
    }
    return { success: res.success, error: res.error }
  },

  getExamsForSession: (sessionId) => {
    const session = get().sessions.find((s) => s.id === sessionId)
    return session?.exams ?? []
  },
}))

/** Returns true if the current user is the admin. */
export function useIsAdmin(): boolean {
  return useAppStore((s) => s.user?.role === 'ADMIN')
}
