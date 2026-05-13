import { PrismaClient } from '@prisma/client'
import { app } from 'electron'
import path from 'path'
import fs from 'fs'

let _client: PrismaClient | null = null

export function getDb(): PrismaClient {
  if (!_client) {
    const dbPath = app.isPackaged
      ? path.join(app.getPath('userData'), 'qrecs.db')
      : path.join(__dirname, '../../prisma/qrecs.db')

    // Automatic Schema Initialization for Production
    if (app.isPackaged) {
      ensureDatabaseExists(dbPath)
    }

    process.env.DATABASE_URL = `file:${dbPath}`
    _client = new PrismaClient()
  }
  return _client
}

function ensureDatabaseExists(dbPath: string): void {
  try {
    const dbDir = path.dirname(dbPath)
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true })
    }

    if (!fs.existsSync(dbPath)) {
      console.log('Production database missing. Copying template...')
      
      // Template path inside the packaged resources folder
      const templatePath = path.join(process.resourcesPath, 'prisma', 'qrecs.db')
      
      if (fs.existsSync(templatePath)) {
        fs.copyFileSync(templatePath, dbPath)
        console.log('Database initialized from template.')
      } else {
        console.error('Database template not found at:', templatePath)
      }
    }
  } catch (error) {
    console.error('Failed to ensure database exists:', error)
  }
}

export async function closeDb(): Promise<void> {
  if (_client) {
    await _client.$disconnect()
    _client = null
  }
}
