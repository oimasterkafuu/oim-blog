import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs/promises'
import path from 'path'
import { PATHS } from '@/lib/paths'

const execAsync = promisify(exec)

export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 })
    }

    // SQLite 数据库文件路径
    const dbPath = PATHS.dbFile
    
    // 读取数据库文件
    const dbBuffer = await fs.readFile(dbPath)
    
    // 生成备份文件名
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `backup-${timestamp}.db`
    
    // 保存备份到 public/backups 目录
    const backupDir = path.join(process.cwd(), 'public', 'backups')
    await fs.mkdir(backupDir, { recursive: true })
    
    const backupPath = path.join(backupDir, filename)
    await fs.writeFile(backupPath, dbBuffer)

    // 返回文件供下载
    return new NextResponse(dbBuffer, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': dbBuffer.length.toString()
      }
    })
  } catch (error) {
    console.error('Backup error:', error)
    return NextResponse.json({ error: '备份失败' }, { status: 500 })
  }
}

export async function POST() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 })
    }

    // 列出所有备份文件
    const backupDir = path.join(process.cwd(), 'public', 'backups')
    await fs.mkdir(backupDir, { recursive: true })
    
    const files = await fs.readdir(backupDir)
    const backups = files
      .filter(f => f.endsWith('.db'))
      .map(f => ({
        filename: f,
        url: `/backups/${f}`
      }))

    return NextResponse.json({ backups })
  } catch (error) {
    console.error('List backups error:', error)
    return NextResponse.json({ error: '获取备份列表失败' }, { status: 500 })
  }
}
