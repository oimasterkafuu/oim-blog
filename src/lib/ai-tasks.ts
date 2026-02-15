import { db } from '@/lib/db'
import { generateSlug } from '@/lib/slug'
import OpenAI from 'openai'

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
  
  if (parts.length === 1) {
    return {
      provider: null,
      modelName: fullModelName,
      authorName: fullModelName,
      authorUrl: null
    }
  }
  
  const modelName = parts[parts.length - 1]
  let providerKey: string | null = null
  
  if (parts[0] === 'Pro' && parts.length > 2) {
    providerKey = parts[1]
  } else {
    providerKey = parts[0]
  }
  
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

/**
 * 同时生成摘要和标签（一次 API 调用）
 */
export async function generateExcerptAndTagsAsync(postId: string, title: string, content: string) {
  try {
    const config = await getAIConfig()
    if (!config.apiUrl || !config.apiKey) return

    const openai = new OpenAI({
      baseURL: config.apiUrl,
      apiKey: config.apiKey
    })

    // 获取已有标签
    const existingTags = await db.tag.findMany({ select: { name: true } })
    const existingTagNames = existingTags.map(t => t.name)

    const tagPrompt = existingTagNames.length > 0
      ? `已有标签列表（优先复用这些标签）：${existingTagNames.join('、')}`
      : ''

    const completion = await openai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `你是一个专业的博客编辑助手。请同时完成以下两个任务：

1. 为文章生成一个简洁的摘要，不超过 150 字
2. 根据文章内容生成 3-5 个合适的标签

${tagPrompt}

请按以下 JSON 格式输出（不要包含 markdown 代码块标记）：
{
  "excerpt": "摘要内容",
  "tags": ["标签1", "标签2", "标签3"]
}`
        },
        {
          role: 'user',
          content: `文章标题：${title || '无标题'}\n\n文章内容：\n${content.slice(0, 3000)}`
        }
      ],
      model: config.modelName || 'gpt-3.5-turbo'
    })

    const result = completion.choices[0]?.message?.content || ''
    if (!result) return

    // 解析 JSON 结果
    let parsed: { excerpt?: string; tags?: string[] } = {}
    try {
      // 尝试提取 JSON 部分
      const jsonMatch = result.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0])
      }
    } catch {
      console.error('Failed to parse AI response as JSON:', result)
      return
    }

    // 更新摘要
    if (parsed.excerpt) {
      await db.post.update({
        where: { id: postId },
        data: { excerpt: parsed.excerpt }
      })
    }

    // 更新标签
    if (parsed.tags && parsed.tags.length > 0) {
      const tagIds: string[] = []
      for (const name of parsed.tags) {
        const trimmedName = name.trim()
        if (!trimmedName) continue

        let tag = await db.tag.findFirst({
          where: { name: trimmedName }
        })
        
        if (!tag) {
          const slug = generateSlug(trimmedName)
          tag = await db.tag.create({
            data: { name: trimmedName, slug }
          })
        }
        
        tagIds.push(tag.id)
      }

      if (tagIds.length > 0) {
        await db.postTag.deleteMany({ where: { postId } })
        await db.postTag.createMany({
          data: tagIds.map(tagId => ({ postId, tagId }))
        })
      }
    }
  } catch (error) {
    console.error('Generate excerpt and tags error:', error)
  }
}

/**
 * 生成 AI 评论
 */
export async function generateCommentAsync(postId: string, title: string, content: string) {
  try {
    const config = await getAIConfig()
    if (!config.apiUrl || !config.apiKey) return

    // 获取管理员用户
    const adminUser = await db.user.findFirst({
      where: { role: 'admin' },
      select: { id: true, email: true }
    })

    if (!adminUser) return

    // 检查是否已有 AI 评论
    const existingComment = await db.comment.findFirst({
      where: {
        postId,
        authorEmail: adminUser.email,
        authorUrl: { not: '/', not: null }
      }
    })

    if (existingComment) return

    const openai = new OpenAI({
      baseURL: config.apiUrl,
      apiKey: config.apiKey
    })

    const parsedModel = parseModelName(config.modelName)

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
          content: `文章标题：${title}\n\n文章内容：\n${content.slice(0, 2500)}`
        }
      ],
      model: config.modelName || 'gpt-3.5-turbo'
    })

    const commentContent = completion.choices[0]?.message?.content || ''
    if (!commentContent) return

    // 创建评论
    await db.comment.create({
      data: {
        content: commentContent,
        authorName: parsedModel.authorName,
        authorEmail: adminUser.email,
        authorUrl: parsedModel.authorUrl,
        postId,
        userId: adminUser.id,
        status: 'approved'
      }
    })
  } catch (error) {
    console.error('Generate comment error:', error)
  }
}

/**
 * 触发异步 AI 任务
 * - 摘要和标签合并为一次调用
 * - 评论独立调用
 */
export function triggerAsyncAITasks(
  postId: string,
  title: string,
  content: string,
  needExcerpt: boolean,
  needTags: boolean,
  needComment: boolean = false
) {
  const needExcerptOrTags = needExcerpt || needTags

  if (!needExcerptOrTags && !needComment) return

  ;(async () => {
    // 任务 1：同时生成摘要和标签
    if (needExcerptOrTags) {
      await generateExcerptAndTagsAsync(postId, title, content)
    }

    // 任务 2：独立生成评论
    if (needComment) {
      await generateCommentAsync(postId, title, content)
    }
  })().catch(console.error)
}