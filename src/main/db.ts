import { PrismaClient } from '@prisma/client'
import { app } from 'electron'
import path from 'path'

let _client: PrismaClient | null = null

export function getDb(): PrismaClient {
  if (!_client) {
    // __dirname is out/main/ in dev and resources/app/out/main/ when packaged.
    // Both cases resolve correctly relative to the project/app root.
    const dbPath = app.isPackaged
      ? path.join(app.getPath('userData'), 'qrecs.db')
      : path.join(__dirname, '../../prisma/qrecs.db')

    process.env.DATABASE_URL = `file:${dbPath}`
    _client = new PrismaClient()
  }
  return _client
}

export async function closeDb(): Promise<void> {
  if (_client) {
    await _client.$disconnect()
    _client = null
  }
}
