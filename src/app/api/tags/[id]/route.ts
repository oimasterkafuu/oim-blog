import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { checkSlugConflict, isValidSlug } from '@/lib/slug'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const tag = await db.tag.findFirst({
      where: {
        OR: [{ id }, { slug: id }]
      },
      include: {
        _count: {
          select: { posts: { where: { post: { status: 'published' } } } }
        }
      }
    })

    if (!tag) {
      return NextResponse.json({ error: '标签不存在' }, { status: 404 })
    }

    return NextResponse.json({ tag })
  } catch (error) {
    console.error('Get tag error:', error)
    return NextResponse.json({ error: '获取标签失败' }, { status: 500 })
  }
}

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
    const { name, slug } = await request.json()

    const existing = await db.tag.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: '标签不存在' }, { status: 404 })
    }

    if (slug && slug !== existing.slug) {
      // 验证 slug 格式
      const slugValidation = isValidSlug(slug)
      if (!slugValidation.valid) {
        return NextResponse.json({ error: slugValidation.error }, { status: 400 })
      }
      const slugConflict = await checkSlugConflict(slug, db)
      if (slugConflict.conflict && slugConflict.type !== 'tag') {
        return NextResponse.json({ error: slugConflict.message }, { status: 400 })
      }
      if (slugConflict.type === 'tag') {
        const existingTag = await db.tag.findUnique({ where: { slug } })
        if (existingTag && existingTag.id !== id) {
          return NextResponse.json({ error: '别名已被其他标签使用' }, { status: 400 })
        }
      }
    }

    const tag = await db.tag.update({
      where: { id },
      data: { name, slug }
    })

    return NextResponse.json({ success: true, tag })
  } catch (error) {
    console.error('Update tag error:', error)
    return NextResponse.json({ error: '更新标签失败' }, { status: 500 })
  }
}

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
    // 先删除关联的 PostTag 记录，再删除标签
    await db.$transaction([
      db.postTag.deleteMany({ where: { tagId: id } }),
      db.tag.delete({ where: { id } })
    ])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete tag error:', error)
    return NextResponse.json({ error: '删除标签失败' }, { status: 500 })
  }
}
