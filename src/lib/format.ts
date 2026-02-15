import pangu from 'pangu'

/**
 * 检查字符串是否全是英文字符（不含中文）
 */
function isAllEnglish(str: string): boolean {
  return !/[\u4e00-\u9fa5]/.test(str)
}

/**
 * 引号类型定义
 */
interface QuotePair {
  open: string
  close: string
  name: string
}

// 双引号类型列表（优先级从高到低）
// 使用 Unicode 码点表示引号，避免编码问题
const doubleQuotePairs: QuotePair[] = [
  { open: '\u201c', close: '\u201d', name: '弯双引号' },  // " " (中文/英文弯引号)
  { open: '"', close: '"', name: '直双引号' },            // " (ASCII 34)
]

// 单引号类型列表（优先级从高到低）
const singleQuotePairs: QuotePair[] = [
  { open: '\u2018', close: '\u2019', name: '弯单引号' },  // ' ' (中文/英文弯引号)
  { open: "'", close: "'", name: '直单引号' },            // ' (ASCII 39)
]

/**
 * 通用的引号转换函数
 * 支持多种引号类型，正确匹配左右引号
 */
function convertQuotes(
  text: string,
  quotePairs: QuotePair[],
  targetOpen: string,
  targetClose: string
): string {
  let result = text

  // 按优先级处理每种引号类型
  for (const quotePair of quotePairs) {
    // 跳过与目标相同的引号类型
    if (quotePair.open === targetOpen && quotePair.close === targetClose) {
      continue
    }

    // 使用栈来匹配引号，支持嵌套
    const openChar = quotePair.open
    const closeChar = quotePair.close

    // 对于直引号，需要特殊处理（同一个字符既作左引号又作右引号）
    if (openChar === closeChar) {
      result = convertStraightQuotes(result, openChar, targetOpen, targetClose)
    } else {
      result = convertPairedQuotes(result, openChar, closeChar, targetOpen, targetClose)
    }
  }

  return result
}

/**
 * 处理成对引号（左右不同的引号，如 "" ''）
 */
function convertPairedQuotes(
  text: string,
  openChar: string,
  closeChar: string,
  targetOpen: string,
  targetClose: string
): string {
  const result: string[] = []
  let i = 0

  while (i < text.length) {
    if (text[i] === openChar) {
      // 找到对应的闭合引号
      let depth = 1
      let j = i + 1
      let found = false

      while (j < text.length && depth > 0) {
        if (text[j] === openChar) {
          depth++
        } else if (text[j] === closeChar) {
          depth--
          if (depth === 0) {
            found = true
            break
          }
        }
        j++
      }

      if (found) {
        const content = text.slice(i + 1, j)
        // 如果内容全是英文，保持原样
        if (isAllEnglish(content)) {
          result.push(openChar, content, closeChar)
        } else {
          result.push(targetOpen, content, targetClose)
        }
        i = j + 1
        continue
      }
    }
    result.push(text[i])
    i++
  }

  return result.join('')
}

/**
 * 检查直引号是否是英文缩写（如 don't, it's）
 * 通过检查引号前后的字符来判断
 */
function isEnglishContraction(text: string, quoteIndex: number): boolean {
  const prevChar = quoteIndex > 0 ? text[quoteIndex - 1] : ''
  const nextChar = quoteIndex < text.length - 1 ? text[quoteIndex + 1] : ''

  // 如果前后都是英文字母，很可能是缩写
  const isEnglishLetter = (c: string) => /^[a-zA-Z]$/.test(c)

  return isEnglishLetter(prevChar) && isEnglishLetter(nextChar)
}

/**
 * 处理直引号（同一个字符既作左引号又作右引号，如 " 和 '）
 */
function convertStraightQuotes(
  text: string,
  quoteChar: string,
  targetOpen: string,
  targetClose: string
): string {
  const result: string[] = []
  let i = 0

  // 使用索引遍历，识别真正的引号对
  while (i < text.length) {
    const char = text[i]

    if (char === quoteChar) {
      // 检查是否是英文缩写
      if (isEnglishContraction(text, i)) {
        result.push(char)
        i++
        continue
      }

      // 尝试找到匹配的闭合引号
      let j = i + 1
      let foundClose = false

      while (j < text.length) {
        if (text[j] === quoteChar) {
          // 检查这个引号是否也是缩写的一部分
          if (!isEnglishContraction(text, j)) {
            foundClose = true
            break
          }
        }
        j++
      }

      if (foundClose) {
        const content = text.slice(i + 1, j)
        // 如果内容全是英文，保持原样
        if (isAllEnglish(content)) {
          result.push(quoteChar, content, quoteChar)
        } else {
          result.push(targetOpen, content, targetClose)
        }
        i = j + 1
        continue
      }
    }

    result.push(char)
    i++
  }

  return result.join('')
}

/**
 * 处理双引号转换
 * 支持中文引号、英文弯引号、直引号等
 * 统一转换为「」
 */
function convertDoubleQuotes(text: string): string {
  return convertQuotes(text, doubleQuotePairs, '「', '」')
}

/**
 * 处理单引号转换
 * 支持中文单引号、英文弯引号、直引号等
 * 统一转换为『』
 */
function convertSingleQuotes(text: string): string {
  return convertQuotes(text, singleQuotePairs, '『', '』')
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
 * 1. 双引号转换（英文内容跳过）
 * 2. 单引号转换（英文内容跳过）
 * 3. pangu - 中英文之间加空格
 * 4. 破折号两边加空格
 */
export function formatContent(content: string): string {
  if (!content) return content

  let result = content

  // 1. 双引号转换（先于 pangu 处理，避免空格干扰判断）
  result = convertDoubleQuotes(result)

  // 2. 单引号转换
  result = convertSingleQuotes(result)

  // 3. pangu 处理中英文空格
  result = pangu.spacingText(result)

  // 4. 破折号加空格
  result = addSpacesAroundEmDash(result)

  return result
}
