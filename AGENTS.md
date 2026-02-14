# AGENTS.md - 项目上下文指南

本文档为 AI 助手提供项目上下文，帮助理解代码库结构和开发规范。

## 项目概述

**oim-blog** 是一个基于 Next.js 的现代博客系统，支持文章管理、分类、标签、评论、独立页面等功能，并集成了 AI 辅助功能（自动生成摘要和标签）。

### 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Next.js | 16.x | 全栈框架 (App Router) |
| React | 19.x | 前端 UI |
| Prisma | 6.x | ORM |
| SQLite | - | 数据库 |
| Tailwind CSS | 4.x | 样式框架 |
| shadcn/ui | - | UI 组件库 |
| Bun | - | 运行时/包管理器 |
| OpenAI SDK | - | AI 功能集成 |

## 项目结构

```
blog/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── layout.tsx          # 根布局
│   │   ├── page.tsx            # 首页
│   │   ├── admin/              # 管理后台页面
│   │   │   ├── layout.tsx      # 后台布局（权限控制）
│   │   │   ├── dashboard/      # 仪表盘
│   │   │   ├── posts/          # 文章管理
│   │   │   ├── categories/     # 分类管理
│   │   │   ├── tags/           # 标签管理
│   │   │   ├── comments/       # 评论管理
│   │   │   ├── pages/          # 独立页面管理
│   │   │   ├── files/          # 文件管理
│   │   │   └── settings/       # 系统设置
│   │   ├── api/                # API 路由
│   │   │   ├── auth/           # 认证 (登录/登出/会话)
│   │   │   ├── posts/          # 文章 CRUD
│   │   │   ├── categories/     # 分类 CRUD
│   │   │   ├── tags/           # 标签 CRUD
│   │   │   ├── comments/       # 评论 CRUD
│   │   │   ├── pages/          # 独立页面 CRUD
│   │   │   ├── settings/       # 系统设置
│   │   │   ├── backup/         # 备份/恢复
│   │   │   ├── update/         # 一键更新
│   │   │   ├── upload/         # 文件上传
│   │   │   ├── ai/             # AI 生成
│   │   │   ├── init/           # 系统初始化
│   │   │   └── slug/           # Slug 生成
│   │   ├── post/[slug]/        # 文章详情页
│   │   ├── category/[slug]/    # 分类页
│   │   ├── tag/[slug]/         # 标签页
│   │   ├── page/[slug]/        # 独立页面
│   │   └── search/             # 搜索页
│   ├── components/             # React 组件
│   │   ├── admin-*.tsx         # 后台组件
│   │   ├── front-*.tsx         # 前台组件
│   │   ├── blog-provider.tsx   # 全局状态上下文
│   │   ├── markdown.tsx        # Markdown 渲染
│   │   └── ui/                 # shadcn/ui 组件
│   ├── hooks/                  # 自定义 Hooks
│   └── lib/                    # 工具库
│       ├── auth.ts             # 认证逻辑 (JWT)
│       ├── db.ts               # Prisma 客户端
│       ├── paths.ts            # 路径配置
│       ├── slug.ts             # Slug 生成
│       ├── search.ts           # 搜索逻辑
│       └── ai-tasks.ts         # AI 异步任务
├── prisma/
│   └── schema.prisma           # 数据库模型定义
├── db/                         # SQLite 数据库文件目录
├── uploads/                    # 上传文件存储目录
├── public/                     # 静态资源
└── scripts/                    # 脚本文件
```

## 数据模型

```prisma
// 核心模型关系
User ──┬──< Post >──┬── Category
       │            ├──< PostTag >── Tag
       │            └──< Comment >
       └──< Comment >

// 辅助模型
Setting  // 键值对存储系统设置
Page     // 独立页面 (如关于页面)
```

### 主要字段说明

- **Post**: `status` 字段支持 `published`/`draft`/`trash`
- **Comment**: `status` 字段支持 `approved`/`pending`/`spam`/`trash`
- **User**: `role` 字段支持 `admin`/`editor`/`author`

## 开发命令

```bash
# 开发模式
bun dev                 # 启动开发服务器 (端口 3000)

# 数据库
bun db:push             # 推送 schema 变更到数据库
bun db:generate         # 生成 Prisma 客户端
bun db:migrate          # 创建并应用迁移
bun db:reset            # 重置数据库

# 构建
bun run build           # 构建生产版本 (standalone 模式)
bun start               # 启动生产服务器

# 其他
bun lint                # ESLint 检查
bun stress-test         # 运行压力测试脚本
```

## 架构特点

### 认证系统

- 基于 JWT 的简单认证，使用 `jose` 库
- Session 存储在 HttpOnly Cookie 中，有效期 7 天
- 密码使用 SHA-256 哈希（简单实现，适合个人博客）
- 管理员首次访问 `/admin` 时会进入初始化流程

### 状态管理

- 使用 React Context (`BlogProvider`) 管理全局状态
- 包含：用户信息、系统设置、分类列表、独立页面列表
- 服务端渲染时注入初始数据，避免客户端重复请求

### AI 功能

- 发布文章时异步调用 AI 生成摘要和标签
- 支持自定义 OpenAI 兼容 API 端点
- 配置项存储在 `Setting` 表中：`ai_api_url`、`ai_api_key`、`ai_model_name`

### 一键更新

- 调用 `/api/update` 触发更新流程
- 执行 `git reset --hard origin/main` 后重新构建
- 使用独立脚本避免环境冲突
- 更新完成后自动重启服务

### 文件存储

- 上传文件存储在 `uploads/` 目录
- 通过 `/api/files/[filename]` 访问
- 数据库文件存储在 `db/data.db`

## 开发规范

### 路径别名

```typescript
import { db } from '@/lib/db'
import { Button } from '@/components/ui/button'
```

### API 响应格式

```typescript
// 成功
{ success: true, data: {...} }

// 失败
{ error: '错误信息' }
```

### 权限检查模式

```typescript
const session = await getSession()
if (!session) {
  return NextResponse.json({ error: '请先登录' }, { status: 401 })
}
```

### 组件命名约定

- `admin-*.tsx`: 后台管理组件
- `front-*.tsx`: 前台展示组件
- UI 组件放在 `components/ui/` 目录

### Git Commit 格式

使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

```
<type>: <description>
```

**常用类型：**

| 类型 | 说明 | 示例 |
|------|------|------|
| `feat` | 新功能 | `feat: add dark mode support` |
| `fix` | Bug 修复 | `fix: resolve login redirect issue` |
| `docs` | 文档更新 | `docs: update README` |
| `style` | 代码格式（不影响功能） | `style: format code with prettier` |
| `refactor` | 重构代码 | `refactor: extract auth logic to separate module` |
| `perf` | 性能优化 | `perf: optimize image loading` |
| `test` | 测试相关 | `test: add unit tests for auth` |
| `chore` | 构建/工具变动 | `chore: update dependencies` |

**示例：**

```bash
git commit -m "feat: add comment moderation feature"
git commit -m "fix: spawn update script with clean environment using env -i"
git commit -m "refactor: extract slug generation to lib/slug.ts"
```

## 部署说明

1. 项目使用 `output: "standalone"` 模式
2. 构建后需要复制 `.next/static` 和 `public` 到 `.next/standalone/`
3. 数据库和上传目录需要在项目根目录
4. 生产环境运行：`NODE_ENV=production bun .next/standalone/server.js`
