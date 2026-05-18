import { ipcMain, dialog } from 'electron'
import { readFileSync, writeFileSync } from 'fs'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { init } from '@paralleldrive/cuid2'
const createId = init({ length: 10 })
import bcrypt from 'bcryptjs'
import { getDb } from '../db'
import { AdminChannels, FileChannels, ModifyGradeRequestSchema } from '../../shared/ipc'
import { formatGrade } from '../../shared/types'
import { requireAdmin } from './guard'
import { getCurrentUserId } from '../auth-state'

export function registerAdminHandlers(): void {
  // ── Student import ──────────────────────────────────────────────────────────
  ipcMain.handle(AdminChannels.IMPORT_STUDENTS, requireAdmin(async (_, { sessionId, examIds }: { sessionId: string; examIds: string[] }) => {
    try {
      if (!examIds || examIds.length === 0) return { success: false, count: 0, barcodesGenerated: 0, error: 'No exams selected' }
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

      // Strip invisible Unicode characters (BOM, RTL/LTR marks, zero-width spaces, NBSP)
      // that Excel embeds in Arabic cell values and header names
      function cleanStr(v: unknown): string {
        return String(v ?? '').replace(/[\u200B-\u200F\u202A-\u202E\uFEFF\u00A0]/g, '').trim()
      }

      // Normalise a raw row from any column-name convention (English or Arabic).
      // Strategy: first try known header names (after cleaning), then fall back to
      // positional assignment (col 0 = id, col 1 = name) so any two-column sheet works.
      function normaliseRow(raw: Record<string, unknown>): { id?: string; name?: string } {
        // Build a lookup map with cleaned keys → original keys
        const cleanedKeys = Object.keys(raw).map((k) => ({ clean: cleanStr(k), orig: k }))

        const ID_PATTERNS = ['id', 'externalid', 'external_id', 'الرقم', 'رقم', 'الكود', 'كود', 'no', 'number', 'رقم_المرشح', 'رقم المرشح']
        const NAME_PATTERNS = ['name', 'fullname', 'full_name', 'الاسم', 'اسم', 'الاسم_الكامل', 'الاسم الكامل', 'الاسم والشهرة', 'الشهرة', 'المرشح']

        const findCol = (patterns: string[]): string | undefined => {
          for (const { clean, orig } of cleanedKeys) {
            if (patterns.includes(clean.toLowerCase())) {
              const val = cleanStr(raw[orig])
              if (val) return val
            }
          }
          return undefined
        }

        let id = findCol(ID_PATTERNS)
        let name = findCol(NAME_PATTERNS)

        // Positional fallback: if either field is missing, use column order
        if ((!id || !name) && cleanedKeys.length >= 2) {
          const vals = cleanedKeys.map(({ orig }) => cleanStr(raw[orig]))
          if (!id) id = vals[0] || undefined
          if (!name) name = vals[1] || undefined
        }

        return { id, name }
      }

      let rows: Array<Record<string, unknown>>

      if (filePath.toLowerCase().endsWith('.csv')) {
        let content: string
        try {
          content = readFileSync(filePath, 'utf-8')
          if (content.charCodeAt(0) === 0xfeff) content = content.slice(1)
        } catch {
          content = readFileSync(filePath, 'latin1')
        }
        rows = Papa.parse<Record<string, unknown>>(content, { header: true, skipEmptyLines: true }).data
      } else {
        // raw: false makes XLSX format numbers as strings (e.g. 1 → "1")
        const wb = XLSX.readFile(filePath, { raw: false })
        const ws = wb.Sheets[wb.SheetNames[0]]
        rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })
      }

      const db = getDb()
      let count = 0
      let barcodesGenerated = 0

      for (const raw of rows) {
        const row = normaliseRow(raw)
        const externalId = row.id ?? ''
        const name = row.name ?? ''
        if (!externalId || !name) continue

        const student = await db.student.upsert({
          where: { externalId },
          create: { externalId, name },
          update: { name },
        })
        count++

        for (const examId of examIds) {
          const existing = await db.barcode.findUnique({ where: { studentId_examId: { studentId: student.id, examId } } })
          if (!existing) {
            await db.barcode.create({ data: { token: createId(), studentId: student.id, sessionId, examId } })
            barcodesGenerated++
          }
        }
      }

      await db.auditLog.create({
        data: { actorId: getCurrentUserId(), action: 'IMPORT_STUDENTS', payload: JSON.stringify({ count, barcodesGenerated, sessionId, examIds }) },
      })
      return { success: true, count, barcodesGenerated }
    } catch (err) {
      console.error('[admin/import-students]', err)
      return { success: false, count: 0, barcodesGenerated: 0, error: (err as Error).message }
    }
  }) as Parameters<typeof ipcMain.handle>[1])

  // ── Manual add student ───────────────────────────────────────────────────────
  ipcMain.handle(AdminChannels.ADD_STUDENT, requireAdmin(async (_, { externalId, name, examIds }: { externalId: string; name: string; examIds: string[] }) => {
    try {
      if (!examIds || examIds.length === 0) return { success: false, error: 'No exams selected' }
      const db = getDb()

      // Get session from first exam
      const firstExam = await db.exam.findUnique({ where: { id: examIds[0] } })
      if (!firstExam) return { success: false, error: 'Exam not found' }
      const sessionId = firstExam.sessionId

      const student = await db.student.upsert({
        where: { externalId },
        create: { externalId, name },
        update: { name },
      })

      for (const examId of examIds) {
        const existing = await db.barcode.findUnique({ where: { studentId_examId: { studentId: student.id, examId } } })
        if (!existing) {
          await db.barcode.create({ data: { token: createId(), studentId: student.id, sessionId, examId } })
        }
      }

      return { success: true, student: { id: student.id, externalId: student.externalId, name: student.name, createdAt: student.createdAt.toISOString() } }
    } catch (err) {
      console.error('[admin/add-student]', err)
      return { success: false, error: (err as Error).message }
    }
  }) as Parameters<typeof ipcMain.handle>[1])

  // ── Delete student ───────────────────────────────────────────────────────────
  ipcMain.handle(AdminChannels.DELETE_STUDENT, requireAdmin(async (_, { id }: { id: string }) => {
    try {
      await getDb().student.delete({ where: { id } })
      return { success: true }
    } catch (err) {
      console.error('[admin/delete-student]', err)
      return { success: false, error: (err as Error).message }
    }
  }) as Parameters<typeof ipcMain.handle>[1])

  // ── Delete multiple students ───────────────────────────────────────────────────
  ipcMain.handle(AdminChannels.DELETE_STUDENTS_BATCH, requireAdmin(async (_, { ids }: { ids: string[] }) => {
    try {
      await getDb().student.deleteMany({ where: { id: { in: ids } } })
      return { success: true, count: ids.length }
    } catch (err) {
      console.error('[admin/delete-students-batch]', err)
      return { success: false, error: (err as Error).message }
    }
  }) as Parameters<typeof ipcMain.handle>[1])

  // ── Get all students (global, any session) ──────────────────────────────────
  ipcMain.handle(AdminChannels.GET_STUDENTS, requireAdmin(async () => {
    try {
      const students = await getDb().student.findMany({ orderBy: { externalId: 'asc' } })
      return students.map((s) => ({ ...s, createdAt: s.createdAt.toISOString() }))
    } catch (err) {
      console.error('[admin/get-students]', err)
      return []
    }
  }) as Parameters<typeof ipcMain.handle>[1])

  // ── Generate barcodes for exam ────────────────────────────────────────────
  ipcMain.handle(AdminChannels.GENERATE_BARCODE_BATCH, requireAdmin(async (_, { examId }: { examId: string }) => {
    try {
      const db = getDb()
      const exam = await db.exam.findUnique({ where: { id: examId } })
      if (!exam) return { count: 0, error: 'Exam not found' }
      const students = await db.student.findMany({ include: { barcodes: { where: { examId } } } })
      const missing = students.filter((s) => s.barcodes.length === 0)
      await db.$transaction(
        missing.map((s) => db.barcode.create({ data: { token: createId(), studentId: s.id, sessionId: exam.sessionId, examId } }))
      )
      await db.auditLog.create({
        data: { actorId: getCurrentUserId(), action: 'GENERATE_BARCODE_BATCH', payload: JSON.stringify({ count: missing.length, examId }) },
      })
      return { count: missing.length }
    } catch (err) {
      console.error('[admin/generate-barcode-batch]', err)
      return { count: 0, error: (err as Error).message }
    }
  }) as Parameters<typeof ipcMain.handle>[1])

  // ── List barcodes for a session (optionally filtered by exam) ───────────────
  ipcMain.handle(AdminChannels.LIST_BARCODES, requireAdmin(async (_, { sessionId, examId }: { sessionId: string; examId?: string }) => {
    try {
      const barcodes = await getDb().barcode.findMany({
        where: { sessionId, ...(examId ? { examId } : {}) },
        include: {
          student: { select: { externalId: true, name: true } },
          exam: { select: { name: true } },
          grade: { select: { value: true, gradedAt: true, isModified: true } },
        },
        orderBy: { student: { externalId: 'asc' } },
      })
      return barcodes.map((b) => ({
        id: b.id,
        token: b.token,
        studentId: b.studentId,
        examId: b.examId,
        examName: b.exam.name,
        student: b.student,
        graded: !!b.grade,
        gradeValue: b.grade?.value ?? null,
        gradedAt: b.grade?.gradedAt?.toISOString() ?? null,
        isModified: b.grade?.isModified ?? false,
      }))
    } catch (err) {
      console.error('[admin/list-barcodes]', err)
      return []
    }
  }) as Parameters<typeof ipcMain.handle>[1])

  // ── Get results (admin, with identities) ────────────────────────────────────
  ipcMain.handle(AdminChannels.GET_RESULTS, requireAdmin(async (_, { sessionId, examId }: { sessionId: string; examId?: string }) => {
    try {
      const grades = await getDb().grade.findMany({
        where: { barcode: { sessionId, ...(examId ? { examId } : {}) } },
        include: {
          barcode: {
            include: {
              student: { select: { externalId: true, name: true } },
              exam: { select: { name: true } },
            },
          },
        },
        orderBy: { barcode: { student: { externalId: 'asc' } } },
      })
      return grades.map((g) => ({
        id: g.id,
        barcodeId: g.barcodeId,
        value: g.value,
        gradedAt: g.gradedAt.toISOString(),
        isModified: g.isModified,
        originalValue: g.originalValue,
        modifiedById: g.modifiedById,
        modifiedReason: g.modifiedReason,
        modifiedAt: g.modifiedAt?.toISOString() ?? null,
        barcode: {
          token: g.barcode.token,
          examId: g.barcode.examId,
          examName: g.barcode.exam.name,
          student: g.barcode.student,
        },
      }))
    } catch (err) {
      console.error('[admin/get-results]', err)
      return []
    }
  }) as Parameters<typeof ipcMain.handle>[1])

  // ── Master view for a session (optionally by exam) ────────────────────────────────────────────
  ipcMain.handle(AdminChannels.GET_MASTER_VIEW, requireAdmin(async (_, { sessionId, examId }: { sessionId: string; examId?: string }) => {
    try {
      const students = await getDb().student.findMany({
        include: {
          barcodes: {
            where: { sessionId, ...(examId ? { examId } : {}) },
            include: {
              grade: true,
              exam: { select: { name: true } },
            },
          },
        },
        orderBy: { externalId: 'asc' },
      })
      return students
        .filter((s) => s.barcodes.length > 0)
        .map((s) => ({
          id: s.id,
          externalId: s.externalId,
          name: s.name,
          barcodes: s.barcodes.map((b) => ({
            examId: b.examId,
            examName: b.exam.name,
            token: b.token,
            graded: !!b.grade,
            gradeValue: b.grade?.value ?? null,
            gradedAt: b.grade?.gradedAt?.toISOString() ?? null,
            isModified: b.grade?.isModified ?? false,
          })),
        }))
    } catch (err) {
      console.error('[admin/get-master-view]', err)
      return []
    }
  }) as Parameters<typeof ipcMain.handle>[1])

  // ── Export CSV ───────────────────────────────────────────────────────────────
  ipcMain.handle(AdminChannels.EXPORT_CSV, requireAdmin(async (_, { sessionId, sessionLabel }: { sessionId: string; sessionLabel: string }) => {
    try {
      const grades = await getDb().grade.findMany({
        where: { barcode: { sessionId } },
        include: {
          barcode: {
            include: {
              student: { select: { externalId: true, name: true } },
              exam: { select: { name: true } },
            },
          },
        },
        orderBy: { barcode: { student: { externalId: 'asc' } } },
      })
      const rows = grades.map((g) => ({
        external_id: g.barcode.student.externalId,
        name: g.barcode.student.name,
        exam: g.barcode.exam.name,
        grade: formatGrade(g.value),
      }))
      const csv = '\uFEFF' + Papa.unparse(rows)
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
  }) as Parameters<typeof ipcMain.handle>[1])

  // ── Export XLSX with signatures ──────────────────────────────────────────────
  ipcMain.handle(AdminChannels.EXPORT_XLSX, requireAdmin(async (_, { sessionId, sessionLabel }: { sessionId: string; sessionLabel: string }) => {
    try {
      const db = getDb()
      const exams = await db.exam.findMany({ where: { sessionId }, orderBy: { order: 'asc' } })
      const wb = XLSX.utils.book_new()

      // Overview sheet with all exams
      const allGrades = await db.grade.findMany({
        where: { barcode: { sessionId } },
        include: {
          barcode: {
            include: {
              student: { select: { externalId: true, name: true } },
              exam: { select: { name: true } },
            },
          },
        },
        orderBy: [{ barcode: { exam: { order: 'asc' } } }, { barcode: { student: { externalId: 'asc' } } }],
      })

      const overviewRows = allGrades.map((g) => ({
        'External ID': g.barcode.student.externalId,
        'Name': g.barcode.student.name,
        'Exam': g.barcode.exam.name,
        'Barcode Token': g.barcode.token,
        'Grade': formatGrade(g.value),
      }))

      const overviewWs = XLSX.utils.json_to_sheet(overviewRows)
      XLSX.utils.book_append_sheet(wb, overviewWs, 'Overview')

      // One sheet per exam
      for (const exam of exams) {
        const examGrades = allGrades.filter((g) => g.barcode.examId === exam.id)
        const examRows = examGrades.map((g) => ({
          'External ID': g.barcode.student.externalId,
          'Name': g.barcode.student.name,
          'Barcode Token': g.barcode.token,
          'Grade': formatGrade(g.value),
        }))
        const examWs = XLSX.utils.json_to_sheet(examRows)
        XLSX.utils.book_append_sheet(wb, examWs, exam.name.slice(0, 31))
      }

      const slug = sessionLabel.toLowerCase().replace(/\s+/g, '-')
      const { filePath } = await dialog.showSaveDialog({
        defaultPath: `${slug}-results.xlsx`,
        filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }],
      })
      if (!filePath) return { success: false }
      XLSX.writeFile(wb, filePath)
      return { success: true, path: filePath }
    } catch (err) {
      console.error('[admin/export-xlsx]', err)
      return { success: false, error: (err as Error).message }
    }
  }) as Parameters<typeof ipcMain.handle>[1])

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

  // ── List user1 accounts ────────────────────────────────────────────────────
  ipcMain.handle(AdminChannels.LIST_USERS, requireAdmin(async () => {
    try {
      const users = await getDb().user.findMany({
        where: { role: 'USER1' },
        orderBy: { createdAt: 'asc' },
        select: { id: true, email: true, role: true, createdAt: true },
      })
      return users.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() }))
    } catch (err) {
      console.error('[admin/list-users]', err)
      return []
    }
  }) as Parameters<typeof ipcMain.handle>[1])

  // ── Delete user1 account ─────────────────────────────────────────────────────
  ipcMain.handle(AdminChannels.DELETE_USER, requireAdmin(async (_, { id }: { id: string }) => {
    try {
      await getDb().user.delete({ where: { id } })
      return { success: true }
    } catch (err) {
      console.error('[admin/delete-user]', err)
      return { success: false, error: (err as Error).message }
    }
  }) as Parameters<typeof ipcMain.handle>[1])

  // ── Clear all grades for a session ──────────────────────────────────────────
  ipcMain.handle(AdminChannels.CLEAR_SESSION_GRADES, requireAdmin(async (_, { sessionId }: { sessionId: string }) => {
    try {
      const db = getDb()
      const barcodes = await db.barcode.findMany({ where: { sessionId }, select: { id: true } })
      const barcodeIds = barcodes.map((b) => b.id)
      const { count } = await db.grade.deleteMany({ where: { barcodeId: { in: barcodeIds } } })
      await db.auditLog.create({
        data: { actorId: getCurrentUserId(), action: 'CLEAR_SESSION_GRADES', payload: JSON.stringify({ sessionId, count }) },
      })
      return { success: true, count }
    } catch (err) {
      console.error('[admin/clear-session-grades]', err)
      return { success: false, count: 0, error: (err as Error).message }
    }
  }) as Parameters<typeof ipcMain.handle>[1])

  // ── Factory reset — wipe all data ────────────────────────────────────────────
  ipcMain.handle(AdminChannels.RESET_SYSTEM, requireAdmin(async () => {
    try {
      const db = getDb()
      await db.$transaction([
        db.auditLog.deleteMany(),
        db.changeRequest.deleteMany(),
        db.grade.deleteMany(),
        db.barcode.deleteMany(),
        db.exam.deleteMany(),
        db.examSession.deleteMany(),
        db.student.deleteMany(),
        db.user.deleteMany({ where: { role: 'USER1' } }),
      ])
      return { success: true }
    } catch (err) {
      console.error('[admin/reset-system]', err)
      return { success: false, error: (err as Error).message }
    }
  }) as Parameters<typeof ipcMain.handle>[1])

  // ── System stats for Settings dashboard ─────────────────────────────────────
  ipcMain.handle(AdminChannels.GET_SYSTEM_STATS, requireAdmin(async () => {
    try {
      const db = getDb()
      const [totalSessions, totalStudents, totalGrades, totalUsers] = await Promise.all([
        db.examSession.count(),
        db.student.count(),
        db.grade.count(),
        db.user.count({ where: { role: 'USER1' } }),
      ])
      return { totalSessions, totalStudents, totalGrades, totalUsers }
    } catch (err) {
      console.error('[admin/get-system-stats]', err)
      return { totalSessions: 0, totalStudents: 0, totalGrades: 0, totalExaminers: 0 }
    }
  }) as Parameters<typeof ipcMain.handle>[1])

  // ── App config ───────────────────────────────────────────────────────────────
  ipcMain.handle(AdminChannels.GET_CONFIG, requireAdmin(async () => {
    try {
      const db = getDb()
      const cfg = await db.appConfig.upsert({
        where: { id: 'singleton' },
        create: { id: 'singleton' },
        update: {},
      })
      // Auto-migrate prior default sets forward to pure auto-centering (0, 0).
      // Triggers on:
      //   - stickerH ≈ 17 (very old absolute-offset defaults)
      //   - topMm ≈ -5 AND leftMm ≈ -4 (intermediate Fit-mode calibration defaults)
      const isOldStickerH = Math.abs(cfg.printStickerH - 17) < 0.01
      const isFitModeDefaults = Math.abs(cfg.printTopMm - -5) < 0.01 && Math.abs(cfg.printLeftMm - -4) < 0.01
      if (isOldStickerH || isFitModeDefaults) {
        const migrated = { printTopMm: 0, printLeftMm: 0, printStickerW: 48.5, printStickerH: 16.9 }
        await db.appConfig.update({ where: { id: 'singleton' }, data: migrated })
        return { orgName: cfg.orgName, orgNameAr: cfg.orgNameAr, ...migrated }
      }
      return { orgName: cfg.orgName, orgNameAr: cfg.orgNameAr, printTopMm: cfg.printTopMm, printLeftMm: cfg.printLeftMm, printStickerW: cfg.printStickerW, printStickerH: cfg.printStickerH }
    } catch (err) {
      console.error('[admin/get-config]', err)
      return { orgName: 'Lebanese Bar Association', orgNameAr: 'نقابة المحامين في بيروت', printTopMm: 0, printLeftMm: 0, printStickerW: 48.5, printStickerH: 16.9 }
    }
  }) as Parameters<typeof ipcMain.handle>[1])

  ipcMain.handle(AdminChannels.UPDATE_CONFIG, requireAdmin(async (_, patch: Partial<{ orgName: string; orgNameAr: string; printTopMm: number; printLeftMm: number; printStickerW: number; printStickerH: number }>) => {
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
  }) as Parameters<typeof ipcMain.handle>[1])

  // ── Modify grade (primary admin only, requires reason) ───────────────────────
  ipcMain.handle(AdminChannels.MODIFY_GRADE, requireAdmin(async (_, raw: unknown) => {
    try {
      const data = ModifyGradeRequestSchema.parse(raw)
      const db = getDb()
      const barcode = await db.barcode.findUnique({
        where: { id: data.barcodeId },
        include: { grade: true, exam: { select: { maxGrade: true } } },
      })
      if (!barcode) return { success: false, error: 'Barcode not found' }
      if (data.newValue < 0 || data.newValue > barcode.exam.maxGrade) {
        return { success: false, error: `Grade out of range [0..${formatGrade(barcode.exam.maxGrade)}]` }
      }

      const actorId = getCurrentUserId()
      if (barcode.grade) {
        await db.grade.update({
          where: { barcodeId: data.barcodeId },
          data: {
            value: data.newValue,
            isModified: true,
            originalValue: barcode.grade.isModified ? barcode.grade.originalValue : barcode.grade.value,
            modifiedById: actorId,
            modifiedReason: data.reason,
            modifiedAt: new Date(),
          },
        })
      } else {
        await db.grade.create({
          data: {
            barcodeId: data.barcodeId,
            value: data.newValue,
            gradedById: actorId,
          },
        })
      }

      await db.auditLog.create({
        data: {
          actorId,
          action: 'GRADE_MODIFIED',
          payload: JSON.stringify({
            barcodeId: data.barcodeId,
            newValue: data.newValue,
            oldValue: barcode.grade?.value ?? null,
            reason: data.reason,
          }),
        },
      })
      return { success: true }
    } catch (err) {
      console.error('[admin/modify-grade]', err)
      return { success: false, error: (err as Error).message }
    }
  }) as Parameters<typeof ipcMain.handle>[1])

  // ── Create read-only admin account — REMOVED (no ADMIN_READONLY role in v2) ──

  // ── Grade Audit Log — all manually modified grades ───────────────────────────
  ipcMain.handle(AdminChannels.GET_GRADE_LOG, requireAdmin(async (_, { sessionId, examId }: { sessionId?: string; examId?: string } = {}) => {
    try {
      const db = getDb()
      const grades = await db.grade.findMany({
        where: {
          isModified: true,
          ...(sessionId || examId ? {
            barcode: {
              ...(sessionId ? { sessionId } : {}),
              ...(examId ? { examId } : {}),
            }
          } : {}),
        },
        include: {
          barcode: {
            include: {
              student: { select: { externalId: true, name: true } },
              exam: { select: { name: true } },
            },
          },
        },
        orderBy: { modifiedAt: 'desc' },
      })

      return await Promise.all(grades.map(async (g) => {
        const modifiedByEmail = g.modifiedById
          ? g.modifiedById === 'admin'
            ? 'Admin'
            : (await db.user.findUnique({ where: { id: g.modifiedById }, select: { email: true } }))?.email ?? 'Unknown'
          : 'Unknown'
        return {
          id: g.id,
          barcodeId: g.barcodeId,
          token: g.barcode.token,
          examName: g.barcode.exam.name,
          studentExternalId: g.barcode.student.externalId,
          studentName: g.barcode.student.name,
          originalValue: g.originalValue ?? g.value,
          newValue: g.value,
          modifiedReason: g.modifiedReason ?? '',
          modifiedAt: g.modifiedAt?.toISOString() ?? g.gradedAt.toISOString(),
          modifiedByEmail,
        }
      }))
    } catch (err) {
      console.error('[admin/get-grade-log]', err)
      return []
    }
  }) as Parameters<typeof ipcMain.handle>[1])

  // ── Dashboard data computation ───────────────────────────────────────────────
  ipcMain.handle(AdminChannels.GET_DASHBOARD_DATA, requireAdmin(async (_, { sessionId, examId }: { sessionId: string; examId?: string }) => {
    try {
      const db = getDb()
      const exams = await db.exam.findMany({ where: { sessionId }, orderBy: { order: 'asc' } })
      if (exams.length === 0) {
        return buildEmptyDashboard(sessionId, examId ?? null)
      }

      const examSummaries = await Promise.all(exams.map((exam) => computeExamSummary(db, exam)))

      if (examId) {
        const summary = examSummaries.find((s) => s.examId === examId)
        if (!summary) return buildEmptyDashboard(sessionId, examId)
        return { ...summary, sessionId, examId, exams: examSummaries }
      }

      // Session-wide rollup
      const rollup = rollupSummaries(examSummaries)
      return { sessionId, examId: null, exams: examSummaries, ...rollup }
    } catch (err) {
      console.error('[admin/get-dashboard-data]', err)
      throw err
    }
  }) as Parameters<typeof ipcMain.handle>[1])
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function computeExamSummary(
  db: ReturnType<typeof import('../db').getDb>,
  exam: { id: string; name: string; maxGrade: number; passingGrade: number; maxPassCount: number | null }
) {
  const barcodes = await db.barcode.findMany({
    where: { examId: exam.id },
    include: {
      grade: true,
      student: { select: { externalId: true, name: true } },
    },
  })

  const totalCandidates = barcodes.length
  const graded = barcodes.filter((b) => b.grade !== null)
  const gradedCount = graded.length
  const attendedCount = gradedCount
  const modifiedGradeCount = graded.filter((b) => b.grade!.isModified).length
  const ungradedCount = totalCandidates - gradedCount

  const sorted = [...graded].sort((a, b) => b.grade!.value - a.grade!.value)
  const { passingGrade, maxPassCount } = exam

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
      barcodeId: b.id,
      grade,
      outcome,
      isModified: b.grade!.isModified,
      modifiedById: b.grade!.modifiedById,
      modifiedReason: b.grade!.modifiedReason,
    }
  })

  const ungradedCandidates = barcodes
    .filter((b) => b.grade === null)
    .map((b) => ({
      rank: null as null,
      externalId: b.student.externalId,
      name: b.student.name,
      token: b.token,
      barcodeId: b.id,
      grade: null as null,
      outcome: 'ungraded' as const,
      isModified: false,
      modifiedById: null,
      modifiedReason: null,
    }))

  const grades = sorted.map((b) => b.grade!.value)
  const avgGrade = grades.length > 0 ? grades.reduce((a, b) => a + b, 0) / grades.length : null
  const highestGrade = grades.length > 0 ? grades[0] : null
  const lowestGrade = grades.length > 0 ? grades[grades.length - 1] : null

  let medianGrade: number | null = null
  if (grades.length > 0) {
    const mid = Math.floor(grades.length / 2)
    medianGrade = grades.length % 2 !== 0 ? grades[mid] : Math.round((grades[mid - 1] + grades[mid]) / 2)
  }

  let stdDev: number | null = null
  if (grades.length > 1 && avgGrade !== null) {
    const variance = grades.reduce((acc, g) => acc + Math.pow(g - avgGrade, 2), 0) / grades.length
    stdDev = Math.round(Math.sqrt(variance))
  }

  const maxG = exam.maxGrade
  const bucketCount = 10
  const bucketSize = Math.ceil(maxG / bucketCount)
  const distribution = Array.from({ length: bucketCount }, (_, i) => {
    const from = i * bucketSize
    const to = Math.min(from + bucketSize, maxG)
    const label = `${(from / 100).toFixed(0)}–${(to / 100).toFixed(0)}`
    const count = grades.filter((g) => g >= from && g < to).length
    return { label, from, to, count }
  })

  const passedCount = admittedCount + eligibleNotAdmittedCount
  const passRate = gradedCount > 0 ? Math.round((admittedCount / gradedCount) * 100) : 0

  return {
    examId: exam.id,
    examName: exam.name,
    totalCandidates,
    attendedCount,
    modifiedGradeCount,
    gradedCount,
    ungradedCount,
    passedCount,
    failedCount,
    admittedCount,
    eligibleNotAdmittedCount,
    passRate,
    avgGrade,
    medianGrade,
    highestGrade,
    lowestGrade,
    stdDev,
    distribution,
    candidates: [...rankedGraded, ...ungradedCandidates],
  }
}

