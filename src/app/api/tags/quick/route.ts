import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'

// 快速创建标签
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 })
    }

    const { name } = await request.json()
    
    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: '标签名称不能为空' }, { status: 400 })
    }

    const trimmedName = name.trim()
    if (!trimmedName) {
      return NextResponse.json({ error: '标签名称不能为空' }, { status: 400 })
    }

    // 生成 slug
    const slug = trimmedName
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9\u4e00-\u9fa5-]/g, '')

    // 检查是否已存在
    const existing = await db.tag.findFirst({
      where: {
        OR: [
          { name: trimmedName },
          { slug }
        ]
      }
    })

    if (existing) {
      return NextResponse.json({ success: true, tag: existing, exists: true })
    }

    // 创建新标签
    const tag = await db.tag.create({
      data: {
        name: trimmedName,
        slug: slug || `tag-${Date.now()}`
      }
    })

    return NextResponse.json({ success: true, tag, exists: false })
  } catch (error) {
    console.error('Quick create tag error:', error)
    return NextResponse.json({ error: '创建标签失败' }, { status: 500 })
  }
}
