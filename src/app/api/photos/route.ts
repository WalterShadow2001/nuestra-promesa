import { NextResponse } from 'next/server'
import { isDriveConfigured, listMediaFiles, type DriveFile } from '@/lib/drive'
import { listMediaItems, type MediaItem } from '@/lib/turso'
import { cleanCaption } from '@/lib/turso'
import { getPhotosCache, setPhotosCache } from '@/lib/photos-cache'

interface PhotoItem {
  id: string
  filename: string
  path: string
  type: 'image' | 'video'
  size: number
  caption: string
  created_at: number
  source: 'drive' | 'turso'
}

export async function GET() {
  try {
    // Si hay cache válido, usarlo
    const cached = getPhotosCache()
    if (cached) {
      return NextResponse.json({
        success: true,
        count: cached.length,
        source: cached[0]?.source || 'unknown',
        items: cached,
        cached: true
      })
    }

    let photos: PhotoItem[] = []

    if (isDriveConfigured()) {
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
    setPhotosCache(photos)

    return NextResponse.json({
      success: true,
      count: photos.length,
      source: photos[0]?.source || 'unknown',
      items: photos,
      cached: false
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

// Captions por defecto
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
