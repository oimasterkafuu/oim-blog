import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'

// 供应商到网站的映射词典
const PROVIDER_URL_MAP: Record<string, { name: string; url: string }> = {
  'zai-org': { name: '智谱AI', url: 'https://z.ai/' },
  'moonshotai': { name: '月之暗面', url: 'https://www.moonshot.cn/' },
  'deepseek-ai': { name: '深度求索', url: 'https://www.deepseek.com/' },
  'MiniMaxAI': { name: '稀宇科技', url: 'https://www.minimax.io/' },
  'stepfun-ai': { name: '阶跃星辰', url: 'https://www.stepfun.com/' },
  'Qwen': { name: '通义千问', url: 'https://tongyi.aliyun.com/' },
  'inclusionAI': { name: '蚂蚁百灵', url: 'https://www.antgroup.com/' },
  'baidu': { name: '百度', url: 'https://yiyan.baidu.com/' },
}

// 从模型名称解析供应商和模型名
function parseModelName(fullModelName: string): { provider: string | null; modelName: string; authorName: string; authorUrl: string | null } {
  const parts = fullModelName.split('/')
  
  // 如果没有斜杠，直接返回原名称
  if (parts.length === 1) {
    return {
      provider: null,
      modelName: fullModelName,
      authorName: fullModelName,
      authorUrl: null
    }
  }
  
  // 获取最后一部分作为模型名称
  const modelName = parts[parts.length - 1]
  
  // 查找供应商标识
  let providerKey: string | null = null
  
  // 如果第一个是 Pro，则查看第二个
  if (parts[0] === 'Pro' && parts.length > 2) {
    providerKey = parts[1]
  } else {
    providerKey = parts[0]
  }
  
  // 查找匹配的供应商信息
  const providerInfo = PROVIDER_URL_MAP[providerKey]
  
  return {
    provider: providerKey,
    modelName,
    authorName: modelName,
    authorUrl: providerInfo?.url || null
  }
}

async function getAIConfig() {
  const settings = await db.setting.findMany()
  const config: Record<string, string> = {}
  settings.forEach(s => {
    config[s.key] = s.value
  })
  return {
    apiUrl: config.ai_api_url || '',
    modelName: config.ai_model_name || '',
    apiKey: config.ai_api_key || ''
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 })
    }

    const { postId } = await request.json()

    if (!postId) {
      return NextResponse.json({ error: '缺少文章 ID' }, { status: 400 })
    }

    // 获取文章信息
    const post = await db.post.findUnique({
      where: { id: postId },
      select: { id: true, title: true, content: true, status: true }
    })

    if (!post) {
      return NextResponse.json({ error: '文章不存在' }, { status: 404 })
    }

    // 检查是否已有 AI 评论
    const existingAIComment = await db.comment.findFirst({
      where: {
        postId,
        authorEmail: session.email,
        authorName: { contains: '/' } // AI 模型名称通常包含斜杠
      }
    })

    if (existingAIComment) {
      return NextResponse.json({ error: '该文章已有 AI 评论', existingComment: existingAIComment }, { status: 400 })
    }

    const config = await getAIConfig()

    if (!config.apiUrl || !config.apiKey) {
      return NextResponse.json({ error: '请先配置 AI API' }, { status: 400 })
    }

    // 解析模型名称
    const parsedModel = parseModelName(config.modelName)

    const openai = new OpenAI({
      baseURL: config.apiUrl,
      apiKey: config.apiKey
    })

    // 生成评论
    const completion = await openai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `你是一位专业的评论家。请针对文章内容发表一条有见地的评论。

要求：
1. 评论要有针对性，指出文章的亮点或提出建设性意见
2. 语言简洁，不超过 210 字
3. 避免套话和空泛的赞美
4. 只输出评论内容，纯文本，不使用 Markdown，不要其他解释`
        },
        {
          role: 'user',
          content: `文章标题：${post.title}\n\n文章内容：\n${post.content.slice(0, 2500)}`
        }
      ],
      model: config.modelName || 'gpt-3.5-turbo'
    })

    const commentContent = completion.choices[0]?.message?.content || ''

    if (!commentContent) {
      return NextResponse.json({ error: 'AI 生成评论失败' }, { status: 500 })
    }

    // 获取管理员用户信息
    const adminUser = await db.user.findFirst({
      where: { role: 'admin' },
      select: { id: true, email: true }
    })

    if (!adminUser) {
      return NextResponse.json({ error: '找不到管理员用户' }, { status: 500 })
    }

    // 创建评论
    const comment = await db.comment.create({
      data: {
        content: commentContent,
        authorName: parsedModel.authorName,
        authorEmail: adminUser.email,
        authorUrl: parsedModel.authorUrl,
        postId,
        userId: adminUser.id,
        status: 'approved' // 自动过审
      },
      include: {
        post: { select: { id: true, title: true, slug: true } }
      }
    })

    return NextResponse.json({
      success: true,
      comment,
      provider: parsedModel.provider ? {
        name: PROVIDER_URL_MAP[parsedModel.provider]?.name || parsedModel.provider,
        url: parsedModel.authorUrl
      } : null
    })
  } catch (error) {
    console.error('AI comment generation error:', error)
    return NextResponse.json({ error: 'AI 评论生成失败，请检查配置或稍后重试' }, { status: 500 })
  }
}

// 检查文章是否有 AI 评论
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const postId = searchParams.get('postId')

    if (!postId) {
      return NextResponse.json({ error: '缺少文章 ID' }, { status: 400 })
    }

    // 获取管理员邮箱
    const adminUser = await db.user.findFirst({
      where: { role: 'admin' },
      select: { email: true }
    })

    if (!adminUser) {
      return NextResponse.json({ hasAIComment: false })
    }

    // 检查是否已有 AI 评论（管理员邮箱且包含斜杠的模型名）
    const existingAIComment = await db.comment.findFirst({
      where: {
        postId,
        authorEmail: adminUser.email,
        authorName: { contains: '/' }
      }
    })

    return NextResponse.json({
      hasAIComment: !!existingAIComment,
      comment: existingAIComment
    })
  } catch (error) {
    console.error('Check AI comment error:', error)
    return NextResponse.json({ error: '检查失败' }, { status: 500 })
  }
}
