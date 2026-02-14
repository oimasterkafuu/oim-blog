'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
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
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Eye, ArrowLeft, Save, Loader2, RefreshCw } from 'lucide-react'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'

interface Page {
  id: string
  title: string
  slug: string
  content: string
  status: string
  order: number
  createdAt: string
}

export function AdminPages() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const editId = searchParams.get('edit')

  const handleBack = () => {
    router.push('/admin/pages')
  }

  const handleEdit = (id?: string) => {
    if (id) {
      router.push(`/admin/pages?edit=${id}`)
    } else {
      router.push('/admin/pages?edit=new')
    }
  }

  if (editId) {
    return <PageEditor editId={editId === 'new' ? undefined : editId} onBack={handleBack} />
  }

  return <PageList onEdit={handleEdit} />
}

function PageEditor({ editId, onBack }: { editId?: string; onBack: () => void }) {
  const [loading, setLoading] = useState(!!editId)
  const [saving, setSaving] = useState(false)
  const [generatingSlug, setGeneratingSlug] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    content: '',
    status: 'published',
    order: 0
  })
  const initialDataRef = useRef<string>('')

  useEffect(() => {
    if (editId) {
      fetch(`/api/pages/${editId}`)
        .then(r => r.json())
        .then(data => {
          if (data.page) {
            const initialData = {
              title: data.page.title,
              slug: data.page.slug,
              content: data.page.content || '',
              status: data.page.status,
              order: data.page.order || 0
            }
            setFormData(initialData)
            initialDataRef.current = JSON.stringify(initialData)
          }
        })
        .catch(console.error)
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
      initialDataRef.current = JSON.stringify({
        title: '',
        slug: '',
        content: '',
        status: 'published',
        order: 0
      })
    }
  }, [editId])

  useEffect(() => {
    const currentData = JSON.stringify(formData)
    setHasUnsavedChanges(currentData !== initialDataRef.current)
  }, [formData])

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault()
        e.returnValue = ''
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasUnsavedChanges])

  const generateSlug = async (title: string) => {
    if (!title) return
    setGeneratingSlug(true)
    try {
      const res = await fetch('/api/slug', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, type: 'page', excludeId: editId })
      })
      const data = await res.json()
      if (data.slug) {
        setFormData(prev => ({ ...prev, slug: data.slug }))
      }
    } catch (error) {
      console.error(error)
    } finally {
      setGeneratingSlug(false)
    }
  }

  const handleBackClick = () => {
    if (hasUnsavedChanges) {
      if (!confirm('您有未保存的更改，确定要离开吗？')) {
        return
      }
    }
    onBack()
  }

  const handleSubmit = async () => {
    if (!formData.title || !formData.slug) {
      toast.error('请填写标题和别名')
      return
    }

    setSaving(true)
    try {
      const url = editId ? `/api/pages/${editId}` : '/api/pages'
      const method = editId ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      const data = await res.json()

      if (data.success) {
        setHasUnsavedChanges(false)
        toast.success(editId ? '页面已更新' : '页面已创建')
        onBack()
      } else {
        toast.error(data.error || '操作失败')
      }
    } catch {
      toast.error('操作失败')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={handleBackClick}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h2 className="text-2xl font-bold">{editId ? '编辑页面' : '新建页面'}</h2>
        </div>
        <Button onClick={handleSubmit} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? '保存中...' : '保存'}
        </Button>
      </div>

      <div className="grid gap-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>标题 *</Label>
            <Input
              value={formData.title}
              onChange={e => setFormData({ ...formData, title: e.target.value })}
              onBlur={() => {
                if (formData.title && !formData.slug) {
                  generateSlug(formData.title)
                }
              }}
              placeholder="页面标题"
            />
          </div>
          <div className="space-y-2">
            <Label>别名 *</Label>
            <div className="flex gap-2">
              <Input
                value={formData.slug}
                onChange={e => setFormData({ ...formData, slug: e.target.value })}
                placeholder="page-slug"
                className="flex-1"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => generateSlug(formData.title)}
                disabled={generatingSlug || !formData.title}
                title="自动生成别名"
              >
                {generatingSlug ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label>内容 (Markdown)</Label>
          <Textarea
            value={formData.content}
            onChange={e => setFormData({ ...formData, content: e.target.value })}
            className="editor-textarea font-mono"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>状态</Label>
            <Select
              value={formData.status}
              onValueChange={v => setFormData({ ...formData, status: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="published">发布</SelectItem>
                <SelectItem value="draft">草稿</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>排序</Label>
            <Input
              type="number"
              value={formData.order}
              onChange={e => setFormData({ ...formData, order: parseInt(e.target.value) || 0 })}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function PageList({ onEdit }: { onEdit: (id?: string) => void }) {
  const [pages, setPages] = useState<Page[]>([])
  const [loading, setLoading] = useState(true)
  const fetchingRef = useRef(false)

  const loadData = useCallback(async () => {
    if (fetchingRef.current) return
    fetchingRef.current = true
    setLoading(true)

    try {
      const res = await fetch('/api/pages')
      const data = await res.json()
      setPages(data.pages || [])
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
      fetchingRef.current = false
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleDelete = async (page: Page) => {
    if (!confirm(`确定要删除页面 "${page.title}" 吗？`)) return

    try {
      const res = await fetch(`/api/pages/${page.id}`, { method: 'DELETE' })
      const data = await res.json()

      if (data.success) {
        toast.success('页面已删除')
        fetchingRef.current = false
        loadData()
      } else {
        toast.error(data.error)
      }
    } catch {
      toast.error('操作失败')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between">
        <h2 className="text-2xl font-bold">独立页面</h2>
        <Button onClick={() => onEdit()}>
          <Plus className="h-4 w-4 mr-2" />
          新建页面
        </Button>
      </div>

      <Card className="py-0">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">加载中...</div>
          ) : pages.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">暂无页面</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>标题</TableHead>
                  <TableHead>别名</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>排序</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pages.map(page => (
                  <TableRow key={page.id}>
                    <TableCell className="font-medium">{page.title}</TableCell>
                    <TableCell>/{page.slug}</TableCell>
                    <TableCell>
                      {page.status === 'published' ? (
                        <Badge className="bg-green-500">已发布</Badge>
                      ) : (
                        <Badge variant="secondary">草稿</Badge>
                      )}
                    </TableCell>
                    <TableCell>{page.order}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(page.createdAt), 'PP', { locale: zhCN })}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => window.open(`/page/${page.slug}`, '_blank')}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => onEdit(page.id)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(page)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
