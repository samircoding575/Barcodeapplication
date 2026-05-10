// ANONYMITY BOUNDARY — no handler in this file may return student names or externalId.
import { ipcMain, dialog } from 'electron'
import { z } from 'zod'
import { getDb } from '../db'
import { previewImport, commitImport } from '../services/import'
import { getActiveSession } from '../services/session'
import { getCurrentUserId } from '../auth-state'
import { TeacherChannels, LookupTokenResponseSchema, ImportPreviewSchema, TeacherProgressItemSchema } from '../../shared/ipc'
import { MIN_GRADE_HUNDREDTHS } from '../../shared/types'
import type { ValidatedRow, RowStatus } from '../../shared/types'

export function registerTeacherHandlers(): void {
  ipcMain.handle(TeacherChannels.LOOKUP_TOKEN, async (_, data: { token: string }) => {
    try {
      const db = getDb()
      const barcode = await db.barcode.findUnique({
        where: { token: data.token },
        include: { grade: true },
      })
      if (!barcode) return LookupTokenResponseSchema.parse({ valid: false })
      return LookupTokenResponseSchema.parse({
        valid: true,
        alreadyGraded: !!barcode.grade,
        currentGrade: barcode.grade?.value ?? null,
      })
    } catch (err) {
      console.error('[teacher/lookup-token]', err)
      return { valid: false }
    }
  })

  ipcMain.handle(TeacherChannels.SAVE_GRADE, async (_, data: { token: string; value: number }) => {
    try {
      const db = getDb()
      const barcode = await db.barcode.findUnique({
        where: { token: data.token },
        include: { session: true },
      })
      if (!barcode) return { success: false, error: 'Token not found' }
      const maxGrade = barcode.session.maxGrade
      if (data.value < MIN_GRADE_HUNDREDTHS || data.value > maxGrade) {
        return { success: false, error: `Grade out of range [0..${(maxGrade / 100).toFixed(2)}]` }
      }
      const gradedById = getCurrentUserId()
      await db.grade.upsert({
        where: { barcodeId: barcode.id },
        create: { barcodeId: barcode.id, value: data.value, gradedById },
        update: { value: data.value, gradedById },
      })
      await db.auditLog.create({
        data: { actorId: gradedById, action: 'GRADE_SET', payload: JSON.stringify({ token: data.token, value: data.value }) },
      })
      return { success: true }
    } catch (err) {
      console.error('[teacher/save-grade]', err)
      return { success: false, error: (err as Error).message }
    }
  })

  ipcMain.handle(TeacherChannels.UNDO_LAST, async () => {
    try {
      const db = getDb()
      const last = await db.auditLog.findFirst({
        where: { action: 'GRADE_SET' },
        orderBy: { createdAt: 'desc' },
      })
      if (!last) return { success: false }
      const payload = JSON.parse(last.payload) as { token: string }
      const barcode = await db.barcode.findUnique({ where: { token: payload.token } })
      if (!barcode) return { success: false }
      await db.grade.delete({ where: { barcodeId: barcode.id } })
      await db.auditLog.delete({ where: { id: last.id } })
      return { success: true, token: payload.token }
    } catch (err) {
      console.error('[teacher/undo-last]', err)
      return { success: false }
    }
  })

  // Anonymity: returns only token + graded boolean for the active session.
  ipcMain.handle(TeacherChannels.LIST_PROGRESS, async () => {
    try {
      const session = await getActiveSession()
      if (!session) return []
      const barcodes = await getDb().barcode.findMany({
        where: { sessionId: session.id },
        select: { token: true, grade: { select: { id: true } } },
        orderBy: { createdAt: 'asc' },
      })
      return z.array(TeacherProgressItemSchema).parse(barcodes.map((b) => ({ token: b.token, graded: !!b.grade })))
    } catch (err) {
      console.error('[teacher/list-progress]', err)
      return []
    }
  })

  ipcMain.handle(TeacherChannels.IMPORT_PREVIEW, async () => {
    try {
      const { filePaths } = await dialog.showOpenDialog({
        title: 'Import Grades',
        filters: [
          { name: 'Spreadsheet', extensions: ['csv', 'xlsx', 'xls'] },
          { name: 'All Files', extensions: ['*'] },
        ],
        properties: ['openFile'],
      })
      if (!filePaths.length) return null
      const preview = await previewImport(filePaths[0])
      return ImportPreviewSchema.parse(preview)
    } catch (err) {
      console.error('[teacher/import/preview]', err)
      return null
    }
  })

  ipcMain.handle(TeacherChannels.IMPORT_COMMIT, async (_, data: { rows: ValidatedRow[]; acceptedStatuses: RowStatus[] }) => {
    try {
      const committed = await commitImport(data.rows, data.acceptedStatuses)
      return { committed }
    } catch (err) {
      console.error('[teacher/import/commit]', err)
      return { committed: 0, error: (err as Error).message }
    }
  })
}
