import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { writeFileSync, existsSync, unlinkSync } from 'fs'
import { PATHS } from '@/lib/paths'
import { join } from 'path'

const UPDATE_SCRIPT_PATH = join(PATHS.projectRoot, 'update.sh')
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
  const projectRoot = PATHS.projectRoot
  
  const script = `#!/bin/bash

# 自动更新脚本
# 此脚本在主程序退出后执行，避免环境冲突

set -e

PROJECT_ROOT="${projectRoot}"
LOG_FILE="${UPDATE_LOG_PATH}"
FLAG_FILE="${UPDATE_FLAG_PATH}"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

cleanup() {
    rm -f "$FLAG_FILE"
}

trap cleanup EXIT

log "========================================="
log "开始自动更新流程"
log "========================================="

cd "$PROJECT_ROOT"

# 步骤 1: 获取最新代码
log "步骤 1: 获取最新代码..."

git fetch origin main 2>&1 | tee -a "$LOG_FILE"

LOCAL_COMMIT=$(git rev-parse HEAD)
REMOTE_COMMIT=$(git rev-parse origin/main)

if [ "$LOCAL_COMMIT" = "$REMOTE_COMMIT" ]; then
    log "已是最新版本，无需更新"
    log "重启服务..."
    bun start >> "$LOG_FILE" 2>&1 &
    exit 0
fi

log "发现新版本，开始更新..."
log "本地: $LOCAL_COMMIT"
log "远程: $REMOTE_COMMIT"

git reset --hard origin/main 2>&1 | tee -a "$LOG_FILE"

log "代码更新完成"

# 步骤 2: 安装依赖和构建
log "步骤 2: 安装依赖..."

bun install 2>&1 | tee -a "$LOG_FILE"

log "步骤 3: 清理旧构建..."

rm -rf .next node_modules/.cache node_modules/.prisma node_modules/@prisma/client

log "步骤 4: 重新安装 Prisma 客户端..."

bun add @prisma/client 2>&1 | tee -a "$LOG_FILE"

log "步骤 5: 生成 Prisma 客户端..."

bun run db:generate 2>&1 | tee -a "$LOG_FILE"

log "步骤 6: 构建项目..."

if bun run build 2>&1 | tee -a "$LOG_FILE"; then
    log "构建成功"
else
    log "错误: 构建失败，请检查日志"
    log "========================================="
    exit 1
fi

# 步骤 7: 数据库迁移
log "步骤 7: 数据库迁移..."

if [ -d "prisma/migrations" ]; then
    bunx prisma migrate deploy 2>&1 | tee -a "$LOG_FILE" || log "警告: 数据库迁移可能失败"
fi

log "步骤 8: 重启服务..."

# 确保旧进程已停止
pkill -f "node.*server.js" 2>/dev/null || true
pkill -f "bun.*server.js" 2>/dev/null || true

sleep 2

# 启动新进程
log "启动服务..."
bun start >> "$LOG_FILE" 2>&1 &

log "========================================="
log "更新完成！"
log "========================================="
`

  try {
    // 如果已存在旧的更新脚本，先删除
    if (existsSync(UPDATE_SCRIPT_PATH)) {
      unlinkSync(UPDATE_SCRIPT_PATH)
    }
    
    writeFileSync(UPDATE_SCRIPT_PATH, script, { mode: 0o755 })
    
    // 使用 nohup 在后台执行脚本，立即返回
    const { spawn } = require('child_process')
    const child = spawn('nohup', [UPDATE_SCRIPT_PATH], {
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
    console.error('Failed to create or execute update script:', error)
    throw error
  }
}

function setProgress(step: string, status: UpdateProgress['status'], message?: string) {
  const index = updateProgress.findIndex(p => p.step === step)
  if (index !== -1) {
    updateProgress[index] = { ...updateProgress[index], status, message }
  }
}