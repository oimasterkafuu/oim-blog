import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, hashPassword, verifyPassword, setSession } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 })
    }

    const { currentPassword, newName, newPassword, confirmPassword } = await request.json()

    // 获取当前用户
    const user = await db.user.findUnique({ where: { id: session.id } })
    if (!user) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 })
    }

    // 如果要修改密码，验证当前密码
    if (newPassword) {
      if (!currentPassword) {
        return NextResponse.json({ error: '请输入当前密码' }, { status: 400 })
      }

      const isValid = await verifyPassword(currentPassword, user.password)
      if (!isValid) {
        return NextResponse.json({ error: '当前密码错误' }, { status: 400 })
      }

      if (newPassword !== confirmPassword) {
        return NextResponse.json({ error: '两次输入的新密码不一致' }, { status: 400 })
      }

      if (newPassword.length < 6) {
        return NextResponse.json({ error: '密码长度至少6位' }, { status: 400 })
      }
    }

    // 更新用户信息
    const updateData: { name?: string; password?: string } = {}
    
    if (newName && newName !== user.name) {
      updateData.name = newName
    }
    
    if (newPassword) {
      updateData.password = await hashPassword(newPassword)
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: '没有需要更新的内容' }, { status: 400 })
    }

    const updatedUser = await db.user.update({
      where: { id: session.id },
      data: updateData,
      select: { id: true, email: true, name: true, role: true }
    })

    await setSession(updatedUser)

    return NextResponse.json({ 
      success: true, 
      user: updatedUser,
      message: '账户信息已更新'
    })
  } catch (error) {
    console.error('Update user error:', error)
    return NextResponse.json({ error: '更新失败' }, { status: 500 })
  }
}
