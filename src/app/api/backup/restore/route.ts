import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import fs from 'fs/promises'
import path from 'path'

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const filename = formData.get('filename') as string | null

    let dbBuffer: Buffer

    if (file) {
      // 从上传的文件读取
      const arrayBuffer = await file.arrayBuffer()
      dbBuffer = Buffer.from(arrayBuffer)
    } else if (filename) {
      // 从备份目录读取
      const backupPath = path.join(process.cwd(), 'public', 'backups', filename)
      dbBuffer = await fs.readFile(backupPath)
    } else {
      return NextResponse.json({ error: '请选择备份文件' }, { status: 400 })
    }

    // 验证文件大小（SQLite 文件至少有 100 字节的 header）
    if (dbBuffer.length < 100) {
      return NextResponse.json({ error: '无效的数据库文件' }, { status: 400 })
    }

    // 验证 SQLite 文件头
    const header = dbBuffer.slice(0, 16).toString('utf8')
    if (!header.startsWith('SQLite format 3')) {
      return NextResponse.json({ error: '不是有效的 SQLite 数据库文件' }, { status: 400 })
    }

    // 备份当前数据库
    const dbPath = path.join(process.cwd(), 'db', 'custom.db')
    const backupPath = path.join(process.cwd(), 'db', `custom.db.bak-${Date.now()}`)
    
    try {
      await fs.copyFile(dbPath, backupPath)
    } catch {
      // 如果原文件不存在，忽略错误
    }

    // 写入新的数据库文件
    await fs.writeFile(dbPath, dbBuffer)

    return NextResponse.json({ 
      success: true, 
      message: '数据库已恢复，请刷新页面以加载新数据'
    })
  } catch (error) {
    console.error('Restore error:', error)
    return NextResponse.json({ error: '恢复失败' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 })
    }

    const { filename } = await request.json()
    
    if (!filename) {
      return NextResponse.json({ error: '请指定文件名' }, { status: 400 })
    }

    const backupPath = path.join(process.cwd(), 'public', 'backups', filename)
    await fs.unlink(backupPath)

    return NextResponse.json({ success: true, message: '备份已删除' })
  } catch (error) {
    console.error('Delete backup error:', error)
    return NextResponse.json({ error: '删除失败' }, { status: 500 })
  }
}
