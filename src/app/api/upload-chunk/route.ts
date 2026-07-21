import { NextResponse } from 'next/server'
import { saveUploadChunk, getMediaType, getMimeType, cleanupOldChunks } from '@/lib/turso'

// Tamaño máximo por chunk: 4MB (seguro para Vercel que tiene límite 4.5MB)
const MAX_CHUNK_SIZE = 4 * 1024 * 1024

export async function POST(request: Request) {
  try {
    // Limpiar chunks antiguos cada cierto tiempo (probabilístico)
    if (Math.random() < 0.05) {
      cleanupOldChunks().catch(() => {})
    }

    const formData = await request.formData()

    const fileId = formData.get('fileId') as string
    const chunkIndex = parseInt(formData.get('chunkIndex') as string, 10)
    const totalChunks = parseInt(formData.get('totalChunks') as string, 10)
    const filename = formData.get('filename') as string
    const chunk = formData.get('chunk') as File

    // Validaciones
    if (!fileId || isNaN(chunkIndex) || isNaN(totalChunks) || !filename || !chunk) {
      return NextResponse.json(
        { success: false, error: 'Parámetros faltantes o inválidos' },
        { status: 400 }
      )
    }

    if (chunkIndex < 0 || chunkIndex >= totalChunks || totalChunks > 1000) {
      return NextResponse.json(
        { success: false, error: 'Índice de chunk inválido' },
        { status: 400 }
      )
    }

    if (chunk.size > MAX_CHUNK_SIZE) {
      return NextResponse.json(
        { success: false, error: `Chunk demasiado grande: ${(chunk.size / 1024 / 1024).toFixed(1)}MB. Máximo 4MB por chunk` },
        { status: 400 }
      )
    }

    // Validar tipo de archivo
    const type = getMediaType(filename)
    if (!type) {
      return NextResponse.json(
        { success: false, error: 'Formato no soportado' },
        { status: 400 }
      )
    }

    // Leer chunk como buffer
    const bytes = await chunk.arrayBuffer()
    const data = new Uint8Array(bytes)

    // Guardar en Turso
    await saveUploadChunk({
      fileId,
      chunkIndex,
      totalChunks,
      filename,
      mimeType: getMimeType(filename),
      data
    })

    return NextResponse.json({
      success: true,
      fileId,
      chunkIndex,
      totalChunks,
      received: chunkIndex + 1
    })
  } catch (error) {
    console.error('Error en upload-chunk:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error al guardar chunk'
      },
      { status: 500 }
    )
  }
}
