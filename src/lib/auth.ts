import { createClient, type Client } from '@libsql/client'
import crypto from 'crypto'

let _client: Client | null = null

function getTursoClient(): Client {
  if (_client) return _client
  const url = process.env.TURSO_DATABASE_URL
  const authToken = process.env.TURSO_AUTH_TOKEN
  if (!url || !authToken) {
    throw new Error('Turso env vars missing')
  }
  _client = createClient({ url, authToken })
  return _client
}

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '1908'
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000  // 8 horas

export interface AdminSession {
  token: string
  expiresAt: number
}

// Crear tabla si no existe
export async function ensureSessionsTable(): Promise<void> {
  try {
    const client = getTursoClient()
    await client.execute({
      sql: `CREATE TABLE IF NOT EXISTS admin_sessions (
        token TEXT PRIMARY KEY,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        expires_at INTEGER NOT NULL,
        user_agent TEXT,
        ip TEXT
      )`,
      args: []
    })
    await client.execute({
      sql: `DELETE FROM admin_sessions WHERE expires_at < unixepoch() * 1000`,
      args: []
    })
  } catch (error) {
    console.error('Error ensuring sessions table:', error)
  }
}

// Verificar password y crear sesión
export async function createAdminSession(password: string, userAgent?: string, ip?: string): Promise<AdminSession | null> {
  if (password !== ADMIN_PASSWORD) return null

  await ensureSessionsTable()
  const client = getTursoClient()

  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = Date.now() + SESSION_DURATION_MS

  await client.execute({
    sql: `INSERT INTO admin_sessions (token, expires_at, user_agent, ip) VALUES (?, ?, ?, ?)`,
    args: [token, expiresAt, userAgent || null, ip || null]
  })

  return { token, expiresAt }
}

// Verificar si un token es válido
export async function verifyAdminSession(token: string): Promise<boolean> {
  if (!token) return false
  await ensureSessionsTable()
  const client = getTursoClient()

  const result = await client.execute({
    sql: `SELECT 1 FROM admin_sessions WHERE token = ? AND expires_at > ? LIMIT 1`,
    args: [token, Date.now()]
  })

  return result.rows.length > 0
}

// Extraer token del header Authorization
export function getTokenFromRequest(request: Request): string | null {
  const auth = request.headers.get('authorization')
  if (!auth) return null
  if (!auth.startsWith('Bearer ')) return null
  return auth.slice(7)
}
