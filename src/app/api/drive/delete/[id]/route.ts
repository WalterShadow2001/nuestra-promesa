import { NextResponse } from 'next/server'
import { isDriveConfigured, deleteFile as driveDeleteFile } from '@/lib/drive'
import { deleteMediaItem, deleteMediaItemById } from '@/lib/turso'
import { verifyAdminSession, getTokenFromRequest } from '@/lib/auth'
import { clearPhotosCache } from '@/lib/photos-cache'

// DELETE /api/drive/delete/[id] - eliminar archivo (solo admin)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = getTokenFromRequest(request)
    if (!token || !(await verifyAdminSession(token))) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      )
    }

    const { id } = await params

    if (isDriveConfigured()) {
      const ok = await driveDeleteFile(id)
      if (!ok) {
        return NextResponse.json(
          { success: false, error: 'Error al eliminar de Drive' },
          { status: 500 }
        )
      }
      clearPhotosCache()
      return NextResponse.json({
        success: true,
        message: 'Archivo eliminado de Drive'
      })
    } else {
      // Intentar primero por ID numérico
      const numericId = parseInt(id, 10)
      if (!isNaN(numericId)) {
        const ok = await deleteMediaItemById(numericId)
        if (ok) {
          clearPhotosCache()
          return NextResponse.json({
            success: true,
            message: 'Archivo eliminado'
          })
        }
      }
      // Fallback por filename
      const ok = await deleteMediaItem(id)
      if (!ok) {
        return NextResponse.json(
          { success: false, error: 'Archivo no encontrado' },
          { status: 404 }
        )
      }
      clearPhotosCache()
      return NextResponse.json({
        success: true,
        message: 'Archivo eliminado'
      })
    }
  } catch (error) {
    console.error('Error eliminando archivo:', error)
    return NextResponse.json(
      { success: false, error: 'Error al eliminar' },
      { status: 500 }
    )
  }
}
