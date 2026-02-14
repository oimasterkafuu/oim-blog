import { NextRequest, NextResponse } from 'next/navigation'
import { refreshToken } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const cookieStore = request.cookies
    const token = cookieStore.get('session')?.value
    
    if (!token) {
      return NextResponse.json({ error: 'No session found' }, { status: 401 })
    }
    
    const refreshedToken = await refreshToken(token)
    
    if (refreshedToken) {
      // 创建响应并设置新 cookie
      const response = NextResponse.json({ 
        success: true, 
        message: 'Token refreshed' 
      })
      
      response.cookies.set('session', refreshedToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7
      })
      
      return response
    }
    
    // Token 还不需要刷新
    return NextResponse.json({ 
      success: true, 
      refreshed: false,
      message: 'Token not expired yet' 
    })
  } catch {
    return NextResponse.json({ error: 'Failed to refresh token' }, { status: 500 })
  }
}
