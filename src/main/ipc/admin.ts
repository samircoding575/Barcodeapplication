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

  // ── List examiner accounts ───────────────────────────────────────────────────
  ipcMain.handle(AdminChannels.LIST_EXAMINERS, async () => {
    try {
      const users = await getDb().user.findMany({
        where: { role: 'TEACHER' },
        orderBy: { createdAt: 'asc' },
        select: { id: true, email: true, createdAt: true },
      })
      return users.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() }))
    } catch (err) {
      console.error('[admin/list-examiners]', err)
      return []
    }
  })

  // ── Delete examiner account ──────────────────────────────────────────────────
  ipcMain.handle(AdminChannels.DELETE_EXAMINER, async (_, { id }: { id: string }) => {
    try {
      await getDb().user.delete({ where: { id } })
      return { success: true }
    } catch (err) {
      console.error('[admin/delete-examiner]', err)
      return { success: false, error: (err as Error).message }
    }
  })

  // ── Clear all grades for a session ──────────────────────────────────────────
  ipcMain.handle(AdminChannels.CLEAR_SESSION_GRADES, async (_, { sessionId }: { sessionId: string }) => {
    try {
      const db = getDb()
      const barcodes = await db.barcode.findMany({ where: { sessionId }, select: { id: true } })
      const barcodeIds = barcodes.map((b) => b.id)
      const { count } = await db.grade.deleteMany({ where: { barcodeId: { in: barcodeIds } } })
      await db.auditLog.create({
        data: { action: 'CLEAR_SESSION_GRADES', payload: JSON.stringify({ sessionId, count }) },
      })
      return { success: true, count }
    } catch (err) {
      console.error('[admin/clear-session-grades]', err)
      return { success: false, count: 0, error: (err as Error).message }
    }
  })

  // ── Factory reset — wipe all data ────────────────────────────────────────────
  ipcMain.handle(AdminChannels.RESET_SYSTEM, async () => {
    try {
      const db = getDb()
      await db.$transaction([
        db.auditLog.deleteMany(),
        db.grade.deleteMany(),
        db.barcode.deleteMany(),
        db.examSession.deleteMany(),
        db.student.deleteMany(),
        db.user.deleteMany({ where: { role: 'TEACHER' } }),
      ])
      return { success: true }
    } catch (err) {
      console.error('[admin/reset-system]', err)
      return { success: false, error: (err as Error).message }
    }
  })

  // ── System stats for Settings dashboard ─────────────────────────────────────
  ipcMain.handle(AdminChannels.GET_SYSTEM_STATS, async () => {
    try {
      const db = getDb()
      const [totalSessions, totalStudents, totalGrades, totalExaminers] = await Promise.all([
        db.examSession.count(),
        db.student.count(),
        db.grade.count(),
        db.user.count({ where: { role: 'TEACHER' } }),
      ])
      return { totalSessions, totalStudents, totalGrades, totalExaminers }
    } catch (err) {
      console.error('[admin/get-system-stats]', err)
      return { totalSessions: 0, totalStudents: 0, totalGrades: 0, totalExaminers: 0 }
    }
  })

  // ── App config (org name, defaults) ─────────────────────────────────────────
  ipcMain.handle(AdminChannels.GET_CONFIG, async () => {
    try {
      const db = getDb()
      const cfg = await db.appConfig.upsert({
        where: { id: 'singleton' },
        create: { id: 'singleton' },
        update: {},
      })
      return { orgName: cfg.orgName, orgNameAr: cfg.orgNameAr }
    } catch (err) {
      console.error('[admin/get-config]', err)
      return { orgName: 'Lebanese Bar Association', orgNameAr: 'نقابة المحامين في بيروت' }
    }
  })

  ipcMain.handle(AdminChannels.UPDATE_CONFIG, async (_, patch: Partial<{ orgName: string; orgNameAr: string }>) => {
    try {
      const db = getDb()
      await db.appConfig.upsert({
        where: { id: 'singleton' },
        create: { id: 'singleton', ...patch },
        update: patch,
      })
      return { success: true }
    } catch (err) {
      console.error('[admin/update-config]', err)
      return { success: false, error: (err as Error).message }
    }
  })

  // ── Update session admission thresholds ──────────────────────────────────────
  ipcMain.handle(AdminChannels.UPDATE_SESSION_THRESHOLDS, async (_, { sessionId, passingGrade, maxPassCount }: { sessionId: string; passingGrade: number; maxPassCount: number | null }) => {
    try {
      await getDb().examSession.update({
        where: { id: sessionId },
        data: { passingGrade, maxPassCount },
      })
      return { success: true }
    } catch (err) {
      console.error('[admin/update-session-thresholds]', err)
      return { success: false, error: (err as Error).message }
    }
  })

  // ── Dashboard data computation ───────────────────────────────────────────────
  ipcMain.handle(AdminChannels.GET_DASHBOARD_DATA, async (_, { sessionId }: { sessionId: string }) => {
    try {
      const db = getDb()
      const session = await db.examSession.findUnique({ where: { id: sessionId } })
      if (!session) throw new Error('Session not found')

      // Fetch all barcodes for this session with their grades and students
      const barcodes = await db.barcode.findMany({
        where: { sessionId },
        include: {
          grade: true,
          student: { select: { externalId: true, name: true } },
        },
      })

      const totalCandidates = barcodes.length
      const graded = barcodes.filter((b) => b.grade !== null)
      const gradedCount = graded.length
      const ungradedCount = totalCandidates - gradedCount

      // Sort graded candidates by grade descending to determine rank
      const sorted = [...graded].sort((a, b) => b.grade!.value - a.grade!.value)

      const passingGrade = session.passingGrade
      const maxPassCount = session.maxPassCount

      // Classify each graded candidate
      let admittedCount = 0
      let eligibleNotAdmittedCount = 0
      let failedCount = 0

      const rankedGraded = sorted.map((b, idx) => {
        const grade = b.grade!.value
        const eligible = grade >= passingGrade
        let outcome: 'admitted' | 'eligible_not_admitted' | 'failed'
        if (!eligible) {
          outcome = 'failed'
          failedCount++
        } else if (maxPassCount !== null && admittedCount >= maxPassCount) {
          outcome = 'eligible_not_admitted'
          eligibleNotAdmittedCount++
        } else {
          outcome = 'admitted'
          admittedCount++
        }
        return {
          rank: idx + 1,
          externalId: b.student.externalId,
          name: b.student.name,
          token: b.token,
          grade,
          outcome,
        }
      })

      // Ungraded candidates appended at end (no rank)
      const ungradedCandidates = barcodes
        .filter((b) => b.grade === null)
        .map((b) => ({
          rank: null as null,
          externalId: b.student.externalId,
          name: b.student.name,
          token: b.token,
          grade: null as null,
          outcome: 'ungraded' as const,
        }))

      // Statistics
      const grades = sorted.map((b) => b.grade!.value)
      const avgGrade = grades.length > 0 ? grades.reduce((a, b) => a + b, 0) / grades.length : null
      const highestGrade = grades.length > 0 ? grades[0] : null
      const lowestGrade = grades.length > 0 ? grades[grades.length - 1] : null

      // Median
      let medianGrade: number | null = null
      if (grades.length > 0) {
        const mid = Math.floor(grades.length / 2)
        medianGrade = grades.length % 2 !== 0 ? grades[mid] : Math.round((grades[mid - 1] + grades[mid]) / 2)
      }

      // Standard deviation
      let stdDev: number | null = null
      if (grades.length > 1 && avgGrade !== null) {
        const variance = grades.reduce((acc, g) => acc + Math.pow(g - avgGrade, 2), 0) / grades.length
        stdDev = Math.round(Math.sqrt(variance))
      }

      // Grade distribution buckets — divide maxGrade into ~10 even buckets
      const maxG = session.maxGrade
      const bucketCount = 10
      const bucketSize = Math.ceil(maxG / bucketCount)
      const distribution = Array.from({ length: bucketCount }, (_, i) => {
        const from = i * bucketSize
        const to = Math.min(from + bucketSize, maxG)
        const label = `${(from / 100).toFixed(0)}–${(to / 100).toFixed(0)}`
        const count = grades.filter((g) => g >= from && g < to).length
        return { label, from, to, count }
      })
      // Include maxGrade in last bucket
      if (distribution.length > 0 && highestGrade === maxG) {
        distribution[distribution.length - 1].count += grades.filter((g) => g === maxG).length
      }

      const passRate = gradedCount > 0 ? Math.round((admittedCount / gradedCount) * 100) : 0

      return {
        sessionId,
        totalCandidates,
        gradedCount,
        ungradedCount,
        admittedCount,
        eligibleNotAdmittedCount,
        failedCount,
        passRate,
        avgGrade,
        medianGrade,
        highestGrade,
        lowestGrade,
        stdDev,
        distribution,
        candidates: [...rankedGraded, ...ungradedCandidates],
      }
    } catch (err) {
      console.error('[admin/get-dashboard-data]', err)
      throw err
    }
  })
}
