import { NextResponse } from 'next/server'
import { listMediaItems, type MediaItem, type ImageSettings } from '@/lib/turso'

type GalleryResponse = {
  success: boolean
  count: number
  images: number
  videos: number
  items: Array<{
    id: number
    name: string
    filename: string
    path: string
    type: 'image' | 'video'
    size: number
    caption: string
    mime_type: string
    image_settings: ImageSettings | null
    created_at: number
  }>
}

export async function GET() {
  try {
    const items = await listMediaItems()

    const response: GalleryResponse = {
      success: true,
      count: items.length,
      images: items.filter(i => i.type === 'image').length,
      videos: items.filter(i => i.type === 'video').length,
      items: items.map((item: MediaItem) => ({
        id: item.id,
        name: item.filename,
        filename: item.filename,
        path: `/api/media/${encodeURIComponent(item.filename)}`,
        type: item.type,
        size: item.size,
        caption: item.caption || '',
        mime_type: item.mime_type,
        image_settings: item.image_settings || null,
        created_at: item.created_at
      }))
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error listing media items:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error scanning gallery',
        items: [],
        count: 0,
        images: 0,
        videos: 0
      },
      { status: 500 }
    )
  }
}
