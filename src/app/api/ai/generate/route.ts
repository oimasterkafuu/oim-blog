import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'

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

    const { type, content, title, existingTags } = await request.json()

    if (!type || !content) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 })
    }

    const config = await getAIConfig()

    if (!config.apiUrl || !config.apiKey) {
      return NextResponse.json({ error: '请先配置 AI API' }, { status: 400 })
    }

    const openai = new OpenAI({
      baseURL: config.apiUrl,
      apiKey: config.apiKey
    })

    let result: string

    if (type === 'excerpt') {
      const completion = await openai.chat.completions.create({
        messages: [
          {
            role: 'assistant',
            content: '你是一个博客的作者。为文章准备一个简洁的摘要，不超过150字，只输出摘要内容，不要其他解释。'
          },
          {
            role: 'user',
            content: `文章标题：${title || '无标题'}\n\n文章内容：\n${content.slice(0, 3000)}`
          }
        ],
        model: config.modelName || 'gpt-3.5-turbo'
      })
      result = completion.choices[0]?.message?.content || ''
    } else if (type === 'tags') {
      const existingTagsList = existingTags || []
      const prompt = existingTagsList.length > 0
        ? `你是一个专业的博客标签生成助手。根据文章内容生成3-5个合适的标签。

已有标签列表（优先复用这些标签）：
${existingTagsList.join('、')}

请只输出标签名称，用逗号分隔，不要其他解释。如果使用了已有标签，请保持原名称不变。`
        : '你是一个专业的博客标签生成助手。根据文章内容生成3-5个合适的标签。请只输出标签名称，用逗号分隔，不要其他解释。'

      const completion = await openai.chat.completions.create({
        messages: [
          {
            role: 'assistant',
            content: prompt
          },
          {
            role: 'user',
            content: `文章标题：${title || '无标题'}\n\n文章内容：\n${content.slice(0, 2000)}`
          }
        ],
        model: config.modelName || 'gpt-3.5-turbo'
      })
      result = completion.choices[0]?.message?.content || ''
    } else {
      return NextResponse.json({ error: '无效的类型' }, { status: 400 })
    }

    return NextResponse.json({ success: true, result })
  } catch (error) {
    console.error('AI generation error:', error)
    return NextResponse.json({ error: 'AI 生成失败，请检查配置或稍后重试' }, { status: 500 })
  }
}
