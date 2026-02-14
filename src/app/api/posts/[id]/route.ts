import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { generateSlug, checkSlugConflict } from '@/lib/slug'
import { triggerAsyncAITasks } from '@/lib/ai-tasks'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const post = await db.post.findFirst({
      where: {
        OR: [
          { id },
          { slug: id }
        ]
      },
      include: {
        author: { select: { id: true, name: true, email: true } },
        category: true,
        tags: { include: { tag: true } },
        comments: {
          where: {
            status: 'approved',
            parentId: null
          },
          include: {
            replies: {
              where: { status: 'approved' },
              orderBy: { createdAt: 'asc' }
            }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    })

    if (!post) {
      return NextResponse.json({ error: '文章不存在' }, { status: 404 })
    }

    const session = await getSession()
    if (post.status !== 'published' && !session) {
      return NextResponse.json({ error: '无权查看此文章' }, { status: 403 })
    }

    await db.post.update({
      where: { id: post.id },
      data: { viewCount: { increment: 1 } }
    })

    return NextResponse.json({ post })
  } catch (error) {
    console.error('Get post error:', error)
    return NextResponse.json({ error: '获取文章失败' }, { status: 500 })
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
    const data = await request.json()
    let { title, slug, content, excerpt, coverImage, status, categoryId, tags, allowComment } = data

    const existingPost = await db.post.findUnique({
      where: { id },
      include: { tags: { include: { tag: true } } }
    })
    if (!existingPost) {
      return NextResponse.json({ error: '文章不存在' }, { status: 404 })
    }

    const oldStatus = existingPost.status
    const newStatus = status ?? oldStatus
    const isPublishing = oldStatus !== 'published' && newStatus === 'published'

    if (slug && slug !== existingPost.slug) {
      const slugConflict = await checkSlugConflict(slug, db, id)
      if (slugConflict.conflict) {
        return NextResponse.json({ error: slugConflict.message }, { status: 400 })
      }
    } else if (!slug && title && title !== existingPost.title) {
      slug = generateSlug(title)
      const slugConflict = await checkSlugConflict(slug, db, id)
      if (slugConflict.conflict) {
        slug = existingPost.slug
      }
    }

    const finalTitle = title ?? existingPost.title
    const finalContent = content ?? existingPost.content
    const finalTags = tags !== undefined ? tags : existingPost.tags.map(t => t.tag.id)

    const post = await db.post.update({
      where: { id },
      data: {
        title: finalTitle,
        slug: slug ?? existingPost.slug,
        content: finalContent,
        excerpt: excerpt ?? existingPost.excerpt,
        coverImage: coverImage ?? existingPost.coverImage,
        status: newStatus,
        allowComment: allowComment ?? existingPost.allowComment,
        categoryId: categoryId !== undefined ? categoryId : existingPost.categoryId,
        ...(tags !== undefined ? {
          tags: {
            deleteMany: {},
            create: tags.map((tagId: string) => ({
              tag: { connect: { id: tagId } }
            }))
          }
        } : {})
      },
      include: {
        author: { select: { id: true, name: true } },
        category: true,
        tags: { include: { tag: true } }
      }
    })

    if (isPublishing) {
      const currentExcerpt = excerpt ?? existingPost.excerpt
      const currentTagIds = finalTags
      const needExcerpt = !currentExcerpt
      const needTags = !currentTagIds || currentTagIds.length === 0
      triggerAsyncAITasks(post.id, finalTitle, finalContent || '', needExcerpt, needTags)
    }

    return NextResponse.json({ success: true, post })
  } catch (error) {
    console.error('Update post error:', error)
    return NextResponse.json({ error: '更新文章失败' }, { status: 500 })
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
    const { searchParams } = new URL(request.url)
    const permanent = searchParams.get('permanent') === 'true'

    const post = await db.post.findUnique({ where: { id } })
    if (!post) {
      return NextResponse.json({ error: '文章不存在' }, { status: 404 })
    }

    if (permanent) {
      // 先删除关联的 PostTag 和 Comment 记录，避免外键约束错误
      await db.$transaction([
        db.postTag.deleteMany({ where: { postId: id } }),
        db.comment.deleteMany({ where: { postId: id } }),
        db.post.delete({ where: { id } })
      ])
    } else {
      await db.post.update({
        where: { id },
        data: { status: 'trash' }
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete post error:', error)
    return NextResponse.json({ error: '删除文章失败' }, { status: 500 })
  }
}
