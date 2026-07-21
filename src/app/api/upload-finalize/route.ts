import { NextResponse } from 'next/server'
import { finalizeChunkedUpload, listMediaItems } from '@/lib/turso'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { fileId } = body

    if (!fileId || typeof fileId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'fileId requerido' },
        { status: 400 }
      )
    }

    const result = await finalizeChunkedUpload(fileId)

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Error al finalizar upload' },
        { status: 400 }
      )
    }

    // Obtener total actualizado
    const items = await listMediaItems()

    return NextResponse.json({
      success: true,
      message: `Archivo subido: ${result.filename}`,
      uploaded: [result.filename],
      id: result.id,
      totalInGallery: items.length
    })
  } catch (error) {
    console.error('Error en upload-finalize:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error al finalizar upload'
      },
      { status: 500 }
    )
  }
}
