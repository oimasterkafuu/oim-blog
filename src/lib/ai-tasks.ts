import { db } from '@/lib/db'
import { generateSlug } from '@/lib/slug'
import OpenAI from 'openai'

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

export async function generateExcerptAsync(postId: string, title: string, content: string) {
  try {
    const config = await getAIConfig()
    if (!config.apiUrl || !config.apiKey) return

    const openai = new OpenAI({
      baseURL: config.apiUrl,
      apiKey: config.apiKey
    })

    const completion = await openai.chat.completions.create({
      messages: [
        {
          role: 'assistant',
          content: '你是一个专业的博客编辑。请为文章生成一个简洁的摘要，不超过150字，只输出摘要内容，不要其他解释。'
        },
        {
          role: 'user',
          content: `文章标题：${title || '无标题'}\n\n文章内容：\n${content.slice(0, 3000)}`
        }
      ],
      model: config.modelName || 'gpt-3.5-turbo'
    })

    const excerpt = completion.choices[0]?.message?.content || ''
    if (excerpt) {
      await db.post.update({
        where: { id: postId },
        data: { excerpt }
      })
    }
  } catch (error) {
    console.error('Generate excerpt error:', error)
  }
}

export async function generateTagsAsync(postId: string, title: string, content: string) {
  try {
    const config = await getAIConfig()
    if (!config.apiUrl || !config.apiKey) return

    const openai = new OpenAI({
      baseURL: config.apiUrl,
      apiKey: config.apiKey
    })

    const existingTags = await db.tag.findMany({ select: { name: true } })
    const existingTagNames = existingTags.map(t => t.name)

    const prompt = existingTagNames.length > 0
      ? `你是一个专业的博客标签生成助手。根据文章内容生成3-5个合适的标签。

已有标签列表（优先复用这些标签）：
${existingTagNames.join('、')}

请只输出标签名称，用逗号分隔，不要其他解释。如果使用了已有标签，请保持原名称不变。`
      : '你是一个专业的博客标签生成助手。根据文章内容生成3-5个合适的标签。请只输出标签名称，用逗号分隔，不要其他解释。'

    const completion = await openai.chat.completions.create({
      messages: [
        { role: 'assistant', content: prompt },
        { role: 'user', content: `文章标题：${title || '无标题'}\n\n文章内容：\n${content.slice(0, 2000)}` }
      ],
      model: config.modelName || 'gpt-3.5-turbo'
    })

    const result = completion.choices[0]?.message?.content || ''
    if (!result) return

    const tagNames = result.split(/[,，]/).map(t => t.trim()).filter(Boolean)
    if (tagNames.length === 0) return

    const tagIds: string[] = []
    for (const name of tagNames) {
      let tag = await db.tag.findFirst({
        where: { name }
      })
      
      if (!tag) {
        const slug = generateSlug(name)
        tag = await db.tag.create({
          data: { name, slug }
        })
      }
      
      tagIds.push(tag.id)
    }

    await db.postTag.deleteMany({ where: { postId } })
    await db.postTag.createMany({
      data: tagIds.map(tagId => ({ postId, tagId }))
    })
  } catch (error) {
    console.error('Generate tags error:', error)
  }
}

export function triggerAsyncAITasks(
  postId: string,
  title: string,
  content: string,
  needExcerpt: boolean,
  needTags: boolean
) {
  if (!needExcerpt && !needTags) return

  ;(async () => {
    if (needExcerpt) {
      await generateExcerptAsync(postId, title, content)
    }
    if (needTags) {
      await generateTagsAsync(postId, title, content)
    }
  })().catch(console.error)
}
