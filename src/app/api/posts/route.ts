import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { generateSlug, checkSlugConflict } from '@/lib/slug'
import { triggerAsyncAITasks } from '@/lib/ai-tasks'
import { parseSearchQuery, calculateMatchScore, matchesExcludeTerms } from '@/lib/search'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const category = searchParams.get('category')
    const tag = searchParams.get('tag')
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const skip = (page - 1) * limit

    const where: any = {}

    const session = await getSession()
    if (!session) {
      where.status = 'published'
    } else if (status && status !== 'all') {
      where.status = status
    } else if (!status) {
      where.status = { not: 'trash' }
    }

    if (category) {
      where.category = { slug: category }
    }

    if (tag) {
      where.tags = {
        some: { tag: { slug: tag } }
      }
    }

    let posts: any[] = []
    let total = 0

    if (search) {
      const parsed = parseSearchQuery(search)
      const allTerms = [...parsed.includeTerms, ...parsed.exactTerms]
      
      if (allTerms.length === 0 && parsed.excludeTerms.length === 0) {
        return NextResponse.json({
          posts: [],
          pagination: { page, limit, total: 0, totalPages: 0 }
        })
      }

      const orConditions: any[] = []
      
      for (const term of allTerms) {
        orConditions.push(
          { title: { contains: term } },
          { content: { contains: term } },
          { excerpt: { contains: term } },
          { category: { name: { contains: term } } },
          { tags: { some: { tag: { name: { contains: term } } } } }
        )
      }

      if (allTerms.length > 0) {
        const postsWithMatchingComments = await db.comment.findMany({
          where: {
            OR: allTerms.map(term => ({ content: { contains: term } })),
            status: 'approved'
          },
          select: { postId: true }
        })
        const postIdsFromComments = [...new Set(postsWithMatchingComments.map(c => c.postId))]
        if (postIdsFromComments.length > 0) {
          orConditions.push({ id: { in: postIdsFromComments } })
        }
      }

      where.OR = orConditions

      const allMatchingPosts = await db.post.findMany({
        where,
        include: {
          author: { select: { id: true, name: true, email: true } },
          category: true,
          tags: { include: { tag: true } },
          _count: { select: { comments: { where: { status: 'approved' } } } }
        }
      })

      const filteredPosts = allMatchingPosts.filter(post => 
        !matchesExcludeTerms(post, parsed.excludeTerms)
      )

      const scoredPosts = filteredPosts.map(post => ({
        ...post,
        _matchScore: calculateMatchScore(post, parsed)
      }))

      scoredPosts.sort((a, b) => b._matchScore - a._matchScore)

      total = scoredPosts.length
      posts = scoredPosts.slice(skip, skip + limit)
    } else {
      [posts, total] = await Promise.all([
        db.post.findMany({
          where,
          include: {
            author: { select: { id: true, name: true, email: true } },
            category: true,
            tags: { include: { tag: true } },
            _count: { select: { comments: { where: { status: 'approved' } } } }
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit
        }),
        db.post.count({ where })
      ])
    }

    return NextResponse.json({
      posts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Get posts error:', error)
    return NextResponse.json({ error: '获取文章失败' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 })
    }

    const data = await request.json()
    let { title, slug, content, excerpt, coverImage, status, categoryId, tags, allowComment } = data

    if (!title) {
      return NextResponse.json({ error: '标题不能为空' }, { status: 400 })
    }

    if (!slug) {
      slug = generateSlug(title)
    }

    const slugConflict = await checkSlugConflict(slug, db)
    if (slugConflict.conflict) {
      return NextResponse.json({ error: slugConflict.message }, { status: 400 })
    }

    const post = await db.post.create({
      data: {
        title,
        slug,
        content: content || '',
        excerpt,
        coverImage,
        status: status || 'draft',
        allowComment: allowComment !== false,
        authorId: session.id,
        categoryId: categoryId || null,
        ...(tags && tags.length > 0 ? {
          tags: {
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

    if (status === 'published') {
      const needExcerpt = !excerpt
      const needTags = !tags || tags.length === 0
      triggerAsyncAITasks(post.id, title, content || '', needExcerpt, needTags)
    }

    return NextResponse.json({ success: true, post })
  } catch (error) {
    console.error('Create post error:', error)
    return NextResponse.json({ error: '创建文章失败' }, { status: 500 })
  }
}
