import { getCurrentUserRole } from '../auth-state'

type Handler = (...args: unknown[]) => Promise<unknown>

function permissionError(required: string) {
  return { success: false, error: `Permission denied. Required role: ${required}` }
}

/** Wraps an IPC handler to require ADMIN role. */
export function requireAdmin(handler: Handler): Handler {
  return async (...args) => {
    const role = getCurrentUserRole()
    if (role !== 'ADMIN') return permissionError('ADMIN')
    return handler(...args)
  }
}
