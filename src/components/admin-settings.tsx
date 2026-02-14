'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { toast } from 'sonner'
import { Save, Sparkles, Info, Download, Upload, Trash2, Database, User, Key, RefreshCw, Image as ImageIcon, Rocket } from 'lucide-react'
import { useBlog } from './blog-provider'

interface BackupFile {
  filename: string
  url: string
}

export function AdminSettings() {
  const { user, setUser } = useBlog()
  const [settings, setSettings] = useState({
    site_name: '',
    site_description: '',
    site_keywords: '',
    posts_per_page: '10',
    comments_per_page: '20',
    ai_api_url: '',
    ai_model_name: '',
    ai_api_key: '',
    jwt_secret: ''
  })
  const [userForm, setUserForm] = useState({
    newName: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })
  const [backups, setBackups] = useState<BackupFile[]>([])
  const [siteIcon, setSiteIcon] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingUser, setSavingUser] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadingIcon, setUploadingIcon] = useState(false)
  const fetchingRef = useRef(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const iconInputRef = useRef<HTMLInputElement>(null)

  const loadData = useCallback(async () => {
    if (fetchingRef.current) return
    fetchingRef.current = true

    try {
      const [settingsRes, backupsRes, iconRes] = await Promise.all([
        fetch('/api/settings'),
        fetch('/api/backup', { method: 'POST' }),
        fetch('/api/icon')
      ])
      
      const settingsData = await settingsRes.json()
      const backupsData = await backupsRes.json()
      const iconData = await iconRes.json()
      
      if (settingsData.settings) {
        setSettings({
          site_name: settingsData.settings.site_name || '',
          site_description: settingsData.settings.site_description || '',
          site_keywords: settingsData.settings.site_keywords || '',
          posts_per_page: settingsData.settings.posts_per_page || '10',
          comments_per_page: settingsData.settings.comments_per_page || '20',
          ai_api_url: settingsData.settings.ai_api_url || '',
          ai_model_name: settingsData.settings.ai_model_name || '',
          ai_api_key: settingsData.settings.ai_api_key || '',
          jwt_secret: settingsData.settings.jwt_secret || ''
        })
      }

      if (backupsData.backups) {
        setBackups(backupsData.backups)
      }

      setSiteIcon(iconData.icon || null)

      if (user) {
        setUserForm(prev => ({ ...prev, newName: user.name }))
      }
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    loadData()
  }, [loadData])

  // 保存网站设置
  const handleSaveSettings = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      })
      const data = await res.json()

      if (data.success) {
        if (data.sessionRotated) {
          toast.success(data.message || '设置已保存，Session 已重新签发')
        } else {
          toast.success('设置已保存')
        }
      } else {
        toast.error('保存失败')
      }
    } catch {
      toast.error('保存失败')
    } finally {
      setSaving(false)
    }
  }

  // 保存用户信息
  const handleSaveUser = async () => {
    if (userForm.newPassword && userForm.newPassword !== userForm.confirmPassword) {
      toast.error('两次输入的新密码不一致')
      return
    }

    setSavingUser(true)
    try {
      const res = await fetch('/api/user/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userForm)
      })
      const data = await res.json()
      
      if (data.success) {
        toast.success(data.message)
        setUser(data.user)
        setUserForm(prev => ({
          ...prev,
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        }))
      } else {
        toast.error(data.error || '保存失败')
      }
    } catch {
      toast.error('保存失败')
    } finally {
      setSavingUser(false)
    }
  }

  // 下载数据库备份
  const handleBackup = async () => {
    try {
      const res = await fetch('/api/backup')
      if (!res.ok) {
        throw new Error('备份失败')
      }
      
      const blob = await res.blob()
      const contentDisposition = res.headers.get('Content-Disposition')
      const filename = contentDisposition?.match(/filename="(.+)"/)?.[1] || 'backup.db'
      
      // 创建下载链接
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      
      toast.success('备份已下载')
      
      // 刷新备份列表
      const backupsRes = await fetch('/api/backup', { method: 'POST' })
      const backupsData = await backupsRes.json()
      if (backupsData.backups) {
        setBackups(backupsData.backups)
      }
    } catch {
      toast.error('备份失败')
    }
  }

  // 从服务器备份恢复
  const handleRestoreFromServer = async (filename: string) => {
    if (!confirm(`确定要从 ${filename} 恢复数据库吗？当前数据将被覆盖。`)) {
      return
    }

    setRestoring(true)
    try {
      const res = await fetch('/api/backup/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename })
      })
      const data = await res.json()
      
      if (data.success) {
        toast.success(data.message)
        setTimeout(() => {
          window.location.reload()
        }, 1500)
      } else {
        toast.error(data.error || '恢复失败')
      }
    } catch {
      toast.error('恢复失败')
    } finally {
      setRestoring(false)
    }
  }

  // 上传并恢复
  const handleUploadRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/backup/restore', {
        method: 'POST',
        body: formData
      })
      const data = await res.json()
      
      if (data.success) {
        toast.success(data.message)
        setTimeout(() => {
          window.location.reload()
        }, 1500)
      } else {
        toast.error(data.error || '恢复失败')
      }
    } catch {
      toast.error('恢复失败')
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  // 删除备份
  const handleDeleteBackup = async (filename: string) => {
    if (!confirm(`确定要删除备份 ${filename} 吗？`)) {
      return
    }

    try {
      const res = await fetch('/api/backup/restore', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename })
      })
      const data = await res.json()
      
      if (data.success) {
        toast.success('备份已删除')
        setBackups(prev => prev.filter(b => b.filename !== filename))
      } else {
        toast.error(data.error || '删除失败')
      }
    } catch {
      toast.error('删除失败')
    }
  }

  // 上传图标
  const handleIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingIcon(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/icon', {
        method: 'POST',
        body: formData
      })
      const data = await res.json()

      if (data.success) {
        toast.success('图标已上传')
        setSiteIcon(data.icon)
      } else {
        toast.error(data.error || '上传失败')
      }
    } catch {
      toast.error('上传失败')
    } finally {
      setUploadingIcon(false)
      if (iconInputRef.current) {
        iconInputRef.current.value = ''
      }
    }
  }

  // 删除图标
  const handleIconDelete = async () => {
    if (!confirm('确定要删除网站图标吗？')) {
      return
    }

    try {
      const res = await fetch('/api/icon', { method: 'DELETE' })
      const data = await res.json()

      if (data.success) {
        toast.success('图标已删除')
        setSiteIcon(null)
      } else {
        toast.error('删除失败')
      }
    } catch {
      toast.error('删除失败')
    }
  }

  // 自动更新相关状态
  const [updating, setUpdating] = useState(false)
  const [updateProgress, setUpdateProgress] = useState<{ step: string; status: string; message?: string }[]>([])
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // 轮询更新进度
  const pollUpdateProgress = useCallback(async () => {
    try {
      const res = await fetch('/api/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'poll' })
      })
      const data = await res.json()
      
      setUpdateProgress(data.progress || [])
      setUpdating(data.isUpdating || false)
      
      // 如果更新完成，停止轮询
      if (!data.isUpdating) {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current)
          pollIntervalRef.current = null
        }
      }
    } catch (error) {
      console.error('Poll update progress error:', error)
    }
  }, [])

  // 开始自动更新
  const handleAutoUpdate = async () => {
    if (!confirm('确定要从 GitHub 拉取最新代码并重新构建吗？更新期间服务可能会暂时不可用。')) {
      return
    }

    setUpdating(true)
    setUpdateProgress([])

    try {
      const res = await fetch('/api/update', { method: 'POST' })
      const data = await res.json()
      
      if (data.success) {
        toast.success('更新已开始')
        setUpdateProgress(data.progress || [])
        
        // 开始轮询进度
        pollIntervalRef.current = setInterval(pollUpdateProgress, 2000)
      } else if (data.isUpdating) {
        toast.info('正在更新中，请稍候...')
        setUpdateProgress(data.progress || [])
        
        // 开始轮询进度
        pollIntervalRef.current = setInterval(pollUpdateProgress, 2000)
      } else {
        toast.error(data.error || '更新失败')
        setUpdating(false)
      }
    } catch {
      toast.error('更新失败')
      setUpdating(false)
    }
  }

  // 清理轮询
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
      }
    }
  }, [])

  if (loading) {
    return <div className="text-center text-muted-foreground py-8">加载中...</div>
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <h2 className="text-2xl font-bold">系统设置</h2>

      {/* 基本设置 */}
      <Card>
        <CardHeader>
          <CardTitle>基本设置</CardTitle>
          <CardDescription>配置网站的基本信息</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>网站名称</Label>
              <Input
                value={settings.site_name}
                onChange={e => setSettings({ ...settings, site_name: e.target.value })}
                placeholder="我的博客"
              />
            </div>
            <div className="space-y-2">
              <Label>每页文章数</Label>
              <Input
                type="number"
                value={settings.posts_per_page}
                onChange={e => setSettings({ ...settings, posts_per_page: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>每页评论数</Label>
              <Input
                type="number"
                value={settings.comments_per_page}
                onChange={e => setSettings({ ...settings, comments_per_page: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>网站描述</Label>
            <Input
              value={settings.site_description}
              onChange={e => setSettings({ ...settings, site_description: e.target.value })}
              placeholder="一个简洁优雅的博客"
            />
          </div>
          <div className="space-y-2">
            <Label>网站关键词</Label>
            <Input
              value={settings.site_keywords}
              onChange={e => setSettings({ ...settings, site_keywords: e.target.value })}
              placeholder="博客,技术,分享"
            />
          </div>
          <div className="space-y-2">
            <Label>JWT Secret</Label>
            <Input
              type="password"
              value={settings.jwt_secret}
              onChange={e => setSettings({ ...settings, jwt_secret: e.target.value })}
              placeholder="留空表示使用系统自动生成的密钥"
            />
            <p className="text-xs text-muted-foreground">修改后会重新签发当前会话的 Token，其他用户需要重新登录</p>
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSaveSettings} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? '保存中...' : '保存设置'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 图标设置 */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-primary" />
            <CardTitle>网站图标</CardTitle>
          </div>
          <CardDescription>上传网站图标，自动裁切为圆形</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center">
              {siteIcon ? (
                <img src={siteIcon} alt="网站图标" className="w-full h-full object-cover" />
              ) : (
                <span className="text-3xl font-bold text-primary">
                  {settings.site_name?.charAt(0)?.toUpperCase() || 'B'}
                </span>
              )}
            </div>
            <div className="flex-1 space-y-2">
              <div className="flex gap-2">
                <Button
                  onClick={() => iconInputRef.current?.click()}
                  variant="outline"
                  disabled={uploadingIcon}
                >
                  {uploadingIcon ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4 mr-2" />
                  )}
                  {uploadingIcon ? '上传中...' : '上传图标'}
                </Button>
                {siteIcon && (
                  <Button
                    onClick={handleIconDelete}
                    variant="outline"
                    disabled={uploadingIcon}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    删除图标
                  </Button>
                )}
              </div>
              <input
                ref={iconInputRef}
                type="file"
                accept="image/*"
                onChange={handleIconUpload}
                className="hidden"
              />
              <p className="text-xs text-muted-foreground">
                支持 JPG、PNG、GIF 等格式，将自动裁切为圆形图标
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI 设置 */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <CardTitle>AI 配置</CardTitle>
          </div>
          <CardDescription>
            配置 AI 功能用于自动生成摘要和标签。如果不配置，将使用内置的 AI 服务。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-start gap-2 p-4 bg-muted rounded-lg">
            <Info className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
            <div className="text-sm text-muted-foreground">
              <p className="mb-2">AI 配置说明：</p>
              <ul className="list-disc list-inside space-y-1">
                <li>如果不填写任何配置，将使用内置的 AI 服务</li>
                <li>如需使用自定义 AI 服务，请填写完整的 API 地址、模型名称和 API Key</li>
                <li>API 地址需要包含完整路径，如：https://api.example.com/v1</li>
              </ul>
            </div>
          </div>

          <div className="space-y-2">
            <Label>API 地址</Label>
            <Input
              value={settings.ai_api_url}
              onChange={e => setSettings({ ...settings, ai_api_url: e.target.value })}
              placeholder="https://api.example.com/v1"
            />
            <p className="text-xs text-muted-foreground">OpenAI 兼容的 API 地址</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>模型名称</Label>
              <Input
                value={settings.ai_model_name}
                onChange={e => setSettings({ ...settings, ai_model_name: e.target.value })}
                placeholder="gpt-3.5-turbo"
              />
            </div>
            <div className="space-y-2">
              <Label>API Key</Label>
              <Input
                type="password"
                value={settings.ai_api_key}
                onChange={e => setSettings({ ...settings, ai_api_key: e.target.value })}
                placeholder="sk-..."
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSaveSettings} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? '保存中...' : '保存设置'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 账户设置 */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            <CardTitle>账户设置</CardTitle>
          </div>
          <CardDescription>修改用户名和密码</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>当前邮箱</Label>
              <Input value={user?.email || ''} disabled />
              <p className="text-xs text-muted-foreground">邮箱不可修改</p>
            </div>
            <div className="space-y-2">
              <Label>用户名</Label>
              <Input
                value={userForm.newName}
                onChange={e => setUserForm({ ...userForm, newName: e.target.value })}
                placeholder="用户名"
              />
            </div>
          </div>

          <div className="border-t pt-6">
            <div className="flex items-center gap-2 mb-4">
              <Key className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">修改密码</span>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>当前密码</Label>
                <Input
                  type="password"
                  value={userForm.currentPassword}
                  onChange={e => setUserForm({ ...userForm, currentPassword: e.target.value })}
                  placeholder="输入当前密码"
                />
              </div>
              <div className="space-y-2">
                <Label>新密码</Label>
                <Input
                  type="password"
                  value={userForm.newPassword}
                  onChange={e => setUserForm({ ...userForm, newPassword: e.target.value })}
                  placeholder="输入新密码"
                />
              </div>
              <div className="space-y-2">
                <Label>确认新密码</Label>
                <Input
                  type="password"
                  value={userForm.confirmPassword}
                  onChange={e => setUserForm({ ...userForm, confirmPassword: e.target.value })}
                  placeholder="再次输入新密码"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              如果只修改用户名，无需填写密码部分
            </p>
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSaveUser} disabled={savingUser}>
              <Save className="h-4 w-4 mr-2" />
              {savingUser ? '保存中...' : '保存账户信息'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 数据库备份与恢复 */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            <CardTitle>数据库管理</CardTitle>
          </div>
          <CardDescription>备份和恢复数据库</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 备份操作 */}
          <div className="flex flex-wrap gap-4">
            <Button onClick={handleBackup} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              下载备份
            </Button>
            <Button 
              onClick={() => fileInputRef.current?.click()} 
              variant="outline"
              disabled={uploading}
            >
              {uploading ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              {uploading ? '恢复中...' : '上传并恢复'}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".db,.sqlite,.sqlite3"
              onChange={handleUploadRestore}
              className="hidden"
            />
          </div>

          {/* 服务器备份列表 */}
          {backups.length > 0 && (
            <div className="space-y-3">
              <Label className="text-sm text-muted-foreground">服务器备份文件</Label>
              <div className="space-y-2">
                {backups.map(backup => (
                  <div 
                    key={backup.filename}
                    className="flex items-center justify-between p-3 bg-muted rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <Database className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">{backup.filename}</p>
                        <p className="text-xs text-muted-foreground">
                          <a 
                            href={backup.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="hover:underline"
                          >
                            下载
                          </a>
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRestoreFromServer(backup.filename)}
                        disabled={restoring}
                      >
                        {restoring ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteBackup(backup.filename)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-start gap-2 p-4 bg-muted rounded-lg">
            <Info className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
            <div className="text-sm text-muted-foreground">
              <p className="mb-2">备份说明：</p>
              <ul className="list-disc list-inside space-y-1">
                <li>点击"下载备份"会将当前数据库下载到本地</li>
                <li>点击"上传并恢复"可选择本地备份文件恢复数据库</li>
                <li>恢复数据库会覆盖当前所有数据，请谨慎操作</li>
                <li>建议在重要操作前先备份数据库</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 系统更新 */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Rocket className="h-5 w-5 text-primary" />
            <CardTitle>系统更新</CardTitle>
          </div>
          <CardDescription>从 GitHub 拉取最新代码并重新构建</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 更新按钮 */}
          <div className="flex flex-wrap gap-4">
            <Button 
              onClick={handleAutoUpdate} 
              disabled={updating}
              variant="default"
            >
              {updating ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Rocket className="h-4 w-4 mr-2" />
              )}
              {updating ? '更新中...' : '自动更新'}
            </Button>
          </div>

          {/* 更新进度 */}
          {updateProgress.length > 0 && (
            <div className="space-y-3">
              <Label className="text-sm text-muted-foreground">更新进度</Label>
              <div className="space-y-2">
                {updateProgress.map((step, index) => (
                  <div 
                    key={step.step}
                    className="flex items-center gap-3 p-3 bg-muted rounded-lg"
                  >
                    <div className="flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium shrink-0"
                      style={{
                        backgroundColor: step.status === 'success' ? 'hsl(var(--primary))' :
                          step.status === 'error' ? 'hsl(var(--destructive))' :
                            step.status === 'running' ? 'hsl(var(--primary) / 0.5)' :
                              'hsl(var(--muted-foreground) / 0.3)',
                        color: step.status === 'pending' ? 'hsl(var(--muted-foreground))' : 'hsl(var(--primary-foreground))'
                      }}
                    >
                      {step.status === 'success' ? '✓' :
                        step.status === 'error' ? '✗' :
                          step.status === 'running' ? (
                            <RefreshCw className="h-3 w-3 animate-spin" />
                          ) : index + 1}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        {step.step === 'fetch' ? '获取代码' :
                          step.step === 'build' ? '构建项目' :
                            '重启服务'}
                      </p>
                      {step.message && (
                        <p className="text-xs text-muted-foreground">{step.message}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-start gap-2 p-4 bg-muted rounded-lg">
            <Info className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
            <div className="text-sm text-muted-foreground">
              <p className="mb-2">更新说明：</p>
              <ul className="list-disc list-inside space-y-1">
                <li>点击"自动更新"将从 GitHub 拉取最新代码</li>
                <li>更新过程会自动执行 bun install、数据库迁移和构建</li>
                <li>构建完成后服务将自动重启</li>
                <li>更新期间服务可能会短暂不可用</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
