import { NextRequest, NextResponse } from 'next/server'
import { authenticateUser, setSession } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const { login, password } = await request.json()

    if (!login || !password) {
      return NextResponse.json(
        { error: '请输入用户名/邮箱和密码' },
        { status: 400 }
      )
    }

    const user = await authenticateUser(login, password)
    if (!user) {
      return NextResponse.json(
        { error: '用户名/邮箱或密码错误' },
        { status: 401 }
      )
    }

    await setSession(user)

    return NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email, name: user.name, role: user.role }
    })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: '登录失败，请重试' },
      { status: 500 }
    )
  }
}
