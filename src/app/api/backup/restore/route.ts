import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { PATHS } from '@/lib/paths'
import fs from 'fs/promises'
import path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

// 获取数据库表结构信息
async function getSchemaInfo(dbPath: string): Promise<string[]> {
  try {
    const { stdout } = await execAsync(`sqlite3 "${dbPath}" ".tables"`)
    return stdout.trim().split(/\s+/).filter(Boolean)
  } catch {
    return []
  }
}

// 比较两个数据库的表结构
async function compareSchemas(sourcePath: string, targetPath: string): Promise<{
  compatible: boolean
  sourceTables: string[]
  targetTables: string[]
  missingTables: string[]
  extraTables: string[]
}> {
  const sourceTables = await getSchemaInfo(sourcePath)
  const targetTables = await getSchemaInfo(targetPath)
  
  // 检查核心表是否存在
  const coreTables = ['User', 'Post', 'Category', 'Tag', 'Comment', 'PostTag', 'Setting', 'Page']
  const missingTables = coreTables.filter(t => !sourceTables.includes(t))
  const extraTables = sourceTables.filter(t => !targetTables.includes(t) && !coreTables.includes(t))
  
  return {
    compatible: missingTables.length === 0,
    sourceTables,
    targetTables,
    missingTables,
    extraTables
  }
}

// 检查是否存在 5 分钟内的备份
async function hasRecentBackup(): Promise<boolean> {
  const backupDir = path.join(process.cwd(), 'public', 'backups')
  try {
    await fs.access(backupDir)
    const files = await fs.readdir(backupDir)
    const dbFiles = files.filter(f => f.endsWith('.db'))
    
    const now = Date.now()
    const fiveMinutes = 5 * 60 * 1000
    
    for (const file of dbFiles) {
      const filePath = path.join(backupDir, file)
      const stat = await fs.stat(filePath)
      if (now - stat.mtimeMs < fiveMinutes) {
        return true
      }
    }
    return false
  } catch {
    return false
  }
}

// 创建自动备份
async function createAutoBackup(): Promise<string | null> {
  const dbPath = PATHS.dbFile
  try {
    await fs.access(dbPath)
  } catch {
    return null // 当前数据库不存在
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupDir = path.join(process.cwd(), 'public', 'backups')
  await fs.mkdir(backupDir, { recursive: true })
  
  const backupFilename = `auto-backup-${timestamp}.db`
  const backupPath = path.join(backupDir, backupFilename)
  
  await fs.copyFile(dbPath, backupPath)
  return backupFilename
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const filename = formData.get('filename') as string | null
    const force = formData.get('force') === 'true' // 强制恢复标志

    let dbBuffer: Buffer
    let tempPath: string | null = null

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

    // 使用正确的数据库路径
    const dbPath = PATHS.dbFile
    
    // 将上传的数据库保存到临时文件进行结构验证
    tempPath = path.join(PATHS.dbDir, `temp-restore-${Date.now()}.db`)
    await fs.writeFile(tempPath, dbBuffer)

    // 检查当前数据库是否存在
    let currentDbExists = false
    try {
      await fs.access(dbPath)
      currentDbExists = true
    } catch {
      // 当前数据库不存在
    }

    // 如果当前数据库存在，比较表结构
    if (currentDbExists && !force) {
      const schemaComparison = await compareSchemas(tempPath, dbPath)
      
      if (!schemaComparison.compatible) {
        // 清理临时文件
        await fs.unlink(tempPath).catch(() => {})
        
        return NextResponse.json({ 
          error: '数据库表结构不兼容',
          details: {
            missingTables: schemaComparison.missingTables,
            sourceTables: schemaComparison.sourceTables,
            targetTables: schemaComparison.targetTables
          },
          canForce: true,
          message: `备份文件缺少以下核心表: ${schemaComparison.missingTables.join(', ')}。您可以选择强制恢复，但可能会导致数据丢失。`
        }, { status: 400 })
      }
      
      if (schemaComparison.extraTables.length > 0) {
        // 有额外的表，发出警告但仍允许恢复
        console.warn('备份文件包含额外的表:', schemaComparison.extraTables)
      }
    }

    // 检查是否有 5 分钟内的备份，如果没有则自动备份当前数据库
    let autoBackupFilename: string | null = null
    if (currentDbExists) {
      const hasRecent = await hasRecentBackup()
      if (!hasRecent) {
        autoBackupFilename = await createAutoBackup()
      }
    }

    // 写入新的数据库文件
    await fs.copyFile(tempPath, dbPath)
    
    // 清理临时文件
    await fs.unlink(tempPath).catch(() => {})

    return NextResponse.json({ 
      success: true, 
      message: '数据库已恢复，请刷新页面以加载新数据',
      autoBackupCreated: autoBackupFilename !== null,
      autoBackupFilename
    })
  } catch (error) {
    console.error('Restore error:', error)
    return NextResponse.json({ error: '恢复失败: ' + (error instanceof Error ? error.message : '未知错误') }, { status: 500 })
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
