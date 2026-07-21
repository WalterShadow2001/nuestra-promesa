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

