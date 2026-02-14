import { NextRequest, NextResponse } from 'next/server'
import { generateSlug, checkSlugConflict, SlugType } from '@/lib/slug'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const { title, type, excludeId } = await request.json()

    if (!title) {
      return NextResponse.json({ error: '标题不能为空' }, { status: 400 })
    }

    const slug = generateSlug(title)

    const conflict = await checkSlugConflict(slug, db, { type: type as SlugType, excludeId })
    if (conflict.conflict) {
      let finalSlug = slug
      let counter = 1
      while (true) {
        finalSlug = `${slug}-${counter}`
        const c = await checkSlugConflict(finalSlug, db, { type: type as SlugType, excludeId })
        if (!c.conflict) break
        counter++
      }
      return NextResponse.json({ slug: finalSlug })
    }

    return NextResponse.json({ slug })
  } catch (error) {
    console.error('Slug generation error:', error)
    return NextResponse.json({ error: '生成别名失败' }, { status: 500 })
  }
}
