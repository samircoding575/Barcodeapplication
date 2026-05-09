import { ipcMain, dialog } from 'electron'
import { readFileSync, writeFileSync } from 'fs'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { createId } from '@paralleldrive/cuid2'
import { getDb } from '../db'
import { AdminChannels, FileChannels } from '../../shared/ipc'
import { formatGrade } from '../../shared/types'
import { getActiveSession } from '../services/session'

export function registerAdminHandlers(): void {
  // ── Student import ──────────────────────────────────────────────────────────
  ipcMain.handle(AdminChannels.IMPORT_STUDENTS, async (_, { sessionId }: { sessionId: string }) => {
    try {
      const { filePaths } = await dialog.showOpenDialog({
        title: 'Import Candidates',
        filters: [
          { name: 'Spreadsheet', extensions: ['csv', 'xlsx', 'xls'] },
          { name: 'All Files', extensions: ['*'] },
        ],
        properties: ['openFile'],
      })
      if (!filePaths.length) return { success: false, count: 0, barcodesGenerated: 0 }

      const filePath = filePaths[0]
      let rows: Array<{ id?: string; externalId?: string; name?: string }>

      if (filePath.toLowerCase().endsWith('.csv')) {
        const content = readFileSync(filePath, 'utf-8')
        rows = Papa.parse<{ id?: string; externalId?: string; name?: string }>(content, {
          header: true,
          skipEmptyLines: true,
        }).data
      } else {
        const wb = XLSX.readFile(filePath)
        const ws = wb.Sheets[wb.SheetNames[0]]
        rows = XLSX.utils.sheet_to_json(ws)
      }

      const db = getDb()
      let count = 0
      let barcodesGenerated = 0

      for (const row of rows) {
        const externalId = String(row.id ?? row.externalId ?? '').trim()
        const name = String(row.name ?? '').trim()
        if (!externalId || !name) continue

        const student = await db.student.upsert({
          where: { externalId },
          create: { externalId, name },
          update: { name },
        })
        count++

        const existing = await db.barcode.findUnique({ where: { studentId_sessionId: { studentId: student.id, sessionId } } })
        if (!existing) {
          await db.barcode.create({ data: { token: createId(), studentId: student.id, sessionId } })
          barcodesGenerated++
        }
      }

      await db.auditLog.create({
        data: { action: 'IMPORT_STUDENTS', payload: JSON.stringify({ count, barcodesGenerated, sessionId }) },
      })
      return { success: true, count, barcodesGenerated }
    } catch (err) {
      console.error('[admin/import-students]', err)
      return { success: false, count: 0, barcodesGenerated: 0, error: (err as Error).message }
    }
  })

  // ── Manual add student ───────────────────────────────────────────────────────
  ipcMain.handle(AdminChannels.ADD_STUDENT, async (_, { externalId, name, sessionId }: { externalId: string; name: string; sessionId: string }) => {
    try {
      const db = getDb()
      const student = await db.student.upsert({
        where: { externalId },
        create: { externalId, name },
        update: { name },
      })
      const existing = await db.barcode.findUnique({ where: { studentId_sessionId: { studentId: student.id, sessionId } } })
      if (!existing) {
        await db.barcode.create({ data: { token: createId(), studentId: student.id, sessionId } })
      }
      return { success: true, student: { id: student.id, externalId: student.externalId, name: student.name, createdAt: student.createdAt.toISOString() } }
    } catch (err) {
      console.error('[admin/add-student]', err)
      return { success: false, error: (err as Error).message }
    }
  })

  // ── Delete student ───────────────────────────────────────────────────────────
  ipcMain.handle(AdminChannels.DELETE_STUDENT, async (_, { id }: { id: string }) => {
    try {
      await getDb().student.delete({ where: { id } })
      return { success: true }
    } catch (err) {
      console.error('[admin/delete-student]', err)
      return { success: false, error: (err as Error).message }
    }
  })

  // ── Get all students (global, any session) ──────────────────────────────────
  ipcMain.handle(AdminChannels.GET_STUDENTS, async () => {
    try {
      const students = await getDb().student.findMany({ orderBy: { externalId: 'asc' } })
      return students.map((s) => ({ ...s, createdAt: s.createdAt.toISOString() }))
    } catch (err) {
      console.error('[admin/get-students]', err)
      return []
    }
  })

  // ── Generate barcodes for session ────────────────────────────────────────────
  ipcMain.handle(AdminChannels.GENERATE_BARCODE_BATCH, async (_, { sessionId }: { sessionId: string }) => {
    try {
      const db = getDb()
      const students = await db.student.findMany({ include: { barcodes: { where: { sessionId } } } })
      const missing = students.filter((s) => s.barcodes.length === 0)
      await db.$transaction(
        missing.map((s) => db.barcode.create({ data: { token: createId(), studentId: s.id, sessionId } }))
      )
      await db.auditLog.create({
        data: { action: 'GENERATE_BARCODE_BATCH', payload: JSON.stringify({ count: missing.length, sessionId }) },
      })
      return { count: missing.length }
    } catch (err) {
      console.error('[admin/generate-barcode-batch]', err)
      return { count: 0, error: (err as Error).message }
    }
  })

  // ── List barcodes for a session ─────────────────────────────────────────────
  ipcMain.handle(AdminChannels.LIST_BARCODES, async (_, { sessionId }: { sessionId: string }) => {
    try {
      const barcodes = await getDb().barcode.findMany({
        where: { sessionId },
        include: {
          student: { select: { externalId: true, name: true } },
          grade: { select: { value: true, gradedAt: true } },
        },
        orderBy: { student: { externalId: 'asc' } },
      })
      return barcodes.map((b) => ({
        id: b.id,
        token: b.token,
        studentId: b.studentId,
        student: b.student,
        graded: !!b.grade,
        gradeValue: b.grade?.value ?? null,
        gradedAt: b.grade?.gradedAt?.toISOString() ?? null,
      }))
    } catch (err) {
      console.error('[admin/list-barcodes]', err)
      return []
    }
  })

  // ── Get results (admin, with identities) ────────────────────────────────────
  ipcMain.handle(AdminChannels.GET_RESULTS, async (_, { sessionId }: { sessionId: string }) => {
    try {
      const grades = await getDb().grade.findMany({
        where: { barcode: { sessionId } },
        include: {
          barcode: { include: { student: { select: { externalId: true, name: true } } } },
        },
        orderBy: { barcode: { student: { externalId: 'asc' } } },
      })
      return grades.map((g) => ({
        id: g.id,
        value: g.value,
        gradedAt: g.gradedAt.toISOString(),
        barcode: { token: g.barcode.token, student: g.barcode.student },
      }))
    } catch (err) {
      console.error('[admin/get-results]', err)
      return []
    }
  })

  // ── Master view for a session ────────────────────────────────────────────────
  ipcMain.handle(AdminChannels.GET_MASTER_VIEW, async (_, { sessionId }: { sessionId: string }) => {
    try {
      const students = await getDb().student.findMany({
        include: { barcodes: { where: { sessionId }, include: { grade: true } } },
        orderBy: { externalId: 'asc' },
      })
      return students.map((s) => {
        const barcode = s.barcodes[0] ?? null
        return {
          id: s.id,
          externalId: s.externalId,
          name: s.name,
          token: barcode?.token ?? null,
          graded: !!barcode?.grade,
          gradeValue: barcode?.grade?.value ?? null,
          gradedAt: barcode?.grade?.gradedAt?.toISOString() ?? null,
        }
      })
    } catch (err) {
      console.error('[admin/get-master-view]', err)
      return []
    }
  })

  // ── Export CSV ───────────────────────────────────────────────────────────────
  ipcMain.handle(AdminChannels.EXPORT_CSV, async (_, { sessionId, sessionLabel }: { sessionId: string; sessionLabel: string }) => {
    try {
      const grades = await getDb().grade.findMany({
        where: { barcode: { sessionId } },
        include: {
          barcode: { include: { student: { select: { externalId: true, name: true } } } },
        },
        orderBy: { barcode: { student: { externalId: 'asc' } } },
      })
      const rows = grades.map((g) => ({
        external_id: g.barcode.student.externalId,
        name: g.barcode.student.name,
        grade: formatGrade(g.value),
      }))
      const csv = Papa.unparse(rows)
      const slug = sessionLabel.toLowerCase().replace(/\s+/g, '-')
      const { filePath } = await dialog.showSaveDialog({
        defaultPath: `${slug}-results.csv`,
        filters: [{ name: 'CSV', extensions: ['csv'] }],
      })
      if (!filePath) return { success: false }
      writeFileSync(filePath, csv, 'utf-8')
      return { success: true, path: filePath }
    } catch (err) {
      console.error('[admin/export-csv]', err)
      return { success: false, error: (err as Error).message }
    }
  })

  // ── File: save CSV ───────────────────────────────────────────────────────────
  ipcMain.handle(FileChannels.SAVE_CSV, async (_, data: { content: string; defaultName: string }) => {
    try {
      const { filePath } = await dialog.showSaveDialog({
        defaultPath: data.defaultName,
        filters: [{ name: 'CSV', extensions: ['csv'] }],
      })
      if (!filePath) return { success: false }
      writeFileSync(filePath, data.content, 'utf-8')
      return { success: true, path: filePath }
    } catch (err) {
      console.error('[file/save-csv]', err)
      return { success: false, error: (err as Error).message }
    }
  })
}
