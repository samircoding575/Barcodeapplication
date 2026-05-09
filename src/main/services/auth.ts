import bcrypt from 'bcryptjs'
import { getDb } from '../db'

const SALT_ROUNDS = 10

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export async function findUserByEmail(email: string) {
  return getDb().user.findUnique({ where: { email } })
}

export async function createUser(email: string, password: string) {
  const pwdHash = await hashPassword(password)
  return getDb().user.create({
    data: { email, pwdHash, role: 'TEACHER' },
  })
}
