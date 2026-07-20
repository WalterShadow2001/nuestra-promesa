import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const GALLERY_DIR = path.join(process.cwd(), 'public', 'images', 'gallery')

const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.gif']
const VIDEO_EXTS = ['.mp4', '.webm', '.mov', '.m4v']

type GalleryItem = {
  name: string
  filename: string
  path: string
  type: 'image' | 'video'
  size: number
  caption: string
}

// Captions por defecto que se ciclan si hay más fotos que captions
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

function cleanCaption(filename: string): string {
  // Quitar extensión
  const name = filename.replace(/\.[^/.]+$/, '')
  // Si el nombre es solo "foto1" o "01-" (genérico), no usar como caption
  if (/^(foto|img|image|video|vid)\s*\d+$/i.test(name)) return ''
  if (/^\d+[-_]/.test(name)) {
    // "01-Para siempre" → "Para siempre"
    const cleaned = name.replace(/^\d+[-_]\s*/, '')
    if (cleaned.length > 0) return cleaned.replace(/[-_]/g, ' ').trim()
  }
  // Si el nombre es descriptivo, úsalo
  if (name.length > 3 && !/^\d+$/.test(name)) {
    return name.replace(/[-_]/g, ' ').trim()
  }
  return ''
}

export async function GET() {
  try {
    // Asegurar que el directorio existe
    if (!fs.existsSync(GALLERY_DIR)) {
      fs.mkdirSync(GALLERY_DIR, { recursive: true })
    }

    const files = fs.readdirSync(GALLERY_DIR)
    const items: GalleryItem[] = []

    for (const file of files) {
      const ext = path.extname(file).toLowerCase()
      const isImage = IMAGE_EXTS.includes(ext)
      const isVideo = VIDEO_EXTS.includes(ext)

      if (!isImage && !isVideo) continue

      const fullPath = path.join(GALLERY_DIR, file)
      const stat = fs.statSync(fullPath)
      if (!stat.isFile()) continue

      const caption = cleanCaption(file)

      items.push({
        name: file,
        filename: file,
        path: `/images/gallery/${file}`,
        type: isImage ? 'image' : 'video',
        size: stat.size,
        caption
      })
    }

    // Ordenar alfabéticamente
    items.sort((a, b) => a.filename.localeCompare(b.filename, 'es', { numeric: true }))

    // Asignar captions por defecto a los que no tengan
    let defaultIdx = 0
    for (const item of items) {
      if (!item.caption) {
        item.caption = DEFAULT_CAPTIONS[defaultIdx % DEFAULT_CAPTIONS.length]
        defaultIdx++
      }
    }

    return NextResponse.json({
      success: true,
      count: items.length,
      images: items.filter(i => i.type === 'image').length,
      videos: items.filter(i => i.type === 'video').length,
      items
    })
  } catch (error) {
    console.error('Error scanning gallery:', error)
    return NextResponse.json(
      { success: false, error: 'Error scanning gallery', items: [], count: 0 },
      { status: 500 }
    )
  }
}
