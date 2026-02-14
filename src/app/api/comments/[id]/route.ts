import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'

// 更新评论状态
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
    const { status } = await request.json()

    const comment = await db.comment.update({
      where: { id },
      data: { status }
    })

    return NextResponse.json({ success: true, comment })
  } catch (error) {
    console.error('Update comment error:', error)
    return NextResponse.json({ error: '更新评论失败' }, { status: 500 })
  }
}

// 删除评论
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
    // 递归删除所有回复，然后删除评论本身
    await deleteCommentWithReplies(id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete comment error:', error)
    return NextResponse.json({ error: '删除评论失败' }, { status: 500 })
  }
}

// 递归删除评论及其所有回复
async function deleteCommentWithReplies(commentId: string) {
  // 获取所有直接回复
  const replies = await db.comment.findMany({
    where: { parentId: commentId },
    select: { id: true }
  })

  // 递归删除每个回复
  for (const reply of replies) {
    await deleteCommentWithReplies(reply.id)
  }

  // 删除评论本身
  await db.comment.delete({ where: { id: commentId } })
}
