import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { exec } from 'child_process'
import { promisify } from 'util'
import { PATHS } from '@/lib/paths'

const execAsync = promisify(exec)

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

    // 异步执行更新
    performUpdate().catch(console.error)

    return NextResponse.json({ 
      success: true, 
      message: '更新已开始',
      isUpdating: true,
      progress: updateProgress 
    })
  } catch (error) {
    console.error('Update error:', error)
    isUpdating = false
    return NextResponse.json({ error: '更新失败' }, { status: 500 })
  }
}

async function performUpdate() {
  const projectRoot = PATHS.projectRoot

  try {
    // 步骤 1: git fetch
    setProgress('fetch', 'running', '正在获取最新代码...')
    
    try {
      await execAsync('git fetch origin main', { cwd: projectRoot })
      
      // 检查是否有更新
      const { stdout: localCommit } = await execAsync('git rev-parse HEAD', { cwd: projectRoot })
      const { stdout: remoteCommit } = await execAsync('git rev-parse origin/main', { cwd: projectRoot })
      
      if (localCommit.trim() === remoteCommit.trim()) {
        setProgress('fetch', 'success', '已是最新版本，无需更新')
        setProgress('build', 'success', '跳过构建')
        setProgress('restart', 'success', '无需重启')
        isUpdating = false
        return
      }

      // 有更新，执行 git reset
      await execAsync('git reset --hard origin/main', { cwd: projectRoot })
      setProgress('fetch', 'success', '代码更新成功')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      setProgress('fetch', 'error', `获取代码失败: ${errorMessage}`)
      isUpdating = false
      return
    }

    // 步骤 2: 构建项目
    setProgress('build', 'running', '正在构建项目...')
    
    try {
      // 安装依赖
      await execAsync('bun install', { cwd: projectRoot, timeout: 120000 })
      
      // 清理构建缓存，这可以解决 Turbopack 缓存导致的构建错误
      // 包括 "generate is not a function" 等问题
      await execAsync('rm -rf .next node_modules/.cache node_modules/.prisma node_modules/@prisma/client', { cwd: projectRoot })
      
      // 重新安装 Prisma 客户端以确保最新版本
      await execAsync('bun add @prisma/client', { cwd: projectRoot, timeout: 60000 })
      
      // 生成 Prisma 客户端
      const { stdout: generateStdout, stderr: generateStderr } = await execAsync('bun run db:generate', { cwd: projectRoot })
      console.log('Prisma generate output:', generateStdout)
      if (generateStderr) console.error('Prisma generate stderr:', generateStderr)
      
      // 构建项目 - 首先尝试 Turbopack（默认）
      let buildSuccess = false
      let buildError: string | null = null
      
      try {
        const { stdout, stderr } = await execAsync('bun run build', { 
          cwd: projectRoot, 
          timeout: 300000,
          env: { ...process.env, NODE_ENV: 'production' }
        })
        console.log('Build (Turbopack) stdout:', stdout)
        
        if (stderr && (stderr.includes('Failed to compile') || stderr.includes('TypeError') || stderr.includes('error:'))) {
          throw new Error(stderr)
        }
        buildSuccess = true
      } catch (turbopackError) {
        // Turbopack 失败，清理并回退到 webpack
        console.log('Turbopack build failed, falling back to webpack:', turbopackError)
        buildError = turbopackError instanceof Error ? turbopackError.message : String(turbopackError)
        
        // 清理失败的构建产物
        await execAsync('rm -rf .next', { cwd: projectRoot })
        
        // 使用 webpack 重新构建
        setProgress('build', 'running', 'Turbopack 失败，使用 Webpack 重试...')
        
        const { stdout: webpackStdout, stderr: webpackStderr } = await execAsync('bunx next build --webpack', { 
          cwd: projectRoot, 
          timeout: 300000,
          env: { ...process.env, NODE_ENV: 'production' }
        })
        console.log('Build (Webpack) stdout:', webpackStdout)
        
        if (webpackStderr && (webpackStderr.includes('Failed to compile') || webpackStderr.includes('error:'))) {
          throw new Error(webpackStderr)
        }
        buildSuccess = true
        buildError = null
      }
      
      if (!buildSuccess && buildError) {
        throw new Error(buildError)
      }
      
      setProgress('build', 'success', '构建完成')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error('Build error details:', errorMessage)
      setProgress('build', 'error', `构建失败: ${errorMessage}`)
      isUpdating = false
      return
    }

    // 步骤 3: 重启服务
    setProgress('restart', 'running', '正在准备重启服务...')
    
    // 标记需要重启
    setProgress('restart', 'success', '构建完成，即将重启服务...')
    
    // 延迟一段时间让客户端获取到最终状态
    setTimeout(() => {
      // 在 standalone 模式下，需要使用 PM2 或其他进程管理器来重启
      // 这里我们创建一个重启标记文件，由外部脚本或进程管理器检测
      const restartScript = `
#!/bin/bash
sleep 2
cd "${projectRoot}"
pkill -f "node.*server.js" || true
pkill -f "bun.*server.js" || true
sleep 1
bun start &
`
      
      // 执行重启脚本
      exec(restartScript, (error) => {
        if (error) {
          console.error('Restart error:', error)
        }
      })
      
      isUpdating = false
    }, 3000)

  } catch (error) {
    console.error('Update process error:', error)
    isUpdating = false
  }
}

function setProgress(step: string, status: UpdateProgress['status'], message?: string) {
  const index = updateProgress.findIndex(p => p.step === step)
  if (index !== -1) {
    updateProgress[index] = { ...updateProgress[index], status, message }
  }
}
