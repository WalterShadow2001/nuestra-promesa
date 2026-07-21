'use client'

export type MediaType = 'image' | 'video'

export interface ImageSettings {
  pan_x: number  // -100 a 100
  pan_y: number  // -100 a 100
  zoom: number   // 1.0 a 3.0
}

export interface GalleryItem {
  name: string
  filename: string
  path: string
  type: MediaType
  size: number
  caption: string
  image_settings: ImageSettings | null
}

export interface GalleryResponse {
  success: boolean
  count: number
  images: number
  videos: number
  items: GalleryItem[]
}

/**
 * Fetch gallery contents from API
 */
export async function fetchGallery(): Promise<GalleryResponse> {
  try {
    const res = await fetch('/api/gallery', { cache: 'no-store' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } catch (error) {
    console.error('Error fetching gallery:', error)
    return {
      success: false,
      count: 0,
      images: 0,
      videos: 0,
      items: []
    }
  }
}

/**
 * Upload files to gallery - with progress callback
 */
export async function uploadFiles(
  files: File[],
  onProgress?: (percent: number, fileName: string) => void
): Promise<{
  success: boolean
  message: string
  uploaded?: string[]
  errors?: { filename: string; error: string }[]
}> {
  try {
    const formData = new FormData()
    for (const file of files) {
      formData.append('files', file)
    }

    // Si hay callback de progreso, usar XMLHttpRequest
    if (onProgress && files.length > 0) {
      return new Promise((resolve) => {
        const xhr = new XMLHttpRequest()
        xhr.open('POST', '/api/upload')

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const percent = (e.loaded / e.total) * 100
            onProgress(percent, files[0].name)
          }
        }

        xhr.onload = () => {
          try {
            const result = JSON.parse(xhr.responseText)
            resolve(result)
          } catch {
            resolve({ success: false, message: 'Error parseando respuesta' })
          }
        }

        xhr.onerror = () => {
          resolve({ success: false, message: 'Error de red al subir archivos' })
        }

        xhr.ontimeout = () => {
          resolve({ success: false, message: 'Timeout: el servidor tardó demasiado en responder' })
        }

        xhr.timeout = 120000  // 2 minutos
        xhr.send(formData)
      })
    }

    // Sin callback: usar fetch normal
    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData
    })
    return await res.json()
  } catch (error) {
    console.error('Error uploading:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Error de conexión al subir archivos'
    }
  }
}

/**
 * Delete a file from gallery
 */
export async function deleteFile(filename: string): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch('/api/upload', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename })
    })
    return await res.json()
  } catch (error) {
    console.error('Error deleting:', error)
    return { success: false, message: 'Error de conexión' }
  }
}

/**
 * Update image settings (pan/zoom) for a file
 */
