import { NextResponse } from 'next/server'
import { getFileContent } from '@/lib/drive'

// GET /api/drive/file/[id] - servir archivo binario desde Drive
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const result = await getFileContent(id)
    if (!result) {
      return new NextResponse('Not Found', { status: 404 })
    }

    const headers = new Headers()
    headers.set('Content-Type', result.mimeType)
    headers.set('Content-Length', String(result.data.length))
    headers.set('Cache-Control', 'public, max-age=31536000, immutable')
    headers.set('Accept-Ranges', 'bytes')

    // Para videos, soportar range requests
    const range = request.headers.get('range')
    if (range && result.mimeType.startsWith('video/')) {
      const match = range.match(/bytes=(\d+)-(\d*)/)
      if (match) {
        const start = parseInt(match[1], 10)
        const end = match[2] ? parseInt(match[2], 10) : result.data.length - 1
        const chunk = result.data.subarray(start, end + 1)
        headers.set('Content-Range', `bytes ${start}-${end}/${result.data.length}`)
        headers.set('Content-Length', String(chunk.length))
        return new NextResponse(chunk, { status: 206, headers })
      }
    }

    return new NextResponse(result.data, { status: 200, headers })
  } catch (error) {
    console.error('Error serving Drive file:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
