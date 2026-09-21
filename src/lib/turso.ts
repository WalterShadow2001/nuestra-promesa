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
  image_settings?: ImageSettings | null
  data?: Uint8Array  // Solo al leer individualmente
  created_at: number
}

export interface ImageSettings {
  pan_x: number  // -100 a 100 (porcentaje)
  pan_y: number  // -100 a 100 (porcentaje)
  zoom: number   // 1.0 a 3.0
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
    sql: `SELECT id, filename, original_name, mime_type, type, caption, custom_caption, size, image_settings, created_at
          FROM media_items
          ORDER BY filename COLLATE NOCASE ASC`
  })

  const items: MediaItem[] = []
  let defaultIdx = 0

  for (const row of result.rows) {
    let imageSettings: ImageSettings | null = null
    if (row.image_settings) {
      try {
        imageSettings = JSON.parse(row.image_settings as string)
      } catch {
        imageSettings = null
      }
    }

    const item: MediaItem = {
      id: row.id as number,
      filename: row.filename as string,
      original_name: row.original_name as string,
      mime_type: row.mime_type as string,
      type: row.type as MediaType,
      caption: (row.custom_caption as string) || (row.caption as string) || null,
      size: row.size as number,
      image_settings: imageSettings,
      created_at: row.created_at as number
    }

    // Si no tiene caption, asignar uno por defecto
    if (!item.caption) {
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

// Actualizar ajustes de imagen (pan/zoom) para un item
export async function updateImageSettings(
  filename: string,
  settings: ImageSettings
): Promise<boolean> {
  const client = getTursoClient()
  const result = await client.execute({
    sql: `UPDATE media_items SET image_settings = ? WHERE filename = ?`,
    args: [JSON.stringify(settings), filename]
  })
  return (result.rowsAffected || 0) > 0
}

// Actualizar título (caption) de un item
export async function updateCaption(
  filename: string,
  caption: string
): Promise<boolean> {
  const client = getTursoClient()
  const result = await client.execute({
    sql: `UPDATE media_items SET custom_caption = ? WHERE filename = ?`,
    args: [caption, filename]
  })
  return (result.rowsAffected || 0) > 0
}

// === Upload por chunks ===

interface ChunkInfo {
  fileId: string
  chunkIndex: number
  totalChunks: number
  filename: string
  mimeType: string
  data: Uint8Array
}

// Guardar un chunk
export async function saveUploadChunk(info: ChunkInfo): Promise<void> {
  const client = getTursoClient()
  await client.execute({
    sql: `INSERT INTO upload_chunks (file_id, chunk_index, total_chunks, filename, mime_type, data, created_at)
          VALUES (?, ?, ?, ?, ?, ?, unixepoch())`,
    args: [
      info.fileId,
      info.chunkIndex,
      info.totalChunks,
      info.filename,
      info.mimeType,
      Buffer.from(info.data)
    ]
  })
}

// Verificar si todos los chunks de un archivo están listos
export async function checkAllChunksReady(fileId: string): Promise<{
  ready: boolean
  totalExpected: number
  totalReceived: number
  filename: string
  mimeType: string
}> {
  const client = getTursoClient()
  const result = await client.execute({
    sql: `SELECT file_id, total_chunks, filename, mime_type, COUNT(*) as received
          FROM upload_chunks
          WHERE file_id = ?
          GROUP BY file_id, total_chunks, filename, mime_type`,
    args: [fileId]
  })

  if (result.rows.length === 0) {
    return { ready: false, totalExpected: 0, totalReceived: 0, filename: '', mimeType: '' }
  }

  const row = result.rows[0]
  const totalExpected = row.total_chunks as number
  const totalReceived = row.received as number
  return {
    ready: totalReceived === totalExpected,
    totalExpected,
    totalReceived,
    filename: row.filename as string,
    mimeType: row.mime_type as string
  }
}

// Combinar chunks y crear media_item
export async function finalizeChunkedUpload(fileId: string): Promise<{
  success: boolean
  filename: string
  id?: number
  error?: string
}> {
  const client = getTursoClient()
  // Obtener metadata del primer chunk
  const metaResult = await client.execute({
    sql: `SELECT filename, mime_type, total_chunks FROM upload_chunks WHERE file_id = ? LIMIT 1`,
    args: [fileId]
  })
  if (metaResult.rows.length === 0) {
    return { success: false, filename: '', error: 'No se encontraron chunks para este fileId' }
  }

  const originalFilename = metaResult.rows[0].filename as string
  const mimeType = metaResult.rows[0].mime_type as string
  const totalChunks = metaResult.rows[0].total_chunks as number

  // Verificar que están todos los chunks
  const countResult = await client.execute({
    sql: `SELECT COUNT(*) as count FROM upload_chunks WHERE file_id = ?`,
    args: [fileId]
  })
  const received = countResult.rows[0].count as number
  if (received !== totalChunks) {
    return {
      success: false,
      filename: originalFilename,
      error: `Chunks incompletos: ${received}/${totalChunks}`
    }
  }

  // Leer todos los chunks en orden
  const chunksResult = await client.execute({
    sql: `SELECT data FROM upload_chunks WHERE file_id = ? ORDER BY chunk_index ASC`,
    args: [fileId]
  })

  // Concatenar chunks
  const chunks: Buffer[] = []
  let totalSize = 0
  for (const row of chunksResult.rows) {
    const chunk = Buffer.from(row.data as Uint8Array)
    chunks.push(chunk)
    totalSize += chunk.length
  }
  const fullData = Buffer.concat(chunks, totalSize)

  // Determinar tipo
  const type = getMediaType(originalFilename)
  if (!type) {
    // Limpiar chunks
    await client.execute({
      sql: `DELETE FROM upload_chunks WHERE file_id = ?`,
      args: [fileId]
    })
    return { success: false, filename: originalFilename, error: 'Formato no soportado' }
  }

  // Generar filename único
  const safeName = await getUniqueFilename(originalFilename)

  // Caption automático
  const caption = cleanCaption(originalFilename) || null

  // Insertar en media_items
  const insertResult = await client.execute({
    sql: `INSERT INTO media_items (filename, original_name, mime_type, type, caption, size, data, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, unixepoch())`,
    args: [
      safeName,
      originalFilename,
      mimeType,
      type,
      caption,
      totalSize,
      fullData
    ]
  })

  // Limpiar chunks
  await client.execute({
    sql: `DELETE FROM upload_chunks WHERE file_id = ?`,
    args: [fileId]
  })

  return {
    success: true,
    filename: safeName,
    id: Number(insertResult.lastInsertRowid)
  }
}

// Limpiar chunks antiguos (más de 1 hora) - para limpieza periódica
export async function cleanupOldChunks(): Promise<number> {
  const client = getTursoClient()
  const result = await client.execute({
    sql: `DELETE FROM upload_chunks WHERE created_at < unixepoch() - 3600`
  })
  return result.rowsAffected || 0
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
