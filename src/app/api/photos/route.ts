import { NextResponse } from 'next/server'
import { isDriveConfigured, listMediaFiles, type DriveFile } from '@/lib/drive'
import { listMediaItems, type MediaItem } from '@/lib/turso'
import { cleanCaption } from '@/lib/turso'

interface PhotoItem {
  id: string
  filename: string
  path: string  // URL para cargar el archivo
  type: 'image' | 'video'
  size: number
  caption: string
  created_at: number
  source: 'drive' | 'turso'
}

// Cache simple en memoria (5 minutos)
let _cache: { photos: PhotoItem[]; expiresAt: number } | null = null
const CACHE_TTL_MS = 5 * 60 * 1000  // 5 minutos

function clearCache() {
  _cache = null
}

export async function GET() {
  try {
    // Si hay cache válido, usarlo
    if (_cache && _cache.expiresAt > Date.now()) {
      return NextResponse.json({
        success: true,
        count: _cache.photos.length,
        source: _cache.photos[0]?.source || 'unknown',
        items: _cache.photos,
        cached: true,
        cachedUntil: new Date(_cache.expiresAt).toISOString()
      })
    }

    let photos: PhotoItem[] = []

    if (isDriveConfigured()) {
      // Usar Google Drive
      const files = await listMediaFiles()
      photos = files.map((f: DriveFile) => ({
        id: f.id,
        filename: f.name,
        path: `/api/drive/file/${f.id}`,
        type: f.type,
        size: f.size,
        caption: cleanCaption(f.name) || getDefaultCaption(f.name),
        created_at: new Date(f.createdTime).getTime(),
        source: 'drive' as const
      }))
    } else {
      // Fallback a Turso
      const items = await listMediaItems()
      photos = items.map((item: MediaItem) => ({
        id: String(item.id),
        filename: item.filename,
        path: `/api/media/${encodeURIComponent(item.filename)}`,
        type: item.type,
        size: item.size,
        caption: item.caption || getDefaultCaption(item.filename),
        created_at: item.created_at * 1000,
        source: 'turso' as const
      }))
    }

    // Guardar en cache
    _cache = {
      photos,
      expiresAt: Date.now() + CACHE_TTL_MS
    }

    return NextResponse.json({
      success: true,
      count: photos.length,
      source: photos[0]?.source || 'unknown',
      items: photos,
      cached: false,
      cachedUntil: new Date(_cache.expiresAt).toISOString()
    })
  } catch (error) {
    console.error('Error en /api/photos:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error obteniendo fotos',
        items: [],
        count: 0
      },
      { status: 500 }
    )
  }
}

// Captions por defecto que se ciclan
const DEFAULT_CAPTIONS = [
  'Juntos para siempre',
  'Nuestro día llegó',
  'Y vivieron felices',
  'El sí que nos unió',
  'Hoy celebramos nuestro amor',
  'Gracias por acompañarnos',
  'Comparte este momento con nosotros',
  'Tú eres parte de nuestra historia',
  'Y así comenzó nuestra historia',
  'Por siempre unidos',
  'Nuestra boda, nuestro comienzo',
  'El amor nos une'
]

let _captionIdx = 0
function getDefaultCaption(filename: string): string {
  const c = cleanCaption(filename)
  if (c) return c
  const cap = DEFAULT_CAPTIONS[_captionIdx % DEFAULT_CAPTIONS.length]
  _captionIdx++
  return cap
}
