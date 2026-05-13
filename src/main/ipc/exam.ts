import { ipcMain } from 'electron'
import { getDb } from '../db'
import { ExamChannels } from '../../shared/ipc'
import { requireAdmin } from './guard'

function serializeExam(e: {
  id: string; sessionId: string; name: string; order: number
  maxGrade: number; step: string; passingGrade: number; maxPassCount: number | null
  createdAt: Date
}) {
  return { ...e, createdAt: e.createdAt.toISOString() }
}

export function registerExamHandlers(): void {
  ipcMain.handle(ExamChannels.LIST, async (_, { sessionId }: { sessionId: string }) => {
    try {
      const exams = await getDb().exam.findMany({
        where: { sessionId },
        orderBy: { order: 'asc' },
      })
      return exams.map(serializeExam)
    } catch (err) {
      console.error('[exam/list]', err)
      return []
    }
  })

  ipcMain.handle(ExamChannels.CREATE, requireAdmin(async (_, data: {
    sessionId: string; name: string; order: number
    maxGrade: number; step: string; passingGrade: number; maxPassCount?: number | null
  }) => {
    try {
      const db = getDb()
      const count = await db.exam.count({ where: { sessionId: data.sessionId } })
      if (count >= 4) {
        return { success: false, error: 'A session can have at most 4 exams' }
      }
      const exam = await db.exam.create({
        data: {
          sessionId: data.sessionId,
          name: data.name,
          order: data.order,
          maxGrade: data.maxGrade,
          step: data.step,
          passingGrade: data.passingGrade,
          maxPassCount: data.maxPassCount ?? null,
        },
      })
      return { success: true, exam: serializeExam(exam) }
    } catch (err) {
      console.error('[exam/create]', err)
      return { success: false, error: (err as Error).message }
    }
  }) as Parameters<typeof ipcMain.handle>[1])

  ipcMain.handle(ExamChannels.UPDATE, requireAdmin(async (_, data: {
    examId: string; name?: string; order?: number
    maxGrade?: number; step?: string; passingGrade?: number; maxPassCount?: number | null
  }) => {
    try {
      const { examId, ...patch } = data
      await getDb().exam.update({ where: { id: examId }, data: patch })
      return { success: true }
    } catch (err) {
      console.error('[exam/update]', err)
      return { success: false, error: (err as Error).message }
    }
  }) as Parameters<typeof ipcMain.handle>[1])

  ipcMain.handle(ExamChannels.DELETE, requireAdmin(async (_, { examId }: { examId: string }) => {
    try {
      await getDb().exam.delete({ where: { id: examId } })
      return { success: true }
    } catch (err) {
      console.error('[exam/delete]', err)
      return { success: false, error: (err as Error).message }
    }
  }) as Parameters<typeof ipcMain.handle>[1])
}
