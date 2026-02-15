import pangu from 'pangu'

/**
 * 检查字符串是否全是英文字符（不含中文）
 */
function isAllEnglish(str: string): boolean {
  return !/[\u4e00-\u9fa5]/.test(str)
}

/**
 * 处理双引号转换
 * 将 "..." 转换为「...」
 * 如果引号内全是英文则跳过
 */
function convertDoubleQuotes(text: string): string {
  // 匹配双引号对，支持嵌套
  const doubleQuoteRegex = /"([^"]*)"/g
  let result = text
  let match

  // 先收集所有匹配
  const matches: Array<{ start: number; end: number; content: string }> = []
  while ((match = doubleQuoteRegex.exec(text)) !== null) {
    matches.push({
      start: match.index,
      end: match.index + match[0].length,
      content: match[1]
    })
  }

  // 从后向前替换，避免位置偏移问题
  for (let i = matches.length - 1; i >= 0; i--) {
    const m = matches[i]
    // 如果引号内全是英文，跳过
    if (isAllEnglish(m.content)) {
      continue
    }
    result = result.slice(0, m.start) + '「' + m.content + '」' + result.slice(m.end)
  }

  return result
}

/**
 * 处理单引号转换
 * 将 '...' 转换为『...』
 * 如果引号内全是英文则跳过
 */
function convertSingleQuotes(text: string): string {
  // 匹配单引号对，使用更精确的模式避免匹配缩写（如 don't）
  // 单引号内容应该包含中文或至少两个字符
  const singleQuoteRegex = /'([^']+)'/g
  let result = text
  let match

  const matches: Array<{ start: number; end: number; content: string }> = []
  while ((match = singleQuoteRegex.exec(text)) !== null) {
    matches.push({
      start: match.index,
      end: match.index + match[0].length,
      content: match[1]
    })
  }

  for (let i = matches.length - 1; i >= 0; i--) {
    const m = matches[i]
    // 如果引号内全是英文，跳过
    if (isAllEnglish(m.content)) {
      continue
    }
    result = result.slice(0, m.start) + '『' + m.content + '』' + result.slice(m.end)
  }

  return result
}

/**
 * 处理中文破折号
 * 在破折号两边各加一个空格
 * 中文破折号：——（两个全角破折号）
 */
function addSpacesAroundEmDash(text: string): string {
  // 处理中文破折号 ——
  // 在破折号前后的非空格字符之间添加空格
  return text.replace(/(\S)?——(\S)?/g, (match, before, after) => {
    const prefix = before ? before + ' ' : ''
    const suffix = after ? ' ' + after : ''
    return prefix + '——' + suffix
  })
}

/**
 * 格式化内容
 * 按顺序执行：
 * 1. pangu - 中英文之间加空格
 * 2. 双引号转换（英文内容跳过）
 * 3. 单引号转换（英文内容跳过）
 * 4. 破折号两边加空格
 */
export function formatContent(content: string): string {
  if (!content) return content

  let result = content

  // 1. pangu 处理中英文空格
  result = pangu.spacingText(result)

  // 2. 双引号转换
  result = convertDoubleQuotes(result)

  // 3. 单引号转换
  result = convertSingleQuotes(result)

  // 4. 破折号加空格
  result = addSpacesAroundEmDash(result)

  return result
}
