'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { Upload, Trash2, Copy, File, FileText, Film, Music, RefreshCw } from 'lucide-react'
import { ImageIcon } from 'lucide-react'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'

interface FileInfo {
  filename: string
  size: number
  createdAt: string
  url: string
}

export function AdminFiles() {
  const [files, setFiles] = useState<FileInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchFiles = useCallback(async () => {
    try {
      const res = await fetch('/api/upload')
      const data = await res.json()
      // 过滤掉 site-icon.png，该文件在系统设置中管理
      const filteredFiles = (data.files || []).filter(
        (f: FileInfo) => f.filename !== 'site-icon.png'
      )
      setFiles(filteredFiles)
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchFiles()
  }, [fetchFiles])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files
    if (!fileList || fileList.length === 0) return

    setUploading(true)
    let successCount = 0
    let failCount = 0

    for (const file of Array.from(fileList)) {
      try {
        const formData = new FormData()
        formData.append('file', file)

        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData
        })

        if (res.ok) {
          successCount++
        } else {
          failCount++
        }
      } catch {
        failCount++
      }
    }

    setUploading(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }

    if (successCount > 0) {
      toast.success(`成功上传 ${successCount} 个文件`)
    }
    if (failCount > 0) {
      toast.error(`${failCount} 个文件上传失败`)
    }
    
    fetchFiles()
  }

  const handleDelete = async (filename: string) => {
    if (!confirm(`确定要删除 ${filename} 吗？`)) {
      return
    }

    try {
      const res = await fetch(`/api/files/${filename}`, {
        method: 'DELETE'
      })
      const data = await res.json()

      if (data.success) {
        toast.success('文件已删除')
        setFiles(prev => prev.filter(f => f.filename !== filename))
      } else {
        toast.error('删除失败')
      }
    } catch {
      toast.error('删除失败')
    }
  }

  const handleCopyUrl = (url: string) => {
    const fullUrl = `${window.location.origin}${url}`
    navigator.clipboard.writeText(fullUrl)
    toast.success('链接已复制')
  }

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getFileIcon = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase() || ''
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext)) {
      return <ImageIcon className="h-8 w-8 text-green-500" />
    }
    if (['mp4', 'avi', 'mov', 'wmv', 'flv', 'mkv'].includes(ext)) {
      return <Film className="h-8 w-8 text-purple-500" />
    }
    if (['mp3', 'wav', 'flac', 'aac', 'ogg'].includes(ext)) {
      return <Music className="h-8 w-8 text-pink-500" />
    }
    if (['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt'].includes(ext)) {
      return <FileText className="h-8 w-8 text-blue-500" />
    }
    return <File className="h-8 w-8 text-gray-500" />
  }

  if (loading) {
    return <div className="text-center text-muted-foreground py-8">加载中...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">文件管理</h2>
        <div className="flex gap-2">
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            {uploading ? '上传中...' : '上传文件'}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleUpload}
            className="hidden"
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>已上传文件 ({files.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {files.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              暂无文件，点击上方按钮上传
            </div>
          ) : (
            <div className="grid gap-3">
              {files.map(file => (
                <div
                  key={file.filename}
                  className="flex items-center justify-between p-4 bg-muted rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    {getFileIcon(file.filename)}
                    <div>
                      <p className="font-medium">{file.filename}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatSize(file.size)} · {format(new Date(file.createdAt), 'PPP HH:mm', { locale: zhCN })}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopyUrl(file.url)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <a
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex"
                    >
                      <Button variant="outline" size="sm">
                        查看
                      </Button>
                    </a>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(file.filename)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
