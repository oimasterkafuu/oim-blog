import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { checkSlugConflict } from '@/lib/slug'

export async function GET() {
  try {
    const tags = await db.tag.findMany({
      include: {
        _count: {
          select: { posts: { where: { post: { status: 'published' } } } }
        }
      },
      orderBy: { name: 'asc' }
    })
    return NextResponse.json({ tags })
  } catch (error) {
    console.error('Get tags error:', error)
    return NextResponse.json({ error: '获取标签失败' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 })
    }

    const { name, slug } = await request.json()

    if (!name || !slug) {
      return NextResponse.json({ error: '名称和别名不能为空' }, { status: 400 })
    }

    const slugConflict = await checkSlugConflict(slug, db)
    if (slugConflict.conflict) {
      return NextResponse.json({ error: slugConflict.message }, { status: 400 })
    }

    const tag = await db.tag.create({
      data: { name, slug }
    })

    return NextResponse.json({ success: true, tag })
  } catch (error) {
    console.error('Create tag error:', error)
    return NextResponse.json({ error: '创建标签失败' }, { status: 500 })
  }
}
