import { createId } from '@paralleldrive/cuid2'
import { getDb } from '../db'

export async function generateBatchForSession(sessionId: string): Promise<number> {
  const db = getDb()
  const students = await db.student.findMany({
    include: { barcodes: { where: { sessionId } } },
  })
  const missing = students.filter((s) => s.barcodes.length === 0)
  if (missing.length === 0) return 0
  await db.$transaction(
    missing.map((s) => db.barcode.create({ data: { token: createId(), studentId: s.id, sessionId } }))
  )
  return missing.length
}

export async function listBarcodesForSession(sessionId: string) {
  return getDb().barcode.findMany({
    where: { sessionId },
    include: { student: { select: { externalId: true, name: true } } },
    orderBy: { student: { externalId: 'asc' } },
  })
}
