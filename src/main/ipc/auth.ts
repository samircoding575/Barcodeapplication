import { ipcMain } from 'electron'
import { ADMIN_EMAIL, ADMIN_PASSWORD } from '../config'
import { findUserByEmail, createUser, verifyPassword } from '../services/auth'
import { setCurrentUser } from '../auth-state'
import { AuthChannels } from '../../shared/ipc'

export function registerAuthHandlers(): void {
  ipcMain.handle(AuthChannels.ADMIN_LOGIN, async (_, { email, password }: { email: string; password: string }) => {
    try {
      if (email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase() && password === ADMIN_PASSWORD) {
        setCurrentUser('admin', 'ADMIN')
        return { success: true, user: { id: 'admin', email: ADMIN_EMAIL, role: 'ADMIN' as const } }
      }
      return { success: false, error: 'Invalid credentials' }
    } catch (err) {
      console.error('[auth/admin-login]', err)
      return { success: false, error: (err as Error).message }
    }
  })

  ipcMain.handle(AuthChannels.USER1_LOGIN, async (_, { email, password }: { email: string; password: string }) => {
    try {
      const user = await findUserByEmail(email.trim().toLowerCase())
      if (!user) return { success: false, error: 'No account found with that email' }
      if (user.role !== 'USER1') return { success: false, error: 'No account found with that email' }
      const ok = await verifyPassword(password, user.pwdHash)
      if (!ok) return { success: false, error: 'Incorrect password' }
      setCurrentUser(user.id, user.role)
      return { success: true, user: { id: user.id, email: user.email, role: 'USER1' as const } }
    } catch (err) {
      console.error('[auth/user1-login]', err)
      return { success: false, error: (err as Error).message }
    }
  })

  ipcMain.handle(AuthChannels.USER1_SIGNUP, async (_, { email, password }: { email: string; password: string }) => {
    try {
      const existing = await findUserByEmail(email.trim().toLowerCase())
      if (existing) return { success: false, error: 'An account with this email already exists' }
      const user = await createUser(email.trim().toLowerCase(), password)
      setCurrentUser(user.id, user.role)
      return { success: true, user: { id: user.id, email: user.email, role: 'USER1' as const } }
    } catch (err) {
      console.error('[auth/user1-signup]', err)
      return { success: false, error: (err as Error).message }
    }
  })

  ipcMain.handle(AuthChannels.LOGOUT, async () => {
    try {
      setCurrentUser(null, null)
      return { success: true }
    } catch (err) {
      console.error('[auth/logout]', err)
      return { success: false, error: (err as Error).message }
    }
  })
}
