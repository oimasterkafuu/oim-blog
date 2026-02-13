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
import { toast } from 'sonner'
import { Check, Trash2, X, AlertCircle } from 'lucide-react'
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
  post: { id: string; title: string; slug: string }
  replies?: Comment[]
}

export function AdminComments() {
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 })
  const [currentPage, setCurrentPage] = useState(1)

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
        toast.error(data.error)
      }
    } catch {
      toast.error('操作失败')
    }
  }

  const handleDelete = async (comment: Comment) => {
    if (!confirm('确定要删除这条评论吗？')) return

    try {
      const res = await fetch(`/api/comments/${comment.id}`, { method: 'DELETE' })
      const data = await res.json()
      
      if (data.success) {
        toast.success('评论已删除')
        loadData(currentPage)
      } else {
        toast.error(data.error)
      }
    } catch {
      toast.error('操作失败')
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">评论管理</h2>
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
                    <TableHead>作者</TableHead>
                    <TableHead>内容</TableHead>
                    <TableHead>文章</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>时间</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {comments.map(comment => (
                    <TableRow key={comment.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{comment.authorName}</p>
                          <p className="text-xs text-muted-foreground">{comment.authorEmail}</p>
                          {comment.authorUrl && (
                            <a
                              href={comment.authorUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary hover:underline block truncate max-w-[200px]"
                            >
                              {comment.authorUrl}
                            </a>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <p className="truncate">{comment.content}</p>
                      </TableCell>
                      <TableCell>
                        <a
                          href={`/post/${comment.post.slug}`}
                          target="_blank"
                          className="text-primary hover:underline text-sm"
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
                            >
                              <Check className="h-4 w-4 text-green-500" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(comment)}
                            title="删除"
                          >
                            <Trash2 className="h-4 w-4" />
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
    </div>
  )
}
