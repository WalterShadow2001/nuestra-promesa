import { getMediaItem } from '@/lib/turso'
import { NextResponse } from 'next/server'

// Sirve el archivo binario (imagen o video) desde Turso
export async function GET(
  request: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params
    const decodedFilename = decodeURIComponent(filename)

    const item = await getMediaItem(decodedFilename)
    if (!item) {
      return new NextResponse('Not Found', { status: 404 })
    }

    const data = item.data
    if (!data) {
      return new NextResponse('No data', { status: 500 })
    }

    // Convertir Uint8Array a ArrayBuffer para Response
    const buffer = Buffer.from(data)

    // Headers para caching largo (las imágenes no cambian)
    const headers = new Headers()
    headers.set('Content-Type', item.mime_type)
    headers.set('Content-Length', String(buffer.length))
    headers.set('Cache-Control', 'public, max-age=31536000, immutable')
    headers.set('ETag', `"${item.id}-${item.size}"`)
    headers.set('Accept-Ranges', 'bytes')

    // Para videos, soportar range requests (streaming)
    const range = request.headers.get('range')
    if (range && item.type === 'video') {
      const match = range.match(/bytes=(\d+)-(\d*)/)
      if (match) {
        const start = parseInt(match[1], 10)
        const end = match[2] ? parseInt(match[2], 10) : buffer.length - 1
        const chunkSize = end - start + 1
        const chunk = buffer.subarray(start, end + 1)

        headers.set('Content-Range', `bytes ${start}-${end}/${buffer.length}`)
        headers.set('Content-Length', String(chunkSize))
        headers.set('Cache-Control', 'public, max-age=31536000, immutable')

        return new NextResponse(chunk, {
          status: 206,
          headers
        })
      }
    }

    return new NextResponse(buffer, {
      status: 200,
      headers
    })
  } catch (error) {
    console.error('Error serving media:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
