'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useBlog } from './blog-provider'
import { toast } from 'sonner'
import { LogIn } from 'lucide-react'

export function AdminLogin() {
  const { setUser } = useBlog()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [needInit, setNeedInit] = useState(false)
  const [initLoading, setInitLoading] = useState(false)
  const [checkingInit, setCheckingInit] = useState(true)

  useEffect(() => {
    const checkInitStatus = async () => {
      try {
        const res = await fetch('/api/init/status')
        const data = await res.json()
        setNeedInit(!data.initialized)
      } catch {
        setNeedInit(false)
      } finally {
        setCheckingInit(false)
      }
    }
    checkInitStatus()
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login: email, password })
      })
      const data = await res.json()

      if (data.success) {
        setUser(data.user)
        toast.success('登录成功')
        router.push('/admin/dashboard')
      } else {
        toast.error(data.error || '登录失败')
      }
    } catch {
      toast.error('登录失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  const handleInit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password || !username) {
      toast.error('请填写所有字段')
      return
    }

    setInitLoading(true)
    try {
      const res = await fetch('/api/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name: username })
      })
      const data = await res.json()

      if (data.success) {
        toast.success('初始化完成！')
        setUser(data.user)
        router.push('/admin/dashboard')
      } else {
        toast.error(data.error || '初始化失败')
      }
    } catch {
      toast.error('初始化失败')
    } finally {
      setInitLoading(false)
    }
  }

  if (checkingInit) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">博客管理后台</CardTitle>
            <CardDescription>正在检查系统状态...</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  if (needInit) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">系统初始化</CardTitle>
            <CardDescription>创建管理员账号</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleInit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">用户名</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="admin"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">邮箱</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@blog.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">密码</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={initLoading}>
                {initLoading ? '初始化中...' : '初始化系统'}
              </Button>
            </form>

            <div className="mt-4 text-center">
              <Button
                variant="link"
                className="text-muted-foreground"
                onClick={() => router.push('/')}
              >
                返回前台
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">博客管理后台</CardTitle>
          <CardDescription>请登录以管理您的博客</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">用户名 / 邮箱</Label>
              <Input
                id="email"
                type="text"
                placeholder="用户名或邮箱"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? '登录中...' : (
                <>
                  <LogIn className="h-4 w-4 mr-2" />
                  登录
                </>
              )}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <Button
              variant="link"
              className="text-muted-foreground"
              onClick={() => router.push('/')}
            >
              返回前台
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
