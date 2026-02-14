import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { PATHS } from '@/lib/paths'
import * as crypto from 'crypto'

// 验证 GitHub webhook 签名
async function verifySignature(payload: string, signature: string): Promise<boolean> {
  // 从数据库获取 webhook secret
  const setting = await db.setting.findUnique({
    where: { key: 'github_webhook_secret' }
  })

  if (!setting?.value) {
    console.error('GitHub webhook secret not configured')
    return false
  }

  const secret = setting.value
  const hmac = crypto.createHmac('sha256', secret)
  hmac.update(payload, 'utf8')
  const digest = 'sha256=' + hmac.digest('hex')

  // 使用 timing-safe 比较防止时序攻击
  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature))
  } catch {
    return false
  }
}

// 执行更新脚本
async function performUpdate(): Promise<void> {
  try {
    const { spawn } = require('child_process')
    const { join } = require('path')
    const { writeFileSync } = require('fs')

    // 使用 PATHS.projectRoot 确保在 standalone 模式下也能找到正确的路径
    const updateScript = join(PATHS.projectRoot, 'scripts', 'update.sh')
    const updateFlagPath = join(PATHS.projectRoot, '.updating')

    console.log('Starting update script:', updateScript)
    console.log('Project root:', PATHS.projectRoot)

    // 标记正在更新
    writeFileSync(updateFlagPath, new Date().toISOString())

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
    console.log('Update script started with PID:', child.pid)

    // 延迟退出主程序，确保脚本已启动
    setTimeout(() => {
      console.log('Exiting main process to allow update to complete')
      process.exit(0)
    }, 1000)
  } catch (error) {
    console.error('Update failed:', error)
    throw error
  }
}

export async function POST(request: NextRequest) {
  try {
    // 获取签名
    const signature = request.headers.get('x-hub-signature-256')
    if (!signature) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 401 })
    }

    // 获取 payload
    const payload = await request.text()

    // 验证签名
    const isValid = await verifySignature(payload, signature)
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    // 解析事件类型
    const event = request.headers.get('x-github-event')
    if (!event) {
      return NextResponse.json({ error: 'Missing event type' }, { status: 400 })
    }

    // 只处理 push 事件
    if (event !== 'push') {
      return NextResponse.json({ message: `Event ${event} ignored` })
    }

    // 解析 payload
    const data = JSON.parse(payload)
    const ref = data.ref

    // 只处理 main 分支的 push
    if (ref !== 'refs/heads/main') {
      return NextResponse.json({ message: `Branch ${ref} ignored` })
    }

    console.log('Received push to main branch, starting update...')

    // 执行更新
    // 注意：这里我们不等待更新完成，因为更新过程会重启服务器
    // 我们立即返回 202 Accepted，让 GitHub 知道我们已收到事件
    performUpdate().catch(error => {
      console.error('Background update failed:', error)
    })

    return NextResponse.json({ 
      message: 'Update triggered successfully',
      commit: data.after,
      pusher: data.pusher?.name
    }, { status: 202 })

  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
