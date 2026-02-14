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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useIsMobile } from '@/hooks/use-mobile'
import { MarkdownRenderer } from '@/components/markdown'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Eye, Search, RotateCcw, ArrowLeft, Save, Sparkles, Loader2, RefreshCw, Edit, Eye as EyeIcon } from 'lucide-react'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'

interface Post {
  id: string
  title: string
  slug: string
  content: string
  excerpt: string | null
  coverImage: string | null
  status: string
  viewCount: number
  createdAt: string
  category: { id: string; name: string } | null
  tags: { tag: { id: string; name: string } }[]
  author: { id: string; name: string }
}

interface Category {
  id: string
  name: string
  slug: string
}

interface Tag {
  id: string
  name: string
  slug: string
}

export function AdminPosts() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const editId = searchParams.get('edit')

  const handleBack = () => {
    router.push('/admin/posts')
  }

  const handleEdit = (id?: string) => {
    if (id) {
      router.push(`/admin/posts?edit=${id}`)
    } else {
      router.push('/admin/posts?edit=new')
    }
  }

  if (editId) {
    return <PostEditor editId={editId === 'new' ? undefined : editId} onBack={handleBack} />
  }

  return <PostList onEdit={handleEdit} />
}

function PostEditor({ editId, onBack }: { editId?: string; onBack: () => void }) {
  const isMobile = useIsMobile()
  const [mobileTab, setMobileTab] = useState<'edit' | 'preview'>('edit')
  const [categories, setCategories] = useState<Category[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(!!editId)
  const [saving, setSaving] = useState(false)
  const [generatingSlug, setGeneratingSlug] = useState(false)
  const [generatingExcerpt, setGeneratingExcerpt] = useState(false)
  const [generatingTags, setGeneratingTags] = useState(false)
  const [showNewCategory, setShowNewCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    content: '',
    excerpt: '',
    coverImage: '',
    status: 'draft',
    categoryId: '__none__',
    tagsString: ''
  })
  const initialDataRef = useRef<string>('')
  const prevSlugRef = useRef<string>('')
  const editorRef = useRef<HTMLTextAreaElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const isSyncingRef = useRef(false)

  useEffect(() => {
    loadData()

    if (editId) {
      fetch(`/api/posts/${editId}`)
        .then(r => r.json())
        .then(data => {
          if (data.post) {
            const initialData = {
              title: data.post.title,
              slug: data.post.slug,
              content: data.post.content || '',
              excerpt: data.post.excerpt || '',
              coverImage: data.post.coverImage || '',
              status: data.post.status,
              categoryId: data.post.category?.id || '__none__',
              tagsString: data.post.tags?.map((t: any) => t.tag.name).join(', ') || ''
            }
            setFormData(initialData)
            prevSlugRef.current = data.post.slug
            initialDataRef.current = JSON.stringify(initialData)
          }
        })
        .catch(console.error)
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
      prevSlugRef.current = ''
      initialDataRef.current = JSON.stringify({
        title: '',
        slug: '',
        content: '',
        excerpt: '',
        coverImage: '',
        status: 'draft',
        categoryId: '__none__',
        tagsString: ''
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

  const loadData = async () => {
    const [catData, tagData] = await Promise.all([
      fetch('/api/categories').then(r => r.json()),
      fetch('/api/tags').then(r => r.json())
    ])
    setCategories(catData.categories || [])
    setTags(tagData.tags || [])
  }

  const generateSlug = async (title: string) => {
    if (!title) return
    setGeneratingSlug(true)
    try {
      const res = await fetch('/api/slug', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title })
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

  const handleTitleChange = async (newTitle: string) => {
    const oldExpectedSlug = prevSlugRef.current

    setFormData(prev => ({ ...prev, title: newTitle }))

    const isBound = !oldExpectedSlug || formData.slug === oldExpectedSlug

    if (isBound) {
      if (newTitle) {
        try {
          const res = await fetch('/api/slug', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: newTitle })
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

  const generateExcerpt = async () => {
    if (!formData.content && !formData.title) {
      toast.error('请先填写标题或内容')
      return
    }
    setGeneratingExcerpt(true)
    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'excerpt',
          content: formData.content,
          title: formData.title
        })
      })
      const data = await res.json()
      if (data.success) {
        setFormData(prev => ({ ...prev, excerpt: data.result }))
        toast.success('摘要已生成')
      } else {
        toast.error(data.error || '生成失败')
      }
    } catch (error) {
      toast.error('生成失败')
    } finally {
      setGeneratingExcerpt(false)
    }
  }

  const generateTags = async () => {
    if (!formData.content && !formData.title) {
      toast.error('请先填写标题或内容')
      return
    }
    setGeneratingTags(true)
    try {
      const existingTagNames = tags.map(t => t.name)
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'tags',
          content: formData.content,
          title: formData.title,
          existingTags: existingTagNames
        })
      })
      const data = await res.json()
      if (data.success) {
        const generatedTags = data.result.split(/[,，]/).map((t: string) => t.trim()).filter(Boolean)

        const batchRes = await fetch('/api/tags/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tags: generatedTags })
        })
        const batchData = await batchRes.json()

        if (batchData.success) {
          const allTags = formData.tagsString
            ? formData.tagsString.split(/[,，]/).map(t => t.trim()).filter(Boolean)
            : []
          const newTags = [...new Set([...allTags, ...generatedTags])]
          setFormData(prev => ({ ...prev, tagsString: newTags.join(', ') }))
          loadData()
          toast.success(`已生成 ${generatedTags.length} 个标签`)
        }
      } else {
        toast.error(data.error || '生成失败')
      }
    } catch (error) {
      toast.error('生成失败')
    } finally {
      setGeneratingTags(false)
    }
  }

  const handleQuickCreateCategory = async () => {
    if (!newCategoryName.trim()) return
    try {
      const res = await fetch('/api/categories/quick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCategoryName.trim() })
      })
      const data = await res.json()
      if (data.success) {
        await loadData()
        setFormData(prev => ({ ...prev, categoryId: data.category.id }))
        setShowNewCategory(false)
        setNewCategoryName('')
        toast.success(data.exists ? '分类已存在，已自动选择' : '分类已创建')
      }
    } catch {
      toast.error('创建失败')
    }
  }

  // 同步滚动处理函数
  const handleEditorScroll = useCallback((e: React.UIEvent<HTMLTextAreaElement>) => {
    if (isSyncingRef.current || !previewRef.current) return

    isSyncingRef.current = true
    const editor = e.currentTarget
    const preview = previewRef.current

    const scrollRatio = editor.scrollTop / (editor.scrollHeight - editor.clientHeight)
    const previewScrollTop = scrollRatio * (preview.scrollHeight - preview.clientHeight)

    preview.scrollTop = previewScrollTop

    requestAnimationFrame(() => {
      isSyncingRef.current = false
    })
  }, [])

  const handlePreviewScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (isSyncingRef.current || !editorRef.current) return

    isSyncingRef.current = true
    const preview = e.currentTarget
    const editor = editorRef.current

    const scrollRatio = preview.scrollTop / (preview.scrollHeight - preview.clientHeight)
    const editorScrollTop = scrollRatio * (editor.scrollHeight - editor.clientHeight)

    editor.scrollTop = editorScrollTop

    requestAnimationFrame(() => {
      isSyncingRef.current = false
    })
  }, [])

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
      const url = editId ? `/api/posts/${editId}` : '/api/posts'
      const method = editId ? 'PUT' : 'POST'

      const tagNames = formData.tagsString
        .split(/[,，]/)
        .map(t => t.trim())
        .filter(Boolean)

      let tagIds: string[] = []
      if (tagNames.length > 0) {
        const batchRes = await fetch('/api/tags/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tags: tagNames })
        })
        const batchData = await batchRes.json()
        if (batchData.success) {
          tagIds = batchData.tags.map((t: Tag) => t.id)
        }
      }

      const submitData = {
        title: formData.title,
        slug: formData.slug,
        content: formData.content,
        excerpt: formData.excerpt,
        coverImage: formData.coverImage,
        status: formData.status,
        categoryId: formData.categoryId === '__none__' ? null : formData.categoryId,
        tags: tagIds
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData)
      })

      const data = await res.json()

      if (data.success) {
        setHasUnsavedChanges(false)
        toast.success(editId ? '文章已更新' : '文章已创建')
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
          <h2 className="text-2xl font-bold">{editId ? '编辑文章' : '新建文章'}</h2>
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
              onChange={e => handleTitleChange(e.target.value)}
              placeholder="文章标题"
            />
          </div>
          <div className="space-y-2">
            <Label>别名 *</Label>
            <div className="flex gap-2">
              <Input
                value={formData.slug}
                onChange={e => setFormData({ ...formData, slug: e.target.value })}
                placeholder="article-slug"
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
          {isMobile ? (
            <Tabs value={mobileTab} onValueChange={(v) => setMobileTab(v as 'edit' | 'preview')} className="w-full">
              <TabsList className="w-full">
                <TabsTrigger value="edit" className="flex-1">
                  <Edit className="h-4 w-4 mr-2" />
                  编辑
                </TabsTrigger>
                <TabsTrigger value="preview" className="flex-1">
                  <EyeIcon className="h-4 w-4 mr-2" />
                  预览
                </TabsTrigger>
              </TabsList>
              <TabsContent value="edit" className="mt-2">
                <Textarea
                  value={formData.content}
                  onChange={e => setFormData({ ...formData, content: e.target.value })}
                  className="editor-textarea font-mono min-h-[400px]"
                />
              </TabsContent>
              <TabsContent value="preview" className="mt-2">
                <div className="border rounded-md p-4 min-h-[400px] overflow-auto bg-background">
                  {formData.content ? (
                    <MarkdownRenderer content={formData.content} />
                  ) : (
                    <p className="text-muted-foreground">暂无内容</p>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <Edit className="h-3 w-3" />
                  编辑
                </span>
                <Textarea
                  ref={editorRef}
                  value={formData.content}
                  onChange={e => setFormData({ ...formData, content: e.target.value })}
                  onScroll={handleEditorScroll}
                  className="editor-textarea font-mono !h-[600px] resize-none overflow-auto field-sizing-fixed"
                />
              </div>
              <div className="space-y-1">
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <EyeIcon className="h-3 w-3" />
                  预览
                </span>
                <div
                  ref={previewRef}
                  onScroll={handlePreviewScroll}
                  className="border rounded-md p-2 h-[600px] overflow-auto bg-background [&>*:first-child>*:first-child]:!mt-0"
                >
                  {formData.content ? (
                    <MarkdownRenderer content={formData.content} />
                  ) : (
                    <p className="text-muted-foreground">暂无内容</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>摘要</Label>
            <div className="relative">
              <Textarea
                value={formData.excerpt}
                onChange={e => setFormData({ ...formData, excerpt: e.target.value })}
                placeholder="文章摘要（可选）"
                className="excerpt-textarea pr-10"
              />
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1 h-8 w-8"
                onClick={generateExcerpt}
                disabled={generatingExcerpt}
                title="AI 生成摘要"
              >
                {generatingExcerpt ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 text-primary" />
                )}
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>封面图片</Label>
            <Input
              value={formData.coverImage}
              onChange={e => setFormData({ ...formData, coverImage: e.target.value })}
              placeholder="https://example.com/image.jpg"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                <SelectItem value="draft">草稿</SelectItem>
                <SelectItem value="published">发布</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>分类</Label>
            <div className="flex gap-2">
              <Select
                value={formData.categoryId}
                onValueChange={v => setFormData({ ...formData, categoryId: v })}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="选择分类" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">无分类</SelectItem>
                  {categories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowNewCategory(!showNewCategory)}
                title="新建分类"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {showNewCategory && (
              <div className="flex gap-2 mt-2">
                <Input
                  placeholder="新分类名称"
                  value={newCategoryName}
                  onChange={e => setNewCategoryName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleQuickCreateCategory()}
                />
                <Button size="sm" onClick={handleQuickCreateCategory}>创建</Button>
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label>标签</Label>
            <div className="flex gap-2">
              <Input
                value={formData.tagsString}
                onChange={e => setFormData({ ...formData, tagsString: e.target.value })}
                placeholder="标签1, 标签2"
                className="flex-1"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={generateTags}
                disabled={generatingTags}
                title="AI 生成标签"
              >
                {generatingTags ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 text-primary" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">使用逗号分隔多个标签</p>
          </div>
        </div>

        {tags.length > 0 && (
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">已有标签（点击添加）</Label>
            <div className="flex flex-wrap gap-2">
              {tags.map(tag => {
                const isSelected = formData.tagsString
                  .split(/[,，]/)
                  .map(t => t.trim())
                  .includes(tag.name)
                return (
                  <Badge
                    key={tag.id}
                    variant={isSelected ? "default" : "outline"}
                    className="cursor-pointer hover:bg-primary/10"
                    onClick={() => {
                      const currentTags = formData.tagsString
                        .split(/[,，]/)
                        .map(t => t.trim())
                        .filter(Boolean)
                      if (isSelected) {
                        setFormData({
                          ...formData,
                          tagsString: currentTags.filter(t => t !== tag.name).join(', ')
                        })
                      } else {
                        setFormData({
                          ...formData,
                          tagsString: [...currentTags, tag.name].join(', ')
                        })
                      }
                    }}
                  >
                    {tag.name}
                  </Badge>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function PostList({ onEdit }: { onEdit: (id?: string) => void }) {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 })
  const [currentPage, setCurrentPage] = useState(1)
  const fetchingRef = useRef(false)

  const loadData = useCallback(async (page: number = 1) => {
    if (fetchingRef.current) return
    fetchingRef.current = true
    setLoading(true)

    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (search) params.set('search', search)
      params.set('limit', '20')
      params.set('page', String(page))

      const res = await fetch(`/api/posts?${params}`)
      const data = await res.json()
      setPosts(data.posts || [])
      setPagination(data.pagination || { page: 1, total: 0, totalPages: 0 })
      setCurrentPage(page)
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
      fetchingRef.current = false
    }
  }, [statusFilter, search])

  useEffect(() => {
    fetchingRef.current = false
    loadData(1)
  }, [loadData])

  const handleDelete = async (post: Post, permanent = false) => {
    if (!confirm(permanent ? '确定要永久删除这篇文章吗？' : '确定要将文章移到回收站吗？')) {
      return
    }

    try {
      const url = `/api/posts/${post.id}${permanent ? '?permanent=true' : ''}`
      const res = await fetch(url, { method: 'DELETE' })
      const data = await res.json()

      if (data.success) {
        toast.success(permanent ? '文章已永久删除' : '文章已移到回收站')
        fetchingRef.current = false
        loadData(currentPage)
      } else {
        toast.error(data.error)
      }
    } catch {
      toast.error('操作失败')
    }
  }

  const handleRestore = async (post: Post) => {
    try {
      const res = await fetch(`/api/posts/${post.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'draft' })
      })
      const data = await res.json()

      if (data.success) {
        toast.success('文章已恢复')
        fetchingRef.current = false
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
      case 'published':
        return <Badge className="bg-green-500">已发布</Badge>
      case 'draft':
        return <Badge variant="secondary">草稿</Badge>
      case 'trash':
        return <Badge variant="destructive">回收站</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <h2 className="text-2xl font-bold">文章管理</h2>
        <Button onClick={() => onEdit()}>
          <Plus className="h-4 w-4 mr-2" />
          新建文章
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 flex gap-2">
          <Input
            placeholder="搜索文章..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && loadData(1)}
            className="max-w-sm"
          />
          <Button variant="outline" onClick={() => loadData(1)}>
            <Search className="h-4 w-4" />
          </Button>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            <SelectItem value="published">已发布</SelectItem>
            <SelectItem value="draft">草稿</SelectItem>
            <SelectItem value="trash">回收站</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="py-0">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">加载中...</div>
          ) : posts.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">暂无文章</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>标题</TableHead>
                    <TableHead>分类</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>浏览</TableHead>
                    <TableHead>创建时间</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {posts.map(post => (
                    <TableRow key={post.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{post.title}</p>
                          <p className="text-xs text-muted-foreground">/{post.slug}</p>
                        </div>
                      </TableCell>
                      <TableCell>{post.category?.name || '-'}</TableCell>
                      <TableCell>{getStatusBadge(post.status)}</TableCell>
                      <TableCell>{post.viewCount}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(post.createdAt), 'PPP', { locale: zhCN })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {post.status === 'trash' ? (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRestore(post)}
                                title="恢复"
                              >
                                <RotateCcw className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(post, true)}
                                title="永久删除"
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => window.open(`/post/${post.slug}`, '_blank')}
                                title="查看"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => onEdit(post.id)}
                                title="编辑"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(post)}
                                title="删除"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
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
