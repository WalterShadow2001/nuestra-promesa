'use client'

export type MediaType = 'image' | 'video'

export interface GalleryItem {
  name: string
  filename: string
  path: string
  type: MediaType
  size: number
  caption: string
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
 * Upload files to gallery
 */
export async function uploadFiles(files: File[]): Promise<{
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
    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData
    })
    return await res.json()
  } catch (error) {
    console.error('Error uploading:', error)
    return {
      success: false,
      message: 'Error de conexión al subir archivos'
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
