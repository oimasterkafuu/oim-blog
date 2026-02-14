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
    const category = await db.category.findFirst({
      where: {
        OR: [{ id }, { slug: id }]
      },
      include: {
        _count: {
          select: { posts: { where: { status: 'published' } } }
        }
      }
    })

    if (!category) {
      return NextResponse.json({ error: '分类不存在' }, { status: 404 })
    }

    return NextResponse.json({ category })
  } catch (error) {
    console.error('Get category error:', error)
    return NextResponse.json({ error: '获取分类失败' }, { status: 500 })
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
    const { name, slug, description, order } = await request.json()

    const existing = await db.category.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: '分类不存在' }, { status: 404 })
    }

    if (slug && slug !== existing.slug) {
      // 验证 slug 格式
      const slugValidation = isValidSlug(slug)
      if (!slugValidation.valid) {
        return NextResponse.json({ error: slugValidation.error }, { status: 400 })
      }
      const slugConflict = await checkSlugConflict(slug, db)
      if (slugConflict.conflict && slugConflict.type !== 'category') {
        return NextResponse.json({ error: slugConflict.message }, { status: 400 })
      }
      if (slugConflict.type === 'category') {
        const existingCat = await db.category.findUnique({ where: { slug } })
        if (existingCat && existingCat.id !== id) {
          return NextResponse.json({ error: '别名已被其他分类使用' }, { status: 400 })
        }
      }
    }

    const category = await db.category.update({
      where: { id },
      data: { name, slug, description, order }
    })

    return NextResponse.json({ success: true, category })
  } catch (error) {
    console.error('Update category error:', error)
    return NextResponse.json({ error: '更新分类失败' }, { status: 500 })
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

    // 将该分类下的文章的 categoryId 设为 null，然后删除分类
    await db.$transaction([
      db.post.updateMany({ where: { categoryId: id }, data: { categoryId: null } }),
      db.category.delete({ where: { id } })
    ])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete category error:', error)
    return NextResponse.json({ error: '删除分类失败' }, { status: 500 })
  }
}
