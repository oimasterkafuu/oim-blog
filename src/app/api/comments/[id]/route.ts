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

    // 获取评论信息
    const comment = await db.comment.findUnique({
      where: { id },
      select: { id: true, status: true, parentId: true }
    })

    if (!comment) {
      return NextResponse.json({ error: '评论不存在' }, { status: 404 })
    }

    // 如果设置为非通过状态，需要级联更新所有子评论
    if (status !== 'approved') {
      await updateStatusCascade(id, status)
    } else {
      // 如果设置为通过，检查父评论状态
      if (comment.parentId) {
        const parent = await db.comment.findUnique({
          where: { id: comment.parentId },
          select: { status: true }
        })
        
        if (parent && parent.status !== 'approved') {
          // 父评论未通过时，不允许子评论通过
          return NextResponse.json({ 
            error: '父评论尚未通过审核，无法通过此评论' 
          }, { status: 400 })
        }
      }
      
      // 更新当前评论状态
      await db.comment.update({
        where: { id },
        data: { status }
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Update comment error:', error)
    return NextResponse.json({ error: '更新评论失败' }, { status: 500 })
  }
}

// 级联更新评论状态
async function updateStatusCascade(commentId: string, status: string) {
  // 更新当前评论
  await db.comment.update({
    where: { id: commentId },
    data: { status }
  })

  // 获取所有直接子评论
  const replies = await db.comment.findMany({
    where: { parentId: commentId },
    select: { id: true }
  })

  // 递归更新每个子评论
  for (const reply of replies) {
    await updateStatusCascade(reply.id, status)
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
    const deletedCount = await deleteCommentWithReplies(id)

    return NextResponse.json({ 
      success: true,
      deletedCount,
      message: `已删除 ${deletedCount} 条评论`
    })
  } catch (error) {
    console.error('Delete comment error:', error)
    return NextResponse.json({ error: '删除评论失败' }, { status: 500 })
  }
}

// 递归删除评论及其所有回复
async function deleteCommentWithReplies(commentId: string): Promise<number> {
  // 获取所有直接回复
  const replies = await db.comment.findMany({
    where: { parentId: commentId },
    select: { id: true }
  })

  let count = 0

  // 递归删除每个回复
  for (const reply of replies) {
    count += await deleteCommentWithReplies(reply.id)
  }

  // 删除评论本身
  await db.comment.delete({ where: { id: commentId } })
  
  return count + 1
}