function rollupSummaries(summaries: Awaited<ReturnType<typeof computeExamSummary>>[]) {
  const totalCandidates = summaries.reduce((a, s) => a + s.totalCandidates, 0)
  const attendedCount = summaries.reduce((a, s) => a + s.attendedCount, 0)
  const modifiedGradeCount = summaries.reduce((a, s) => a + s.modifiedGradeCount, 0)
  const gradedCount = summaries.reduce((a, s) => a + s.gradedCount, 0)
  const ungradedCount = summaries.reduce((a, s) => a + s.ungradedCount, 0)
  const admittedCount = summaries.reduce((a, s) => a + s.admittedCount, 0)
  const eligibleNotAdmittedCount = summaries.reduce((a, s) => a + s.eligibleNotAdmittedCount, 0)
  const failedCount = summaries.reduce((a, s) => a + s.failedCount, 0)
  const passedCount = summaries.reduce((a, s) => a + s.passedCount, 0)
  const passRate = gradedCount > 0 ? Math.round((admittedCount / gradedCount) * 100) : 0

  const allGradeValues = summaries.flatMap((s) => s.candidates.filter((c) => c.grade !== null).map((c) => c.grade as number))
  const avgGrade = allGradeValues.length > 0 ? allGradeValues.reduce((a, b) => a + b, 0) / allGradeValues.length : null
  const highestGrade = allGradeValues.length > 0 ? Math.max(...allGradeValues) : null
  const lowestGrade = allGradeValues.length > 0 ? Math.min(...allGradeValues) : null

  const sorted = [...allGradeValues].sort((a, b) => b - a)
  let medianGrade: number | null = null
  if (sorted.length > 0) {
    const mid = Math.floor(sorted.length / 2)
    medianGrade = sorted.length % 2 !== 0 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2)
  }

  let stdDev: number | null = null
  if (sorted.length > 1 && avgGrade !== null) {
    const variance = sorted.reduce((acc, g) => acc + Math.pow(g - avgGrade, 2), 0) / sorted.length
    stdDev = Math.round(Math.sqrt(variance))
  }

  // Merge all candidates (flat list, no ranking across exams)
  const candidates = summaries.flatMap((s) => s.candidates)

  // Use first exam's distribution as approximate for rollup (or empty)
  const distribution = summaries[0]?.distribution ?? []

  return {
    totalCandidates, attendedCount, modifiedGradeCount, gradedCount, ungradedCount,
    admittedCount, eligibleNotAdmittedCount, failedCount, passedCount, passRate,
    avgGrade, medianGrade, highestGrade, lowestGrade, stdDev, distribution, candidates,
  }
}

function buildEmptyDashboard(sessionId: string, examId: string | null) {
  return {
    sessionId, examId, exams: [],
    totalCandidates: 0, attendedCount: 0, modifiedGradeCount: 0, gradedCount: 0, ungradedCount: 0,
    admittedCount: 0, eligibleNotAdmittedCount: 0, failedCount: 0, passedCount: 0, passRate: 0,
    avgGrade: null, medianGrade: null, highestGrade: null, lowestGrade: null, stdDev: null,
    distribution: [], candidates: [],
  }
}
