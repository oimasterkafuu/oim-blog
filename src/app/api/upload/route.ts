import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'
import { PATHS } from '@/lib/paths'

const UPLOADS_DIR = PATHS.uploadsDir

async function ensureUploadsDir() {
  if (!existsSync(UPLOADS_DIR)) {
    await mkdir(UPLOADS_DIR, { recursive: true })
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    await ensureUploadsDir()

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const ext = path.extname(file.name)
    const filename = `${randomUUID()}${ext}`
    const filepath = path.join(UPLOADS_DIR, filename)

    await writeFile(filepath, buffer)

    return NextResponse.json({
      success: true,
      filename,
      originalName: file.name,
      size: file.size,
      type: file.type,
      url: `/api/files/${filename}`
    })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const { readdir, stat } = await import('fs/promises')
    
    if (!existsSync(UPLOADS_DIR)) {
      return NextResponse.json({ files: [] })
    }

    const files = await readdir(UPLOADS_DIR)
    const fileInfos = await Promise.all(
      files.map(async (filename) => {
        const filepath = path.join(UPLOADS_DIR, filename)
        const stats = await stat(filepath)
        return {
          filename,
          size: stats.size,
          createdAt: stats.birthtime,
          url: `/api/files/${filename}`
        }
      })
    )

    fileInfos.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    return NextResponse.json({ files: fileInfos })
  } catch (error) {
    console.error('List files error:', error)
    return NextResponse.json({ error: 'Failed to list files' }, { status: 500 })
  }
}
