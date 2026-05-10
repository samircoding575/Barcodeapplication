import { getDb } from '../db'

export async function listSessions() {
  return getDb().examSession.findMany({ orderBy: [{ year: 'desc' }, { createdAt: 'desc' }] })
}

export async function getActiveSession() {
  return getDb().examSession.findFirst({ where: { isActive: true } })
}

export async function createSession(data: { title: string; year: number; semester?: string | null; maxGrade?: number; step?: string; passingGrade?: number; maxPassCount?: number | null }) {
  return getDb().examSession.create({
    data: {
      ...data,
      maxGrade: data.maxGrade ?? 2000,
      step: data.step ?? '0.25',
      passingGrade: data.passingGrade ?? 1000,
      maxPassCount: data.maxPassCount ?? null,
    },
  })
}

export async function setActiveSession(id: string) {
  const db = getDb()
  return db.$transaction([
    db.examSession.updateMany({ data: { isActive: false } }),
    db.examSession.update({ where: { id }, data: { isActive: true } }),
  ])
}

export async function deleteSession(id: string) {
  return getDb().examSession.delete({ where: { id } })
}
