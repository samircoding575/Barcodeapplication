import { getDb } from '../db'

export async function listSessions() {
  return getDb().examSession.findMany({
    orderBy: [{ year: 'desc' }, { createdAt: 'desc' }],
    include: { exams: { orderBy: { order: 'asc' } } },
  })
}

export async function getActiveSession() {
  return getDb().examSession.findFirst({
    where: { isActive: true },
    include: { exams: { orderBy: { order: 'asc' } } },
  })
}

export async function createSession(data: { title: string; year: number; semester?: string | null }) {
  return getDb().examSession.create({
    data: {
      title: data.title,
      year: data.year,
      semester: data.semester ?? null,
    },
    include: { exams: true },
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
