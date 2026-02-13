import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { checkSlugConflict } from '@/lib/slug'

export async function GET() {
  try {
    const categories = await db.category.findMany({
      include: {
        _count: {
          select: { posts: { where: { status: 'published' } } }
        }
      },
      orderBy: { order: 'asc' }
    })
    return NextResponse.json({ categories })
  } catch (error) {
    console.error('Get categories error:', error)
    return NextResponse.json({ error: '获取分类失败' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 })
    }

    const { name, slug, description, order } = await request.json()

    if (!name || !slug) {
      return NextResponse.json({ error: '名称和别名不能为空' }, { status: 400 })
    }

    const slugConflict = await checkSlugConflict(slug, db)
    if (slugConflict.conflict) {
      return NextResponse.json({ error: slugConflict.message }, { status: 400 })
    }

    const category = await db.category.create({
      data: { name, slug, description, order: order || 0 }
    })

    return NextResponse.json({ success: true, category })
  } catch (error) {
    console.error('Create category error:', error)
    return NextResponse.json({ error: '创建分类失败' }, { status: 500 })
  }
}
