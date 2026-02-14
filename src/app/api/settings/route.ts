import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, rotateSession } from '@/lib/auth'

// 获取设置
export async function GET() {
  try {
    const settings = await db.setting.findMany()
    const settingsMap = settings.reduce((acc, s) => {
      acc[s.key] = s.value
      return acc
    }, {} as Record<string, string>)

    return NextResponse.json({ settings: settingsMap })
  } catch (error) {
    console.error('Get settings error:', error)
    return NextResponse.json({ error: '获取设置失败' }, { status: 500 })
  }
}

// 更新设置
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 })
    }

    const data = await request.json()

    // 检查 jwt_secret 是否真的改变了
    let jwtSecretChanged = false
    if ('jwt_secret' in data) {
      const currentSetting = await db.setting.findUnique({
        where: { key: 'jwt_secret' }
      })
      const currentValue = currentSetting?.value || ''
      const newValue = String(data.jwt_secret || '')
      // 只有当值真正改变时才标记为 changed
      jwtSecretChanged = currentValue !== newValue
    }

    for (const [key, value] of Object.entries(data)) {
      await db.setting.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) }
      })
    }

    // 只有当 jwt_secret 真正改变时才重新签发 session
    if (jwtSecretChanged && session) {
      try {
        const { createToken } = await import('@/lib/auth')
        const newToken = await createToken(session)

        const response = NextResponse.json({
          success: true,
          sessionRotated: true,
          message: '设置已更新，Session 已重新签发'
        })

        response.cookies.set('session', newToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 7
        })

        return response
      } catch (error) {
        console.error('Rotate session error:', error)
        return NextResponse.json({
          success: true,
          sessionRotated: false,
          message: '设置已更新，但 Session 重新签发失败'
        })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Update settings error:', error)
    return NextResponse.json({ error: '更新设置失败' }, { status: 500 })
  }
}
