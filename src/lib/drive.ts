import { google, type drive_v3 } from 'googleapis'
import type { JWT } from 'google-auth-library'

let _client: drive_v3.Drive | null = null
let _auth: JWT | null = null

export function isDriveConfigured(): boolean {
  return !!(process.env.GOOGLE_DRIVE_FOLDER_ID && process.env.GOOGLE_SERVICE_ACCOUNT_JSON)
}

export function getDriveClient(): drive_v3.Drive | null {
  if (!isDriveConfigured()) return null
  if (_client) return _client

  try {
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID!
    let credentials

    try {
      credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!)
    } catch {
      console.error('GOOGLE_SERVICE_ACCOUNT_JSON no es JSON válido')
      return null
    }

    _auth = new google.auth.JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: ['https://www.googleapis.com/auth/drive']
    })

    _client = google.drive({ version: 'v3', auth: _auth })
    return _client
  } catch (error) {
    console.error('Error inicializando Google Drive client:', error)
    return null
  }
}

export function getFolderId(): string {
  return process.env.GOOGLE_DRIVE_FOLDER_ID || ''
}

export interface DriveFile {
  id: string
  name: string
  mimeType: string
  size: number
  createdTime: string
  modifiedTime: string
  type: 'image' | 'video'
  thumbnailLink?: string
  webContentLink?: string
}

const IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp']
const VIDEO_MIME = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v']

function detectType(mimeType: string): 'image' | 'video' | null {
  if (IMAGE_MIME.includes(mimeType)) return 'image'
  if (VIDEO_MIME.includes(mimeType)) return 'video'
  return null
}

// Listar archivos multimedia en la carpeta
export async function listMediaFiles(): Promise<DriveFile[]> {
  const client = getDriveClient()
  if (!client) return []

  try {
    const folderId = getFolderId()
    const mimeQueries = [...IMAGE_MIME, ...VIDEO_MIME]
      .map(m => `mimeType='${m}'`)
      .join(' or ')

    const res = await client.files.list({
      q: `'${folderId}' in parents and (${mimeQueries}) and trashed=false`,
      fields: 'files(id, name, mimeType, size, createdTime, modifiedTime, thumbnailLink, webContentLink)',
      orderBy: 'createdTime desc',
      pageSize: 200
    })

    const files: DriveFile[] = []
    for (const f of res.data.files || []) {
      const type = detectType(f.mimeType || '')
      if (!type) continue
      files.push({
        id: f.id!,
        name: f.name!,
        mimeType: f.mimeType!,
        size: Number(f.size) || 0,
        createdTime: f.createdTime || '',
        modifiedTime: f.modifiedTime || '',
        type,
        thumbnailLink: f.thumbnailLink || undefined,
        webContentLink: f.webContentLink || undefined
      })
    }
    return files
  } catch (error) {
    console.error('Error listando archivos de Drive:', error)
    return []
  }
}

// Descargar contenido de un archivo
export async function getFileContent(fileId: string): Promise<{ data: Buffer; mimeType: string } | null> {
  const client = getDriveClient()
  if (!client) return null

  try {
    const res = await client.files.get(
      { fileId, alt: 'media' },
      { responseType: 'arraybuffer' }
    )
    const data = Buffer.from(res.data as ArrayBuffer)
    // Obtener metadata para mimeType
    const meta = await client.files.get({
      fileId,
      fields: 'mimeType'
    })
    return {
      data,
      mimeType: meta.data.mimeType || 'application/octet-stream'
    }
  } catch (error) {
    console.error('Error descargando archivo de Drive:', error)
    return null
  }
}

// Subir archivo a la carpeta
export async function uploadFile(
  filename: string,
  mimeType: string,
  data: Buffer
): Promise<DriveFile | null> {
  const client = getDriveClient()
  if (!client) return null

  try {
    const folderId = getFolderId()
    const res = await client.files.create({
      requestBody: {
        name: filename,
        parents: [folderId]
      },
      media: {
        mimeType,
        body: Buffer.from(data)
      },
      fields: 'id, name, mimeType, size, createdTime, modifiedTime, thumbnailLink, webContentLink'
    })

    const f = res.data
    const type = detectType(f.mimeType || '')
    if (!type) return null

    return {
      id: f.id!,
      name: f.name!,
      mimeType: f.mimeType!,
      size: Number(f.size) || 0,
      createdTime: f.createdTime || '',
      modifiedTime: f.modifiedTime || '',
      type,
      thumbnailLink: f.thumbnailLink || undefined,
      webContentLink: f.webContentLink || undefined
    }
  } catch (error) {
    console.error('Error subiendo archivo a Drive:', error)
    return null
  }
}

// Eliminar archivo
export async function deleteFile(fileId: string): Promise<boolean> {
  const client = getDriveClient()
  if (!client) return false

  try {
    await client.files.delete({ fileId })
    return true
  } catch (error) {
    console.error('Error eliminando archivo de Drive:', error)
    return false
  }
}
