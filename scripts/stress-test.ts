import { PrismaClient } from '@prisma/client'
import { pinyin } from 'pinyin-pro'

const prisma = new PrismaClient()

async function generateSlug(text: string): Promise<string> {
  const result = pinyin(text)
  const slug = result.replace(/\s+/g, '-').toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return slug || `post-${Date.now()}`
}

async function main() {
  console.log('开始压力测试...\n')

  const adminUser = await prisma.user.findFirst()
  if (!adminUser) {
    console.error('错误: 未找到用户，请先初始化系统')
    process.exit(1)
  }

  console.log(`使用用户: ${adminUser.email}\n`)

  // 1. 创建分类
  console.log('1. 创建分类...')
  const categoryName = `压力测试分类-${Date.now()}`
  const categorySlug = await generateSlug(categoryName)
  const category = await prisma.category.create({
    data: {
      name: categoryName,
      slug: categorySlug,
      description: '这是一个压力测试创建的分类'
    }
  })
  console.log(`   分类创建成功: ${category.name} (${category.slug})\n`)

  // 2. 创建标签
  console.log('2. 创建标签...')
  const tagName = `压力测试标签-${Date.now()}`
  const tagSlug = await generateSlug(tagName)
  const tag = await prisma.tag.create({
    data: {
      name: tagName,
      slug: tagSlug
    }
  })
  console.log(`   标签创建成功: ${tag.name} (${tag.slug})\n`)

  // 3. 创建 100 篇文章
  console.log('3. 创建 100 篇文章...')
  const posts: any[] = []
  const batchSize = 10
  const totalPosts = 100

  for (let i = 0; i < totalPosts; i += batchSize) {
    const batch: Promise<any>[] = []
    for (let j = 0; j < batchSize && i + j < totalPosts; j++) {
      const index = i + j + 1
      const title = `压力测试文章 ${index} - ${new Date().toISOString()}`
      const slug = await generateSlug(title) + `-${index}`
      batch.push(
        prisma.post.create({
          data: {
            title,
            slug,
            content: `# ${title}\n\n这是一篇压力测试文章，编号: ${index}\n\n创建时间: ${new Date().toISOString()}\n\n## 内容\n\nLorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.`,
            excerpt: `这是第 ${index} 篇压力测试文章的摘要`,
            status: 'published',
            authorId: adminUser.id,
            categoryId: category.id,
            tags: {
              create: {
                tagId: tag.id
              }
            }
          }
        })
      )
    }
    const created = await Promise.all(batch)
    posts.push(...created)
    process.stdout.write(`\r   已创建 ${posts.length}/${totalPosts} 篇文章...`)
  }
  console.log(`\n   文章创建完成！共 ${posts.length} 篇\n`)

  // 4. 为第一篇文章创建 100 条评论
  console.log('4. 为第一篇文章创建 100 条评论...')
  const firstPost = posts[0]
  const comments: any[] = []
  const commentBatchSize = 20
  const totalComments = 100

  for (let i = 0; i < totalComments; i += commentBatchSize) {
    const batch: Promise<any>[] = []
    for (let j = 0; j < commentBatchSize && i + j < totalComments; j++) {
      const index = i + j + 1
      batch.push(
        prisma.comment.create({
          data: {
            content: `这是第 ${index} 条压力测试评论。\n\n评论内容: Lorem ipsum dolor sit amet, consectetur adipiscing elit.\n\n创建时间: ${new Date().toISOString()}`,
            authorName: `测试用户 ${index}`,
            authorEmail: `test-user-${index}@example.com`,
            authorUrl: `https://example.com/user/${index}`,
            postId: firstPost.id,
            status: 'approved'
          }
        })
      )
    }
    const created = await Promise.all(batch)
    comments.push(...created)
    process.stdout.write(`\r   已创建 ${comments.length}/${totalComments} 条评论...`)
  }
  console.log(`\n   评论创建完成！共 ${comments.length} 条\n`)

  // 打印统计信息
  console.log('='.repeat(50))
  console.log('压力测试完成！统计信息:')
  console.log('='.repeat(50))
  console.log(`分类 ID: ${category.id}`)
  console.log(`标签 ID: ${tag.id}`)
  console.log(`第一篇文章 ID: ${firstPost.id}`)
  console.log(`第一篇文章 Slug: ${firstPost.slug}`)
  console.log(`创建文章数: ${posts.length}`)
  console.log(`创建评论数: ${comments.length}`)
  console.log('='.repeat(50))

  // 验证分页
  console.log('\n验证分页功能...')
  const postsPage1 = await prisma.post.findMany({
    where: { categoryId: category.id },
    take: 10,
    skip: 0,
    orderBy: { createdAt: 'desc' }
  })
  console.log(`分类下文章第一页 (10条): ${postsPage1.length} 篇`)

  const commentsPage1 = await prisma.comment.findMany({
    where: { postId: firstPost.id },
    take: 20,
    skip: 0,
    orderBy: { createdAt: 'desc' }
  })
  console.log(`第一篇文章评论第一页 (20条): ${commentsPage1.length} 条`)

  const totalPostsCount = await prisma.post.count({ where: { categoryId: category.id } })
  const totalCommentsCount = await prisma.comment.count({ where: { postId: firstPost.id } })
  
  console.log(`\n分类下总文章数: ${totalPostsCount}`)
  console.log(`第一篇文章总评论数: ${totalCommentsCount}`)
  console.log('\n访问以下 URL 测试分页:')
  console.log(`- 首页: http://localhost:3000/`)
  console.log(`- 分类页面: http://localhost:3000/category/${category.slug}`)
  console.log(`- 标签页面: http://localhost:3000/tag/${tag.slug}`)
  console.log(`- 文章详情: http://localhost:3000/post/${firstPost.slug}`)
  console.log('- 后台文章管理: http://localhost:3000/admin/posts')
  console.log('- 后台评论管理: http://localhost:3000/admin/comments')
}

main()
  .catch((e) => {
    console.error('错误:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
