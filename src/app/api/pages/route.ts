import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'

// 获取页面列表
export async function GET() {
  try {
    const pages = await db.page.findMany({
      orderBy: { order: 'asc' }
    })
    return NextResponse.json({ pages })
  } catch (error) {
    console.error('Get pages error:', error)
    return NextResponse.json({ error: '获取页面失败' }, { status: 500 })
  }
}

// 创建页面
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 })
    }

    const { title, slug, content, status, order } = await request.json()

    if (!title || !slug) {
      return NextResponse.json({ error: '标题和别名不能为空' }, { status: 400 })
    }

    const existing = await db.page.findUnique({ where: { slug } })
    if (existing) {
      return NextResponse.json({ error: '别名已存在' }, { status: 400 })
    }

    const page = await db.page.create({
      data: {
        title,
        slug,
        content: content || '',
        status: status || 'draft',
        order: order || 0
      }
    })

    return NextResponse.json({ success: true, page })
  } catch (error) {
    console.error('Create page error:', error)
    return NextResponse.json({ error: '创建页面失败' }, { status: 500 })
  }
}
