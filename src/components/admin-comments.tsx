'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { Check, Trash2, RefreshCw, CornerDownRight, AlertCircle } from 'lucide-react'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'

interface Comment {
  id: string
  content: string
  authorName: string
  authorEmail: string
  authorUrl: string | null
  status: string
  createdAt: string
  parentId: string | null
  post: { id: string; title: string; slug: string }
  parent?: { 
    id: string
    authorName: string
    content: string
    status: string
  } | null
}

export function AdminComments() {
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 })
  const [currentPage, setCurrentPage] = useState(1)
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; comment: Comment | null }>({
    open: false,
    comment: null
  })
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    loadData(1)
  }, [statusFilter])

  const loadData = async (page: number = 1) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.set('status', statusFilter)
      params.set('limit', '20')
      params.set('page', String(page))
      params.set('flat', 'true') // 使用扁平化模式
      
      const res = await fetch(`/api/comments?${params}`)
      const data = await res.json()
      setComments(data.comments || [])
      setPagination(data.pagination || { page: 1, total: 0, totalPages: 0 })
      setCurrentPage(page)
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateStatus = async (comment: Comment, status: string) => {
    try {
      const res = await fetch(`/api/comments/${comment.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      })
      const data = await res.json()
      
      if (data.success) {
        toast.success('状态已更新')
        loadData(currentPage)
      } else {
        toast.error(data.error || '操作失败')
      }
    } catch {
      toast.error('操作失败')
    }
  }

  const handleDelete = async () => {
    if (!deleteDialog.comment) return
    setDeleting(true)

    try {
      const res = await fetch(`/api/comments/${deleteDialog.comment.id}`, { method: 'DELETE' })
      const data = await res.json()
      
      if (data.success) {
        toast.success(data.message || '评论已删除')
        loadData(currentPage)
      } else {
        toast.error(data.error || '删除失败')
      }
    } catch {
      toast.error('操作失败')
    } finally {
      setDeleting(false)
      setDeleteDialog({ open: false, comment: null })
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-500">已通过</Badge>
      case 'pending':
        return <Badge variant="secondary">待审核</Badge>
      case 'spam':
        return <Badge variant="destructive">垃圾</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  // 检查父评论是否未通过（用于禁用过审按钮）
  const isParentNotApproved = (comment: Comment) => {
    return comment.parent && comment.parent.status !== 'approved'
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">评论管理</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => loadData(currentPage)}>
            <RefreshCw className="h-4 w-4 mr-1" />
            刷新
          </Button>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部状态</SelectItem>
              <SelectItem value="approved">已通过</SelectItem>
              <SelectItem value="pending">待审核</SelectItem>
              <SelectItem value="spam">垃圾</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="py-0">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">加载中...</div>
          ) : comments.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">暂无评论</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]">作者</TableHead>
                    <TableHead className="min-w-[280px]">内容</TableHead>
                    <TableHead className="w-[150px]">文章</TableHead>
                    <TableHead className="w-[80px]">状态</TableHead>
                    <TableHead className="w-[100px]">时间</TableHead>
                    <TableHead className="w-[140px] text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {comments.map(comment => (
                    <TableRow key={comment.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{comment.authorName}</p>
                          <p className="text-xs text-muted-foreground truncate">{comment.authorEmail}</p>
                          {comment.authorUrl && (
                            <a
                              href={comment.authorUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary hover:underline block truncate max-w-[160px]"
                            >
                              {comment.authorUrl}
                            </a>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {/* 回复提示 */}
                        {comment.parent && (
                          <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                            <CornerDownRight className="h-3 w-3" />
                            回复 @{comment.parent.authorName}
                          </div>
                        )}
                        {/* 评论内容 */}
                        <p className="whitespace-pre-wrap break-words">{comment.content}</p>
                      </TableCell>
                      <TableCell>
                        <a
                          href={`/post/${comment.post.slug}`}
                          target="_blank"
                          className="text-primary hover:underline text-sm line-clamp-2"
                        >
                          {comment.post.title}
                        </a>
                      </TableCell>
                      <TableCell>{getStatusBadge(comment.status)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(comment.createdAt), 'PP', { locale: zhCN })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {comment.status === 'pending' && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleUpdateStatus(comment, 'approved')}
                                title="通过"
                                disabled={isParentNotApproved(comment)}
                              >
                                <Check className="h-4 w-4 text-green-500" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleUpdateStatus(comment, 'spam')}
                                title="标记为垃圾"
                              >
                                <AlertCircle className="h-4 w-4 text-orange-500" />
                              </Button>
                            </>
                          )}
                          {comment.status === 'spam' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleUpdateStatus(comment, 'approved')}
                              title="恢复"
                              disabled={isParentNotApproved(comment)}
                            >
                              <Check className="h-4 w-4 text-green-500" />
                            </Button>
                          )}
                          {comment.status === 'approved' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleUpdateStatus(comment, 'pending')}
                              title="取消通过"
                            >
                              <AlertCircle className="h-4 w-4 text-yellow-500" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteDialog({ open: true, comment })}
                            title="删除"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex justify-center gap-2 p-4 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadData(currentPage - 1)}
                disabled={currentPage <= 1}
              >
                上一页
              </Button>
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                第 {currentPage} / {pagination.totalPages} 页 (共 {pagination.total} 条)
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadData(currentPage + 1)}
                disabled={currentPage >= pagination.totalPages}
              >
                下一页
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, comment: deleteDialog.comment })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteDialog.comment?.parentId ? (
                '确定要删除这条回复吗？'
              ) : (
                '这是一条一级评论，删除后将同时删除其下所有回复。确定要继续吗？'
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete} 
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? '删除中...' : '确认删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}