import { NextResponse } from 'next/server'
import { isDriveConfigured, uploadFile } from '@/lib/drive'
import { createMediaItem, getMediaType, getMimeType, getUniqueFilename } from '@/lib/turso'
import { clearPhotosCache } from '@/lib/photos-cache'

const MAX_SIZE = 50 * 1024 * 1024  // 50MB

function sanitizeFilename(name: string): string {
  return name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/\s+/g, ' ').trim()
}

// POST /api/drive/upload - subir archivo (guest)
export async function POST(request: Request) {
  try {
    if (!isDriveConfigured()) {
      // Fallback a Turso si Drive no está configurado
      return await uploadToTurso(request)
    }

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
        errors.push({ filename: 'unknown', error: 'Archivo inválido' })
        continue
      }

      const filename = file.name
      const type = getMediaType(filename)
      if (!type) {
        errors.push({ filename, error: 'Formato no soportado' })
        continue
      }

      if (file.size > MAX_SIZE) {
        errors.push({ filename, error: 'Archivo demasiado grande (máx 50MB)' })
        continue
      }

      const bytes = await file.arrayBuffer()
      const data = Buffer.from(bytes)
      const mimeType = getMimeType(filename)
      const safeName = sanitizeFilename(filename)

      const uploadedFile = await uploadFile(safeName, mimeType, data)
      if (uploadedFile) {
        uploaded.push(uploadedFile.name)
      } else {
        errors.push({ filename, error: 'Error al subir a Drive' })
      }
    }

    if (uploaded.length > 0) {
      clearPhotosCache()
    }

    return NextResponse.json({
      success: uploaded.length > 0,
      message: uploaded.length > 0
        ? `${uploaded.length} foto(s) subida(s). ¡Gracias por compartir!`
        : 'No se pudo subir ninguna foto',
      uploaded,
      errors
    })
  } catch (error) {
    console.error('Error en /api/drive/upload:', error)
    return NextResponse.json(
      { success: false, error: 'Error al subir archivo' },
      { status: 500 }
    )
  }
}

// Fallback a Turso
async function uploadToTurso(request: Request) {
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
      if (!(file instanceof File)) continue
      const filename = file.name
      const type = getMediaType(filename)
      if (!type) {
        errors.push({ filename, error: 'Formato no soportado' })
        continue
      }
      if (file.size > MAX_SIZE) {
        errors.push({ filename, error: 'Archivo demasiado grande' })
        continue
      }

      const bytes = await file.arrayBuffer()
      const data = new Uint8Array(bytes)
      const safeName = await getUniqueFilename(sanitizeFilename(filename))

      await createMediaItem({
        filename: safeName,
        original_name: filename,
        mime_type: getMimeType(filename),
        type,
        size: file.size,
        data
      })
      uploaded.push(safeName)
    }

    if (uploaded.length > 0) {
      clearPhotosCache()
    }

    return NextResponse.json({
      success: uploaded.length > 0,
      message: uploaded.length > 0
        ? `${uploaded.length} foto(s) subida(s). ¡Gracias por compartir!`
        : 'No se pudo subir ninguna foto',
      uploaded,
      errors
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Error al subir (fallback)' },
      { status: 500 }
    )
  }
}
