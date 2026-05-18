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

// One-shot migration: normalise legacy User rows so authentication works
// consistently in production.
//
// Two issues are fixed here:
//
// 1. Legacy role values (TEACHER, ADMIN_READONLY, etc.) — the login handler
//    only accepts ADMIN/USER1, so older accounts silently fail login while
//    signup reports the email is already taken, locking the user out.
//
// 2. Mixed-case emails — auth handlers always lookup with .toLowerCase(), but
//    SQLite's unique constraint is case-sensitive. If a row was stored as
//    `Foo@bar.com`, lookups for `foo@bar.com` miss it (cannot log in) but
//    creating a fresh `foo@bar.com` succeeds with no unique-violation,
//    producing two visually-identical accounts.
export async function migrateLegacyUserRoles(): Promise<void> {
  try {
    const db = getDb()
    const roleFixed = await db.$executeRaw`UPDATE User SET role = 'USER1' WHERE role NOT IN ('ADMIN', 'USER1')`
    if (roleFixed > 0) {
      console.log(`[migrate] Normalised role for ${roleFixed} legacy user account(s) → USER1`)
    }
    const emailFixed = await db.$executeRaw`UPDATE User SET email = LOWER(email) WHERE email != LOWER(email)`
    if (emailFixed > 0) {
      console.log(`[migrate] Lowercased email for ${emailFixed} legacy user account(s)`)
    }
  } catch (err) {
    console.error('[migrate] migrateLegacyUserRoles failed:', err)
  }
}
