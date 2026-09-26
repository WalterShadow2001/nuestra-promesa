// Cache compartido para la lista de fotos
// Permite que los endpoints de delete/upload/caption invaliden el cache

let _photosCache: { photos: any[]; expiresAt: number } | null = null
const CACHE_TTL_MS = 60 * 1000  // Reducido a 1 minuto para frescura

export function getPhotosCache(): any[] | null {
  if (_photosCache && _photosCache.expiresAt > Date.now()) {
    return _photosCache.photos
  }
  return null
}

export function setPhotosCache(photos: any[]): void {
  _photosCache = {
    photos,
    expiresAt: Date.now() + CACHE_TTL_MS
  }
}

export function clearPhotosCache(): void {
  _photosCache = null
}
