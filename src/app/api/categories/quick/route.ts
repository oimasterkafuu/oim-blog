import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'

// 快速创建分类
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 })
    }

    const { name } = await request.json()
    
    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: '分类名称不能为空' }, { status: 400 })
    }

    const trimmedName = name.trim()
    if (!trimmedName) {
      return NextResponse.json({ error: '分类名称不能为空' }, { status: 400 })
    }

    // 生成 slug
    const slug = trimmedName
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9\u4e00-\u9fa5-]/g, '')

    // 检查是否已存在
    const existing = await db.category.findFirst({
      where: {
        OR: [
          { name: trimmedName },
          { slug }
        ]
      }
    })

    if (existing) {
      return NextResponse.json({ success: true, category: existing, exists: true })
    }

    // 创建新分类
    const category = await db.category.create({
      data: {
        name: trimmedName,
        slug: slug || `cat-${Date.now()}`,
        order: 0
      }
    })

    return NextResponse.json({ success: true, category, exists: false })
  } catch (error) {
    console.error('Quick create category error:', error)
    return NextResponse.json({ error: '创建分类失败' }, { status: 500 })
  }
}
