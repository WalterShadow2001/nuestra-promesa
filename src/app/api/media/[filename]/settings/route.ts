import { NextResponse } from 'next/server'
import { updateImageSettings, type ImageSettings } from '@/lib/turso'

// PATCH /api/media/[filename]/settings - actualizar ajustes de pan/zoom
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params
    const decodedFilename = decodeURIComponent(filename)
    const body = await request.json()

    // Validar que los valores estén en rangos razonables
    // zoom puede ser 0.5 (alejar) hasta 3.0 (acercar mucho)
    const settings: ImageSettings = {
      pan_x: Math.max(-100, Math.min(100, Number(body.pan_x) || 0)),
      pan_y: Math.max(-100, Math.min(100, Number(body.pan_y) || 0)),
      zoom: Math.max(0.3, Math.min(3.0, Number(body.zoom) || 1.0))
    }

    const updated = await updateImageSettings(decodedFilename, settings)
    if (!updated) {
      return NextResponse.json(
        { success: false, error: 'Archivo no encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Ajustes guardados',
      settings
    })
  } catch (error) {
    console.error('Error updating image settings:', error)
    return NextResponse.json(
      { success: false, error: 'Error al guardar ajustes' },
      { status: 500 }
    )
  }
}
