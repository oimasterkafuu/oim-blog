import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const adminCount = await db.user.count({ where: { role: 'admin' } })
    return NextResponse.json({ initialized: adminCount > 0 })
  } catch (error) {
    console.error('Check init status error:', error)
    return NextResponse.json({ initialized: false }, { status: 500 })
  }
}
