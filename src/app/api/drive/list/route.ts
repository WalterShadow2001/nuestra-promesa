import { NextResponse } from 'next/server'
import { isDriveConfigured, listMediaFiles } from '@/lib/drive'

// GET /api/drive/list - lista archivos directamente de Drive (sin cache)
export async function GET() {
  if (!isDriveConfigured()) {
    return NextResponse.json(
      { success: false, error: 'Google Drive no configurado', items: [] },
      { status: 503 }
    )
  }
  try {
    const files = await listMediaFiles()
    return NextResponse.json({
      success: true,
      count: files.length,
      items: files
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Error listando archivos', items: [] },
      { status: 500 }
    )
  }
}
