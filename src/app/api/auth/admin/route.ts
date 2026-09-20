import { NextResponse } from 'next/server'
import { createAdminSession, verifyAdminSession, getTokenFromRequest } from '@/lib/auth'

// POST /api/auth/admin - login (password → token)
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { password } = body

    if (!password || typeof password !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Contraseña requerida' },
        { status: 400 }
      )
    }

    const userAgent = request.headers.get('user-agent') || undefined
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ||
               request.headers.get('x-real-ip') || undefined

    const session = await createAdminSession(password, userAgent, ip)

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Contraseña incorrecta' },
        { status: 401 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Acceso concedido',
      token: session.token,
      expiresAt: session.expiresAt
    })
  } catch (error) {
    console.error('Error en login admin:', error)
    return NextResponse.json(
      { success: false, error: 'Error al iniciar sesión' },
      { status: 500 }
    )
  }
}

// GET /api/auth/admin - verificar si el token es válido
export async function GET(request: Request) {
  try {
    const token = getTokenFromRequest(request)
    if (!token) {
      return NextResponse.json(
        { success: false, authenticated: false, error: 'No token' },
        { status: 401 }
      )
    }

    const valid = await verifyAdminSession(token)
    return NextResponse.json({
      success: valid,
      authenticated: valid
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, authenticated: false },
      { status: 500 }
    )
  }
}
