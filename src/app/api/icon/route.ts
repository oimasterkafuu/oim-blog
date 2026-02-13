import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { writeFile, unlink } from 'fs/promises'
import { existsSync } from 'fs'
import sharp from 'sharp'
import path from 'path'

const ICON_SIZE = 512
const UPLOADS_DIR = path.join(process.cwd(), 'uploads')
const ICON_FILENAME = 'site-icon.png'

async function ensureUploadsDir() {
  if (!existsSync(UPLOADS_DIR)) {
    const { mkdir } = await import('fs/promises')
    await mkdir(UPLOADS_DIR, { recursive: true })
  }
}

async function processIconToCircle(buffer: Buffer): Promise<Buffer> {
  const image = sharp(buffer)
  const metadata = await image.metadata()
  
  const size = Math.min(metadata.width || ICON_SIZE, metadata.height || ICON_SIZE)
  
  const roundedBuffer = await image
    .resize(size, size, { fit: 'cover' })
    .composite([
      {
        input: Buffer.from(
          `<svg><circle cx="${size/2}" cy="${size/2}" r="${size/2}" fill="#000"/></svg>`
        ),
        blend: 'dest-in'
      }
    ])
    .png()
    .toBuffer()

  return roundedBuffer
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Only image files are allowed' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const processedBuffer = await processIconToCircle(buffer)

    await ensureUploadsDir()
    const iconPath = path.join(UPLOADS_DIR, ICON_FILENAME)
    await writeFile(iconPath, processedBuffer)

    const iconUrl = `/api/files/${ICON_FILENAME}`

    await db.setting.upsert({
      where: { key: 'site_icon' },
      update: { value: iconUrl },
      create: { key: 'site_icon', value: iconUrl }
    })

    return NextResponse.json({ success: true, icon: iconUrl })
  } catch (error) {
    console.error('Icon upload error:', error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 })
    }

    const iconPath = path.join(UPLOADS_DIR, ICON_FILENAME)
    if (existsSync(iconPath)) {
      await unlink(iconPath)
    }

    await db.setting.delete({
      where: { key: 'site_icon' }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Icon delete error:', error)
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const setting = await db.setting.findUnique({
      where: { key: 'site_icon' }
    })

    if (!setting || !setting.value) {
      return NextResponse.json({ icon: null })
    }

    return NextResponse.json({ icon: setting.value })
  } catch (error) {
    console.error('Get icon error:', error)
    return NextResponse.json({ error: 'Failed to get icon' }, { status: 500 })
  }
}