export async function updateImageSettings(
  filename: string,
  settings: ImageSettings
): Promise<{ success: boolean; message: string; settings?: ImageSettings }> {
  try {
    const res = await fetch(`/api/media/${encodeURIComponent(filename)}/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    })
    return await res.json()
  } catch (error) {
    console.error('Error updating settings:', error)
    return { success: false, message: 'Error de conexión' }
  }
}

// === Upload por chunks (para archivos grandes > 4MB) ===

const CHUNK_SIZE = 3.5 * 1024 * 1024  // 3.5MB por chunk (seguro para Vercel 4.5MB)
const UMBRAL_CHUNKED = 4 * 1024 * 1024  // Si el archivo es > 4MB, usar chunked

/**
 * Sube un archivo grande por chunks
 * Devuelve progreso por chunk completado
 */
export async function uploadFileChunked(
  file: File,
  onProgress?: (percent: number, fileName: string, chunkInfo?: { current: number; total: number }) => void
): Promise<{
  success: boolean
  message: string
  uploaded?: string[]
  errors?: { filename: string; error: string }[]
}> {
  const fileName = file.name

  try {
    // Generar fileId único
    const fileId = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`

    // Calcular chunks
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE)

    if (onProgress) onProgress(0, fileName, { current: 0, total: totalChunks })

    // Subir cada chunk
    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE
      const end = Math.min(start + CHUNK_SIZE, file.size)
      const chunk = file.slice(start, end)

      const formData = new FormData()
      formData.append('fileId', fileId)
      formData.append('chunkIndex', String(i))
      formData.append('totalChunks', String(totalChunks))
      formData.append('filename', fileName)
      formData.append('chunk', chunk)

      // Usar XMLHttpRequest para progreso real del chunk
      const chunkResult = await new Promise<{ success: boolean; error?: string }>((resolve) => {
        const xhr = new XMLHttpRequest()
        xhr.open('POST', '/api/upload-chunk')

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable && onProgress) {
            // Progreso dentro del chunk actual
            const chunkProgress = (e.loaded / e.total)
            // Progreso total = chunks completados + progreso del actual
            const totalProgress = ((i + chunkProgress) / totalChunks) * 100
            onProgress(totalProgress, fileName, { current: i + 1, total: totalChunks })
          }
        }

        xhr.onload = () => {
          if (xhr.status === 200) {
            try {
              const result = JSON.parse(xhr.responseText)
              if (result.success) {
                resolve({ success: true })
              } else {
                resolve({ success: false, error: result.error || 'Error al guardar chunk' })
              }
            } catch {
              resolve({ success: false, error: `Respuesta inválida del servidor (status ${xhr.status})` })
            }
          } else if (xhr.status === 413) {
            resolve({ success: false, error: 'Chunk demasiado grande para el servidor' })
          } else {
            resolve({ success: false, error: `Error HTTP ${xhr.status}` })
          }
        }

        xhr.onerror = () => {
          resolve({ success: false, error: 'Error de red al subir chunk' })
        }

        xhr.ontimeout = () => {
          resolve({ success: false, error: 'Timeout al subir chunk' })
        }

        xhr.timeout = 60000  // 60s por chunk
        xhr.send(formData)
      })

      if (!chunkResult.success) {
        return {
          success: false,
          message: `Error en chunk ${i + 1}/${totalChunks}: ${chunkResult.error}`,
          errors: [{ filename: fileName, error: chunkResult.error || 'Error desconocido' }]
        }
      }

      // Progreso después de completar el chunk
      if (onProgress) {
        onProgress(((i + 1) / totalChunks) * 100, fileName, { current: i + 1, total: totalChunks })
      }
    }

    // Finalizar: combinar chunks
    if (onProgress) onProgress(99, fileName, { current: totalChunks, total: totalChunks })

    const finalizeRes = await fetch('/api/upload-finalize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileId })
    })

    if (!finalizeRes.ok) {
      const text = await finalizeRes.text().catch(() => '')
      return {
        success: false,
        message: `Error al finalizar (HTTP ${finalizeRes.status}): ${text.substring(0, 200)}`,
        errors: [{ filename: fileName, error: 'Finalize failed' }]
      }
    }

    const finalizeResult = await finalizeRes.json()

    if (onProgress) onProgress(100, fileName, { current: totalChunks, total: totalChunks })

    return {
      success: finalizeResult.success,
      message: finalizeResult.message || (finalizeResult.success ? 'Subido correctamente' : 'Error al finalizar'),
      uploaded: finalizeResult.uploaded || (finalizeResult.success ? [fileName] : []),
      errors: finalizeResult.success ? [] : [{ filename: fileName, error: finalizeResult.error || 'Error' }]
    }
  } catch (error) {
    console.error('Error en uploadFileChunked:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Error de conexión',
      errors: [{ filename: fileName, error: String(error) }]
    }
  }
}

/**
 * Sube archivos. Usa chunked upload automáticamente para archivos > 4MB
 */
export async function uploadFilesSmart(
  files: File[],
  onProgress?: (percent: number, fileName: string) => void
): Promise<{
  success: boolean
  message: string
  uploaded?: string[]
  errors?: { filename: string; error: string }[]
}> {
  const uploaded: string[] = []
  const errors: { filename: string; error: string }[] = []

  for (const file of files) {
    let result
    if (file.size > UMBRAL_CHUNKED) {
      // Upload por chunks
      result = await uploadFileChunked(file, (percent, name) => {
        if (onProgress) onProgress(percent, name)
      })
    } else {
      // Upload normal
      result = await uploadFiles([file], onProgress ? (percent, name) => onProgress(percent, name) : undefined)
    }

    if (result.success && result.uploaded) {
      uploaded.push(...result.uploaded)
    } else {
      errors.push(...(result.errors || [{ filename: file.name, error: result.message }]))
    }
  }

  return {
    success: uploaded.length > 0,
    message: uploaded.length > 0
      ? `${uploaded.length} archivo(s) subido(s)${errors.length > 0 ? `, ${errors.length} con error` : ''}`
      : 'No se pudo subir ningún archivo',
    uploaded,
    errors
  }
}

