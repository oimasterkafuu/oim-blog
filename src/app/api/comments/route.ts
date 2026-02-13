import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'

// 获取评论列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const postId = searchParams.get('postId')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const skip = (page - 1) * limit

    const where: any = {}
    
    const session = await getSession()
    if (!session) {
      where.status = 'approved'
    } else if (status && status !== 'all') {
      where.status = status
    }

    if (postId) {
      where.postId = postId
    }

    const [comments, total] = await Promise.all([
      db.comment.findMany({
        where,
        include: {
          post: { select: { id: true, title: true, slug: true } },
          replies: {
            where: session ? {} : { status: 'approved' },
            orderBy: { createdAt: 'asc' }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      db.comment.count({ where })
    ])

    return NextResponse.json({
      comments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Get comments error:', error)
    return NextResponse.json({ error: '获取评论失败' }, { status: 500 })
  }
}

// 创建评论
export async function POST(request: NextRequest) {
  try {
    const data = await request.json()
    const { postId, parentId, content, authorName, authorEmail, authorUrl } = data

    if (!postId || !content || !authorName || !authorEmail) {
      return NextResponse.json({ error: '请填写完整信息' }, { status: 400 })
    }

    // 检查文章是否存在且允许评论
    const post = await db.post.findUnique({
      where: { id: postId },
      select: { id: true, allowComment: true, status: true }
    })

    if (!post || post.status !== 'published') {
      return NextResponse.json({ error: '文章不存在' }, { status: 404 })
    }

    if (!post.allowComment) {
      return NextResponse.json({ error: '该文章已关闭评论' }, { status: 400 })
    }

    const session = await getSession()
    const comment = await db.comment.create({
      data: {
        content,
        authorName,
        authorEmail,
        authorUrl,
        postId,
        parentId: parentId || null,
        userId: session?.id || null,
        status: session ? 'approved' : 'pending' // 登录用户评论自动通过
      },
      include: {
        post: { select: { id: true, title: true } }
      }
    })

    return NextResponse.json({ 
      success: true, 
      comment,
      message: session ? '评论发表成功' : '评论已提交，等待审核'
    })
  } catch (error) {
    console.error('Create comment error:', error)
    return NextResponse.json({ error: '发表评论失败' }, { status: 500 })
  }
}
