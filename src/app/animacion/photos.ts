'use client'

export type MediaType = 'image' | 'video'

export interface PhotoItem {
  id: string
  filename: string
  path: string
  type: MediaType
  size: number
  caption: string
  created_at: number
  source: 'drive' | 'turso'
}

export interface PhotosResponse {
  success: boolean
  count: number
  source: string
  items: PhotoItem[]
  cached?: boolean
  cachedUntil?: string
}

/**
 * Lista de fotos (cacheada 5 min en el backend)
 */
export async function fetchPhotos(): Promise<PhotosResponse> {
  try {
    const res = await fetch('/api/photos', { cache: 'no-store' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } catch (error) {
    console.error('Error fetching photos:', error)
    return { success: false, count: 0, source: 'unknown', items: [] }
  }
}

/**
 * Subir archivos (guest upload)
 */
export async function uploadPhotos(
  files: File[],
  onProgress?: (percent: number, fileName: string) => void
): Promise<{
  success: boolean
  message: string
  uploaded?: string[]
  errors?: { filename: string; error: string }[]
}> {
  if (files.length === 0) {
    return { success: false, message: 'No hay archivos' }
  }

  const formData = new FormData()
  for (const file of files) {
    formData.append('files', file)
  }

  // XMLHttpRequest para progreso
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', '/api/drive/upload')

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
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
      resolve({ success: false, message: 'Error de red' })
    }

    xhr.ontimeout = () => {
      resolve({ success: false, message: 'Timeout' })
    }

    xhr.timeout = 120000
    xhr.send(formData)
  })
}

/**
 * Admin login
 */
export async function adminLogin(password: string): Promise<{
  success: boolean
  token?: string
  message: string
}> {
  try {
    const res = await fetch('/api/auth/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    })
    const result = await res.json()
    return {
      success: result.success,
      token: result.token,
      message: result.message || result.error || ''
    }
  } catch (error) {
    return { success: false, message: 'Error de conexión' }
  }
}

/**
 * Verificar si el token admin sigue activo
 */
export async function verifyAdminToken(token: string): Promise<boolean> {
  try {
    const res = await fetch('/api/auth/admin', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    const result = await res.json()
    return result.authenticated === true
  } catch {
    return false
  }
}

/**
 * Eliminar foto (admin)
 */
export async function deletePhoto(photoId: string, token: string): Promise<{
  success: boolean
  message: string
}> {
  try {
    const res = await fetch(`/api/drive/delete/${encodeURIComponent(photoId)}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    })
    return await res.json()
  } catch (error) {
    return { success: false, message: 'Error de conexión' }
  }
}

/**
 * Actualizar título de una foto (admin)
 */
export async function updatePhotoCaption(
  photoId: string,
  caption: string,
  token: string
): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch(`/api/photos/${encodeURIComponent(photoId)}/caption`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ caption })
    })
    return await res.json()
  } catch (error) {
    return { success: false, message: 'Error de conexión' }
  }
}
