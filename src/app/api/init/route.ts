import { NextRequest, NextResponse } from 'next/server'
import { initAdmin, setSession } from '@/lib/auth'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const existingAdmin = await db.user.findFirst({ where: { role: 'admin' } })
    if (existingAdmin) {
      return NextResponse.json(
        { error: '系统已初始化' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { email, password, name } = body

    if (!email || !password || !name) {
      return NextResponse.json(
        { error: '请填写所有字段' },
        { status: 400 }
      )
    }

    const admin = await initAdmin(email, password, name)

    const defaultSettings = [
      { key: 'site_name', value: '我的博客' },
      { key: 'site_description', value: '一个简洁优雅的博客' },
      { key: 'site_keywords', value: '博客,技术,分享' },
      { key: 'posts_per_page', value: '10' }
    ]

    for (const setting of defaultSettings) {
      await db.setting.upsert({
        where: { key: setting.key },
        update: {},
        create: setting
      })
    }

    await setSession({
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role
    })

    return NextResponse.json({
      success: true,
      message: '初始化完成',
      user: { id: admin.id, email: admin.email, name: admin.name, role: admin.role }
    })
  } catch (error) {
    console.error('Init error:', error)
    return NextResponse.json(
      { error: '初始化失败' },
      { status: 500 }
    )
  }
}
