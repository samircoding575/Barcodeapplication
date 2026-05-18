import type { IpcMainInvokeEvent } from 'electron'
import { getCurrentUserRole } from '../auth-state'

// Electron's IPC handler signature: an invoke-event followed by the renderer's
// invoke payload. We use `any` for the payload so call sites can refine the
// argument type via destructured-param annotations without TS complaining about
// `unknown`-vs-shape mismatches at the wrapper boundary.
type Handler<TArg = any, TResult = unknown> =
  (event: IpcMainInvokeEvent, arg: TArg) => Promise<TResult>

function permissionError(required: string) {
  return { success: false, error: `Permission denied. Required role: ${required}` }
}

/** Wraps an IPC handler to require ADMIN role. */
export function requireAdmin<TArg, TResult>(handler: Handler<TArg, TResult>): Handler<TArg, TResult | { success: boolean; error: string }> {
  return async (event, arg) => {
    const role = getCurrentUserRole()
    if (role !== 'ADMIN') return permissionError('ADMIN')
    return handler(event, arg)
  }
}
