import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'

// 在运行时计算路径，而不是在模块加载时
function getUploadsDir(): string {
  const cwd = process.cwd()
  
  // 如果当前目录是 .next/standalone，则返回项目根目录（去掉 .next/standalone）
  if (cwd.includes('.next' + path.sep + 'standalone')) {
    const projectRoot = path.dirname(path.dirname(cwd))
    return path.join(projectRoot, 'uploads')
  }
  
  // 兼容 Windows 路径分隔符
  if (cwd.replace(/\\/g, '/').includes('.next/standalone')) {
    const parts = cwd.replace(/\\/g, '/').split('/')
    const standaloneIndex = parts.indexOf('.next')
    if (standaloneIndex !== -1) {
      const projectRoot = parts.slice(0, standaloneIndex).join('/')
      return path.join(projectRoot, 'uploads')
    }
  }
  
  // 检查当前目录和上级目录
  const possiblePaths = [
    cwd,
    path.resolve(cwd, '..'),
    path.resolve(cwd, '..', '..'),
  ]
  
  for (const p of possiblePaths) {
    // 检查是否存在 db 和 prisma 目录来判断项目根目录
    if (existsSync(path.join(p, 'db')) && existsSync(path.join(p, 'prisma'))) {
      return path.join(p, 'uploads')
    }
  }
  
  // 如果找不到，返回 cwd/uploads
  return path.join(cwd, 'uploads')
}

async function ensureUploadsDir(dir: string) {
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true })
  }
}

export async function POST(request: NextRequest) {
  try {
    const uploadsDir = getUploadsDir()
    
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    await ensureUploadsDir(uploadsDir)

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const ext = path.extname(file.name)
    const filename = `${randomUUID()}${ext}`
    const filepath = path.join(uploadsDir, filename)

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
    const uploadsDir = getUploadsDir()
    
    if (!existsSync(uploadsDir)) {
      return NextResponse.json({ files: [] })
    }

    const files = await readdir(uploadsDir)
    const fileInfos = await Promise.all(
      files.map(async (filename) => {
        const filepath = path.join(uploadsDir, filename)
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
