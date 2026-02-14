#!/bin/bash

# 自动更新脚本
# 此脚本在主程序退出后执行，避免环境冲突

# 启用 pipefail 以正确检测管道命令的失败
set -o pipefail

# 清除从父进程继承的环境变量，避免干扰构建
# 保留必要的环境变量
unset NODE_OPTIONS
unset NODE_PATH
unset __NEXT_PREBUNDLED_REACT
unset NEXT_PRIVATE_STANDALONE_CONFIG

# 重置 PATH 确保使用系统默认
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/root/.bun/bin"

# 获取脚本所在目录（项目根目录）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && cd .. && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"
LOG_FILE="$PROJECT_ROOT/update.log"
FLAG_FILE="$PROJECT_ROOT/.updating"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

cleanup() {
    rm -f "$FLAG_FILE"
}

trap cleanup EXIT

log "========================================="
log "开始自动更新流程"
log "========================================="

cd "$PROJECT_ROOT"

# 步骤 1: 获取最新代码并强制重置
log "步骤 1: 获取最新代码..."

git fetch origin main 2>&1 | tee -a "$LOG_FILE"

LOCAL_COMMIT=$(git rev-parse HEAD)
REMOTE_COMMIT=$(git rev-parse origin/main)

log "本地: $LOCAL_COMMIT"
log "远程: $REMOTE_COMMIT"

# 无论是否最新，都强制重置到远程版本
git reset --hard origin/main 2>&1 | tee -a "$LOG_FILE"

log "代码已同步到最新版本"

# 步骤 2: 安装依赖（使用 package.json 锁定的版本）
log "步骤 2: 安装依赖..."

if ! bun install 2>&1 | tee -a "$LOG_FILE"; then
    log "错误: 安装依赖失败"
    exit 1
fi

# 步骤 3: 清理旧构建和 Prisma 缓存
log "步骤 3: 清理旧构建..."

rm -rf .next node_modules/.cache node_modules/.prisma

# 步骤 4: 生成 Prisma 客户端（不重新安装，使用已安装的版本）
log "步骤 4: 生成 Prisma 客户端..."

if ! bunx prisma generate 2>&1 | tee -a "$LOG_FILE"; then
    log "错误: Prisma 客户端生成失败"
    exit 1
fi

# 步骤 5: 构建项目
log "步骤 5: 构建项目..."

if bun run build 2>&1 | tee -a "$LOG_FILE"; then
    log "构建成功"
else
    log "错误: 构建失败，请检查日志"
    log "========================================="
    exit 1
fi

# 步骤 6: 数据库迁移
log "步骤 6: 数据库迁移..."

if [ -d "prisma/migrations" ]; then
    bunx prisma migrate deploy 2>&1 | tee -a "$LOG_FILE" || log "警告: 数据库迁移可能失败"
fi

# 步骤 7: 重启服务
log "步骤 7: 重启服务..."

# 强制杀死所有占用端口 3000 的进程
log "释放端口 3000..."
fuser -k 3000/tcp 2>/dev/null || true
pkill -f "node.*server.js" 2>/dev/null || true
pkill -f "bun.*server.js" 2>/dev/null || true

# 等待端口完全释放
sleep 3

# 再次检查端口是否已释放
if lsof -i:3000 >/dev/null 2>&1; then
    log "警告: 端口 3000 仍被占用，强制终止..."
    lsof -ti:3000 | xargs kill -9 2>/dev/null || true
    sleep 2
fi

# 启动新进程
log "启动服务..."
bun start >> "$LOG_FILE" 2>&1 &

log "========================================="
log "更新完成！"
log "========================================="
