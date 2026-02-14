#!/usr/bin/env bun
/**
 * 紧急重置密码脚本
 * 用于在忘记密码时重置管理员密码
 * 
 * 使用方法: bun run scripts/reset-password.ts
 */

import { createHash } from 'crypto'
import readline from 'readline'
import { db } from '../src/lib/db'

// SHA-256 哈希函数（与项目中的 auth.ts 保持一致）
function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex')
}

// 创建命令行交互接口
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, resolve)
  })
}

function questionHidden(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    process.stdout.write(prompt)
    
    // 隐藏输入
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true)
    }
    
    let password = ''
    process.stdin.resume()
    process.stdin.once('data', (chunk) => {
      password = chunk.toString().trim()
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(false)
      }
      process.stdout.write('\n')
      resolve(password)
    })
  })
}

async function main() {
  console.log('=== 紧急重置密码工具 ===\n')
  
  try {
    // 使用 Prisma 查询用户
    const users = await db.user.findMany({
      select: { id: true, name: true, email: true }
    })
    
    if (users.length === 0) {
      console.error('错误：用户表为空，请先通过网页初始化系统。')
      rl.close()
      await db.$disconnect()
      process.exit(1)
    }

    // 显示可用用户
    console.log('数据库中的用户：')
    users.forEach((user, index) => {
      console.log(`  ${index + 1}. ${user.name} (${user.email})`)
    })
    console.log()

    // 选择用户（如果有多个）
    let selectedUser = users[0]
    if (users.length > 1) {
      const choice = await question('请选择要重置密码的用户序号 (默认为 1): ')
      const index = parseInt(choice) - 1
      if (isNaN(index) || index < 0 || index >= users.length) {
        if (choice.trim() !== '') {
          console.log('无效选择，使用第一个用户。')
        }
      } else {
        selectedUser = users[index]
      }
    }

    console.log(`\n将为用户 "${selectedUser.name}" (${selectedUser.email}) 重置密码。\n`)

    // 输入新密码
    const newPassword = await questionHidden('请输入新密码: ')
    
    if (!newPassword || newPassword.length < 4) {
      console.error('错误：密码长度至少为 4 个字符。')
      rl.close()
      await db.$disconnect()
      process.exit(1)
    }

    // 确认密码
    const confirmPassword = await questionHidden('请再次输入新密码: ')
    
    if (newPassword !== confirmPassword) {
      console.error('错误：两次输入的密码不一致。')
      rl.close()
      await db.$disconnect()
      process.exit(1)
    }

    // 使用 Prisma 更新密码
    const hashedPassword = hashPassword(newPassword)
    await db.user.update({
      where: { id: selectedUser.id },
      data: { password: hashedPassword }
    })
    
    console.log('\n密码重置成功！')
    console.log(`用户: ${selectedUser.name}`)
    console.log(`邮箱: ${selectedUser.email}`)
    
  } catch (error) {
    // 检查是否是数据库连接错误
    if (error instanceof Error && error.message.includes('Can\'t reach database server')) {
      console.error('错误：无法连接到数据库，请检查数据库文件是否存在。')
    } else if (error instanceof Error && error.message.includes('does not exist')) {
      console.error('错误：数据库表不存在，请先初始化系统。')
    } else {
      console.error('发生错误:', error instanceof Error ? error.message : error)
    }
    rl.close()
    await db.$disconnect()
    process.exit(1)
  }

  rl.close()
  await db.$disconnect()
}

main()