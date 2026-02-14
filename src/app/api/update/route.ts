import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { writeFileSync } from 'fs'
import { PATHS } from '@/lib/paths'
import { join } from 'path'

const UPDATE_LOG_PATH = join(PATHS.projectRoot, 'update.log')
const UPDATE_FLAG_PATH = join(PATHS.projectRoot, '.updating')

interface UpdateProgress {
  step: string
  status: 'pending' | 'running' | 'success' | 'error'
  message?: string
}

// 存储更新进度（简单实现，生产环境可使用 Redis 等）
let updateProgress: UpdateProgress[] = []
let isUpdating = false

export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 })
    }

    return NextResponse.json({ 
      isUpdating,
      progress: updateProgress 
    })
  } catch (error) {
    console.error('Get update status error:', error)
    return NextResponse.json({ error: '获取更新状态失败' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const action = body.action

    // 如果是轮询进度
    if (action === 'poll') {
      return NextResponse.json({ 
        isUpdating,
        progress: updateProgress 
      })
    }

    // 如果已经在更新中，返回当前状态
    if (isUpdating) {
      return NextResponse.json({ 
        error: '正在更新中，请稍候...',
        isUpdating: true,
        progress: updateProgress 
      }, { status: 409 })
    }

    // 开始更新流程
    isUpdating = true
    updateProgress = [
      { step: 'fetch', status: 'pending', message: '获取最新代码' },
      { step: 'build', status: 'pending', message: '构建项目' },
      { step: 'restart', status: 'pending', message: '重启服务' }
    ]

    // 创建更新脚本并执行
    createUpdateScript()
    
    // 标记正在更新
    writeFileSync(UPDATE_FLAG_PATH, new Date().toISOString())

    return NextResponse.json({ 
      success: true, 
      message: '更新已开始，程序即将重启',
      isUpdating: true,
      progress: updateProgress 
    })
  } catch (error) {
    console.error('Update error:', error)
    isUpdating = false
    return NextResponse.json({ error: '更新失败' }, { status: 500 })
  }
}

function createUpdateScript() {
  try {
    const { spawn } = require('child_process')
    const { join } = require('path')
    
    // 使用独立的 update.sh 脚本
    const updateScript = join(PATHS.projectRoot, 'scripts', 'update.sh')
    
    // 使用 env -i 启动脚本，确保干净的构建环境
    const child = spawn('env', [
      '-i',
      `PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/root/.bun/bin`,
      `HOME=${process.env.HOME}`,
      `USER=${process.env.USER}`,
      updateScript
    ], {
      detached: true,
      stdio: 'ignore',
      cwd: PATHS.projectRoot
    })
    child.unref()
    
    // 延迟退出主程序，确保脚本已启动
    setTimeout(() => {
      process.exit(0)
    }, 1000)
    
  } catch (error) {
    console.error('Failed to execute update script:', error)
    throw error
  }
}

function setProgress(step: string, status: UpdateProgress['status'], message?: string) {
  const index = updateProgress.findIndex(p => p.step === step)
  if (index !== -1) {
    updateProgress[index] = { ...updateProgress[index], status, message }
  }
}