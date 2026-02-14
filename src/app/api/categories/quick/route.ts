import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { generateSlug, checkSlugConflict } from '@/lib/slug'

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

    // 使用 generateSlug 生成拼音别名
    let slug = generateSlug(trimmedName)

    // 检查是否已存在同名分类
    const existingByName = await db.category.findFirst({
      where: { name: trimmedName }
    })

    if (existingByName) {
      return NextResponse.json({ success: true, category: existingByName, exists: true })
    }

    // 检查 slug 冲突，如有冲突则添加后缀
    const conflict = await checkSlugConflict(slug, db, { type: 'category' })
    if (conflict.conflict) {
      let counter = 1
      while (true) {
        const newSlug = `${slug}-${counter}`
        const c = await checkSlugConflict(newSlug, db, { type: 'category' })
        if (!c.conflict) {
          slug = newSlug
          break
        }
        counter++
      }
    }

    // 创建新分类
    const category = await db.category.create({
      data: {
        name: trimmedName,
        slug,
        order: 0
      }
    })

    return NextResponse.json({ success: true, category, exists: false })
  } catch (error) {
    console.error('Quick create category error:', error)
    return NextResponse.json({ error: '创建分类失败' }, { status: 500 })
  }
}
