// API route - upload media files to Turso DB

import { NextResponse } from 'next/server'
import {
  createMediaItem,
  deleteMediaItem,
  getMediaType,
  getMimeType,
  getUniqueFilename,
  cleanCaption,
  listMediaItems
} from '@/lib/turso'

// Tamaño máximo: 50MB (Turso tiene límites en BLOBs)
const MAX_SIZE = 50 * 1024 * 1024

function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const files = formData.getAll('files')

    if (!files || files.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No se recibieron archivos' },
        { status: 400 }
      )
    }

    const uploaded: string[] = []
    const errors: { filename: string; error: string }[] = []

    for (const file of files) {
      if (!(file instanceof File)) {
        errors.push({ filename: 'unknown', error: 'No es un archivo válido' })
        continue
      }

      const filename = file.name
      const ext = '.' + (filename.toLowerCase().match(/\.([^.]+)$/)?.[1] || '')
      const type = getMediaType(filename)

      if (!type) {
        errors.push({
          filename,
          error: `Formato no soportado: ${ext}. Permitidos: jpg, png, webp, gif, mp4, webm, mov`
        })
        continue
      }

      if (file.size > MAX_SIZE) {
        errors.push({
          filename,
          error: `Archivo demasiado grande: ${(file.size / 1024 / 1024).toFixed(1)}MB. Máximo: 50MB`
        })
        continue
      }

      // Generar nombre único en Turso
      const safeName = await getUniqueFilename(sanitizeFilename(filename))

      // Leer el archivo como ArrayBuffer
      const bytes = await file.arrayBuffer()
      const data = new Uint8Array(bytes)

      // Caption automático desde el nombre
      const caption = cleanCaption(filename) || null

      // Insertar en Turso
      const id = await createMediaItem({
        filename: safeName,
        original_name: filename,
        mime_type: getMimeType(filename),
        type,
        caption,
        size: file.size,
        data
      })

      uploaded.push(safeName)
      console.log(`✓ Uploaded to Turso (id=${id}): ${safeName} (${(file.size / 1024).toFixed(1)} KB)`)
    }

    // Contar total en DB
    const items = await listMediaItems()

    return NextResponse.json({
      success: true,
      message: `${uploaded.length} archivo(s) subido(s) correctamente`,
      uploaded,
      errors,
      totalInGallery: items.length
    })
  } catch (error) {
    console.error('Error en upload:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido en upload'
      },
      { status: 500 }
    )
  }
}

// Eliminar archivo
export async function DELETE(request: Request) {
  try {
    const body = await request.json()
    const filename = body.filename

    if (!filename || typeof filename !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Filename requerido' },
        { status: 400 }
      )
    }

    // Sanitizar para evitar path traversal
    const safeName = filename.split('/').pop() || filename

    const deleted = await deleteMediaItem(safeName)
    if (!deleted) {
      return NextResponse.json(
        { success: false, error: 'Archivo no encontrado' },
        { status: 404 }
      )
    }

    console.log(`✓ Deleted from Turso: ${safeName}`)
    return NextResponse.json({
      success: true,
      message: `${safeName} eliminado correctamente`
    })
  } catch (error) {
    console.error('Error en delete:', error)
    return NextResponse.json(
      { success: false, error: 'Error al eliminar archivo' },
      { status: 500 }
    )
  }
}

// GET /api/upload - info
export async function GET() {
  try {
    const items = await listMediaItems()
    return NextResponse.json({
      success: true,
      total: items.length,
      images: items.filter(i => i.type === 'image').length,
      videos: items.filter(i => i.type === 'video').length
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Error al obtener info' },
      { status: 500 }
    )
  }
}

/* Last updated: Tue Jul 21 03:26:56 UTC 2026 */
