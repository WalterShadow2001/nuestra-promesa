import { NextResponse } from 'next/server'
import { updateCaption, updateCaptionById } from '@/lib/turso'
import { verifyAdminSession, getTokenFromRequest } from '@/lib/auth'

// PATCH /api/photos/[id]/caption - actualizar título (solo admin)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verificar autenticación admin
    const token = getTokenFromRequest(request)
    if (!token || !(await verifyAdminSession(token))) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      )
    }

    const { id } = await params
    const body = await request.json()
    const { caption } = body

    if (typeof caption !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Caption requerido' },
        { status: 400 }
      )
    }

    // Intentar primero por ID numérico
    const numericId = parseInt(id, 10)
    if (!isNaN(numericId)) {
      const success = await updateCaptionById(numericId, caption.trim())
      if (success) {
        return NextResponse.json({
          success: true,
          message: 'Título actualizado',
          caption: caption.trim()
        })
      }
    }

    // Fallback por filename
    const success = await updateCaption(id, caption.trim())
    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Archivo no encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Título actualizado',
      caption: caption.trim()
    })
  } catch (error) {
    console.error('Error updating caption:', error)
    return NextResponse.json(
      { success: false, error: 'Error al actualizar título' },
      { status: 500 }
    )
  }
}
