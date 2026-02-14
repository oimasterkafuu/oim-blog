import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'

// 构建评论树结构
function buildCommentTree(comments: any[]): any[] {
  const commentMap = new Map<string, any>()
  const rootComments: any[] = []

  // 先将所有评论放入 Map
  for (const comment of comments) {
    commentMap.set(comment.id, { ...comment, replies: [] })
  }

  // 构建树结构
  for (const comment of comments) {
    const node = commentMap.get(comment.id)!
    if (comment.parentId && commentMap.has(comment.parentId)) {
      commentMap.get(comment.parentId)!.replies.push(node)
    } else {
      rootComments.push(node)
    }
  }

  return rootComments
}

// 计算评论树的总评论数
function countCommentTree(comment: any): number {
  let count = 1
  for (const reply of comment.replies || []) {
    count += countCommentTree(reply)
  }
  return count
}

// 获取评论列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const postId = searchParams.get('postId')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const flat = searchParams.get('flat') === 'true' // 扁平化模式（用于后台管理）

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

    // 后台管理模式：返回扁平化列表
    if (flat && session) {
      const skip = (page - 1) * limit
      
      const [comments, total] = await Promise.all([
        db.comment.findMany({
          where,
          include: {
            post: { select: { id: true, title: true, slug: true } },
            parent: {
              select: {
                id: true,
                authorName: true,
                content: true,
                status: true
              }
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
    }

    // 前台模式：按评论树聚合分页
    // 一次性获取所有符合条件的评论
    const allComments = await db.comment.findMany({
      where,
      include: {
        post: { select: { id: true, title: true, slug: true } },
        parent: {
          select: {
            id: true,
            authorName: true,
            content: true
          }
        }
      },
      orderBy: { createdAt: 'asc' } // 按时间从早到晚
    })

    // 构建评论树
    const rootComments = buildCommentTree(allComments)

    // 按评论树聚合分页
    const paginatedTrees: any[] = []
    let currentCount = 0
    let skippedCount = 0
    let currentPage = 1

    for (const root of rootComments) {
      const treeSize = countCommentTree(root)
      
      // 如果还在跳过前面的页面
      if (currentPage < page) {
        skippedCount += treeSize
        if (skippedCount >= limit) {
          currentPage++
          skippedCount = 0
        }
        continue
      }

      // 当前页：添加评论树
      paginatedTrees.push(root)
      currentCount += treeSize

      // 如果已达到限制，停止
      if (currentCount >= limit) {
        break
      }
    }

    // 计算总评论数
    const totalComments = allComments.length

    // 计算总页数
    let totalPages = 1
    let pageCount = 0
    for (const root of rootComments) {
      pageCount += countCommentTree(root)
      if (pageCount >= limit) {
        totalPages++
        pageCount = 0
      }
    }
    if (pageCount === 0 && totalPages > 1) {
      totalPages--
    }

    return NextResponse.json({
      comments: paginatedTrees,
      pagination: {
        page,
        limit,
        total: totalComments,
        totalPages: Math.max(1, totalPages)
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
