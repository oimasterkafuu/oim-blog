'use client'

import { useEffect, useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, RefreshCw, Loader2 } from 'lucide-react'

interface Tag {
  id: string
  name: string
  slug: string
  _count?: { posts: number }
}

export function AdminTags() {
  const [tags, setTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTag, setEditingTag] = useState<Tag | null>(null)
  const [generatingSlug, setGeneratingSlug] = useState(false)
  const [formData, setFormData] = useState({ name: '', slug: '' })
  const prevSlugRef = useRef<string>('')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/tags')
      const data = await res.json()
      setTags(data.tags || [])
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenDialog = (tag?: Tag) => {
    if (tag) {
      setEditingTag(tag)
      setFormData({ name: tag.name, slug: tag.slug })
      prevSlugRef.current = tag.slug
    } else {
      setEditingTag(null)
      setFormData({ name: '', slug: '' })
      prevSlugRef.current = ''
    }
    setDialogOpen(true)
  }

  const generateSlug = async (name: string) => {
    if (!name) return
    setGeneratingSlug(true)
    try {
      const res = await fetch('/api/slug', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: name })
      })
      const data = await res.json()
      if (data.slug) {
        setFormData(prev => ({ ...prev, slug: data.slug }))
        prevSlugRef.current = data.slug
      }
    } catch (error) {
      console.error(error)
    } finally {
      setGeneratingSlug(false)
    }
  }

  const handleNameChange = async (newName: string) => {
    const oldExpectedSlug = prevSlugRef.current

    setFormData(prev => ({ ...prev, name: newName }))

    const isBound = !oldExpectedSlug || formData.slug === oldExpectedSlug

    if (isBound) {
      if (newName) {
        try {
          const res = await fetch('/api/slug', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: newName })
          })
          const data = await res.json()
          if (data.slug) {
            setFormData(prev => ({ ...prev, slug: data.slug }))
            prevSlugRef.current = data.slug
          }
        } catch (error) {
          console.error(error)
        }
      } else {
        setFormData(prev => ({ ...prev, slug: '' }))
        prevSlugRef.current = ''
      }
    }
  }

  const handleSubmit = async () => {
    if (!formData.name || !formData.slug) {
      toast.error('请填写名称和别名')
      return
    }

    try {
      const url = editingTag ? `/api/tags/${editingTag.id}` : '/api/tags'
      const method = editingTag ? 'PUT' : 'POST'
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      
      const data = await res.json()
      
      if (data.success) {
        toast.success(editingTag ? '标签已更新' : '标签已创建')
        setDialogOpen(false)
        loadData()
      } else {
        toast.error(data.error || '操作失败')
      }
    } catch {
      toast.error('操作失败')
    }
  }

  const handleDelete = async (tag: Tag) => {
    if (!confirm(`确定要删除标签 "${tag.name}" 吗？`)) return

    try {
      const res = await fetch(`/api/tags/${tag.id}`, { method: 'DELETE' })
      const data = await res.json()
      
      if (data.success) {
        toast.success('标签已删除')
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
        <h2 className="text-2xl font-bold">标签管理</h2>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="h-4 w-4 mr-2" />
          新建标签
        </Button>
      </div>

      <Card className="py-0">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">加载中...</div>
          ) : tags.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">暂无标签</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>名称</TableHead>
                  <TableHead>别名</TableHead>
                  <TableHead>文章数</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tags.map(tag => (
                  <TableRow key={tag.id}>
                    <TableCell className="font-medium">{tag.name}</TableCell>
                    <TableCell>{tag.slug}</TableCell>
                    <TableCell>{tag._count?.posts || 0}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(tag)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(tag)}>
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTag ? '编辑标签' : '新建标签'}</DialogTitle>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>名称 *</Label>
                <Input
                  value={formData.name}
                  onChange={e => handleNameChange(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>别名 *</Label>
                <div className="flex gap-2">
                  <Input
                    value={formData.slug}
                    onChange={e => setFormData({ ...formData, slug: e.target.value })}
                    className="flex-1"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => generateSlug(formData.name)}
                    disabled={generatingSlug || !formData.name}
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
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button onClick={handleSubmit}>{editingTag ? '更新' : '创建'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
