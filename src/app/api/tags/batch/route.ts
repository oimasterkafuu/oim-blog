import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { generateSlug } from '@/lib/slug'

// 批量创建/获取标签
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 })
    }

    const { tags } = await request.json()
    
    if (!tags || !Array.isArray(tags)) {
      return NextResponse.json({ error: '标签格式错误' }, { status: 400 })
    }

    const results: { id: string; name: string; slug: string }[] = []

    for (const tagName of tags) {
      if (!tagName || typeof tagName !== 'string') continue
      
      const trimmedName = tagName.trim()
      if (!trimmedName) continue

      let tag = await db.tag.findFirst({
        where: { name: trimmedName }
      })

      if (!tag) {
        const slug = generateSlug(trimmedName)
        tag = await db.tag.create({
          data: {
            name: trimmedName,
            slug
          }
        })
      }

      results.push(tag)
    }

    return NextResponse.json({ success: true, tags: results })
  } catch (error) {
    console.error('Batch create tags error:', error)
    return NextResponse.json({ error: '批量创建标签失败' }, { status: 500 })
  }
}
