import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'

// 获取单个页面
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const page = await db.page.findFirst({
      where: {
        OR: [{ id }, { slug: id }]
      }
    })

    if (!page) {
      return NextResponse.json({ error: '页面不存在' }, { status: 404 })
    }

    return NextResponse.json({ page })
  } catch (error) {
    console.error('Get page error:', error)
    return NextResponse.json({ error: '获取页面失败' }, { status: 500 })
  }
}

// 更新页面
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 })
    }

    const { id } = await params
    const { title, slug, content, status, order } = await request.json()

    const existing = await db.page.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: '页面不存在' }, { status: 404 })
    }

    if (slug && slug !== existing.slug) {
      const slugPage = await db.page.findUnique({ where: { slug } })
      if (slugPage) {
        return NextResponse.json({ error: '别名已存在' }, { status: 400 })
      }
    }

    const page = await db.page.update({
      where: { id },
      data: { title, slug, content, status, order }
    })

    return NextResponse.json({ success: true, page })
  } catch (error) {
    console.error('Update page error:', error)
    return NextResponse.json({ error: '更新页面失败' }, { status: 500 })
  }
}

// 删除页面
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 })
    }

    const { id } = await params
    await db.page.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete page error:', error)
    return NextResponse.json({ error: '删除页面失败' }, { status: 500 })
  }
}
