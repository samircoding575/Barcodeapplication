import { getDb } from '../db'

const SINGLETON_ID = 'singleton'

export async function getExamConfig() {
  const db = getDb()
  return db.examConfig.upsert({
    where: { id: SINGLETON_ID },
    create: { id: SINGLETON_ID },
    update: {},
  })
}

export async function updateExamConfig(
  patch: Partial<{ title: string; year: number; session: string | null; organization: string }>
) {
  const db = getDb()
  return db.examConfig.upsert({
    where: { id: SINGLETON_ID },
    create: { id: SINGLETON_ID, ...patch },
    update: patch,
  })
}
