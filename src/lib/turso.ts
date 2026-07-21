import { createClient, type Client } from '@libsql/client'

let _client: Client | null = null

export function getTursoClient(): Client {
  if (_client) return _client

  const url = process.env.TURSO_DATABASE_URL
  const authToken = process.env.TURSO_AUTH_TOKEN

  if (!url || !authToken) {
    throw new Error(
      'Turso env vars missing. Need TURSO_DATABASE_URL and TURSO_AUTH_TOKEN. ' +
      `Got URL: ${url ? 'set' : 'missing'}, Token: ${authToken ? 'set' : 'missing'}`
    )
  }

  _client = createClient({
    url,
    authToken,
  })

  return _client
}

export type MediaType = 'image' | 'video'

export interface MediaItem {
  id: number
  filename: string
  original_name: string
  mime_type: string
  type: MediaType
  caption: string | null
  size: number
  data?: Uint8Array  // Solo al leer individualmente
  created_at: number
}

// Captions por defecto que se ciclan
const DEFAULT_CAPTIONS = [
  'Para siempre',
  'Nuestro comienzo',
  'Un sí para siempre',
  'Nuestra historia',
  'El sí',
  'Nuestro amor',
  'Juntos para siempre',
  'Nuestro principio',
  'Por siempre',
  'Nuestro siempre'
]

const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.gif']
const VIDEO_EXTS = ['.mp4', '.webm', '.mov', '.m4v']

export function getMediaType(filename: string): MediaType | null {
  const ext = filename.toLowerCase().match(/\.([^.]+)$/)?.[1]
  if (!ext) return null
  if (IMAGE_EXTS.includes(`.${ext}`)) return 'image'
  if (VIDEO_EXTS.includes(`.${ext}`)) return 'video'
  return null
}

export function getMimeType(filename: string): string {
  const ext = filename.toLowerCase().match(/\.([^.]+)$/)?.[1]
  const map: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    mp4: 'video/mp4',
    webm: 'video/webm',
    mov: 'video/quicktime',
    m4v: 'video/x-m4v',
  }
  return map[ext || ''] || 'application/octet-stream'
}

export function cleanCaption(filename: string): string {
  // Quitar extensión
  const name = filename.replace(/\.[^/.]+$/, '')
  if (/^(foto|img|image|video|vid)\s*\d+$/i.test(name)) return ''
  if (/^\d+[-_]/.test(name)) {
    const cleaned = name.replace(/^\d+[-_]\s*/, '')
    if (cleaned.length > 0) return cleaned.replace(/[-_]/g, ' ').trim()
  }
  if (name.length > 3 && !/^\d+$/.test(name)) {
    return name.replace(/[-_]/g, ' ').trim()
  }
  return ''
}

// Listar todos los items (sin data BLOB)
export async function listMediaItems(): Promise<MediaItem[]> {
  const client = getTursoClient()
  const result = await client.execute({
    sql: `SELECT id, filename, original_name, mime_type, type, caption, size, created_at
          FROM media_items
          ORDER BY filename COLLATE NOCASE ASC`
  })

  const items: MediaItem[] = []
  let defaultIdx = 0

  for (const row of result.rows) {
    const item: MediaItem = {
      id: row.id as number,
      filename: row.filename as string,
      original_name: row.original_name as string,
      mime_type: row.mime_type as string,
      type: row.type as MediaType,
      caption: (row.caption as string) || null,
      size: row.size as number,
      created_at: row.created_at as number
    }

    // Si no tiene caption, asignar uno por defecto
    if (!item.caption) {
      // Primero intentar extraer del nombre del archivo
      const fileCaption = cleanCaption(item.filename)
      if (fileCaption) {
        item.caption = fileCaption
      } else {
        item.caption = DEFAULT_CAPTIONS[defaultIdx % DEFAULT_CAPTIONS.length]
        defaultIdx++
      }
    }

    items.push(item)
  }

  return items
}

// Crear nuevo item (con data BLOB)
export async function createMediaItem(item: {
  filename: string
  original_name: string
  mime_type: string
  type: MediaType
  caption?: string | null
  size: number
  data: Uint8Array
}): Promise<number> {
  const client = getTursoClient()
  const result = await client.execute({
    sql: `INSERT INTO media_items (filename, original_name, mime_type, type, caption, size, data, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, unixepoch())`,
    args: [
      item.filename,
      item.original_name,
      item.mime_type,
      item.type,
      item.caption || null,
      item.size,
      Buffer.from(item.data)
    ]
  })
  return Number(result.lastInsertRowid)
}

// Obtener item por filename (con data BLOB)
export async function getMediaItem(filename: string): Promise<MediaItem | null> {
  const client = getTursoClient()
  const result = await client.execute({
    sql: `SELECT * FROM media_items WHERE filename = ? LIMIT 1`,
    args: [filename]
  })
  if (result.rows.length === 0) return null
  const row = result.rows[0]
  return {
    id: row.id as number,
    filename: row.filename as string,
    original_name: row.original_name as string,
    mime_type: row.mime_type as string,
    type: row.type as MediaType,
    caption: (row.caption as string) || null,
    size: row.size as number,
    data: row.data as Uint8Array,
    created_at: row.created_at as number
  }
}

// Eliminar item por filename
export async function deleteMediaItem(filename: string): Promise<boolean> {
  const client = getTursoClient()
  const result = await client.execute({
    sql: `DELETE FROM media_items WHERE filename = ?`,
    args: [filename]
  })
  return (result.rowsAffected || 0) > 0
}

// Generar filename único
export async function getUniqueFilename(filename: string): Promise<string> {
  const client = getTursoClient()
  const base = filename.replace(/\.[^/.]+$/, '')
  const ext = filename.match(/\.([^.]+)$/)?.[0] || ''

  let candidate = filename
  let counter = 1

  while (true) {
    const result = await client.execute({
      sql: `SELECT 1 FROM media_items WHERE filename = ? LIMIT 1`,
      args: [candidate]
    })
    if (result.rows.length === 0) break
    candidate = `${base}_${counter}${ext}`
    counter++
  }

  return candidate
}
