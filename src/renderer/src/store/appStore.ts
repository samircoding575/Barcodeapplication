import { create } from 'zustand'
import type { AuthUser, ExamSession } from '@shared/types'

interface AppState {
  // Auth
  user: AuthUser | null
  login: (user: AuthUser) => void
  logout: () => Promise<void>

  // Active session (for examiner workflow)
  activeSession: ExamSession | null
  sessions: ExamSession[]
  loadSessions: () => Promise<void>
  setActiveSession: (id: string) => Promise<void>
  createSession: (data: { title: string; year: number; semester?: string | null; maxGrade?: number; step?: string; passingGrade?: number; maxPassCount?: number | null }) => Promise<{ success: boolean; error?: string }>
  deleteSession: (id: string) => Promise<{ success: boolean; error?: string }>
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
}))
