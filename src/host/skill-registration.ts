/**
 * 打包 Skill 的自注册。
 *
 * 插件随包发布 `skills/automation/SKILL.md`（规范、人工维护），宿主半区
 * 挂载时注册到 `ctx.skills`——安装插件即安装技能。本模块负责
 * SKILL.md → SkillRegistration 的转换（YAML frontmatter 解析）。
 */
import { readFile } from 'node:fs/promises'
import type { SkillRegistration } from '@deepseek-ai/dsh-skill'

/** 本包随附的技能目录（相对 src/ 或 lib/）。 */
export const BUNDLED_SKILL_DIR = '../../skills/automation'

/** 打包的 SKILL.md 的 URL（锚定到本模块：src/ 与 lib/ 同深）。 */
export const BUNDLED_SKILL_URL = new URL(`${BUNDLED_SKILL_DIR}/SKILL.md`, import.meta.url)

/** 解析结果。 */
export interface ParsedSkillFrontmatter {
  name: string
  description: string
  whenToUse?: string
  /** 结束 `---` 之后的正文（去除前导空行）。 */
  content: string
}

/**
 * 解析 SKILL.md 的 `---` frontmatter。支持普通标量与折叠 `>` / 字面 `|`
 * 块标量（`>-` / `|-` 变体）。非合法技能文件（无 frontmatter 或缺
 * name/description）返回 undefined。
 */
export function parseSkillFrontmatter(raw: string): ParsedSkillFrontmatter | undefined {
  let text = raw
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1) // 去掉 BOM
  if (!text.startsWith('---')) return undefined
  const firstLf = text.indexOf('\n')
  if (firstLf === -1) return undefined
  const rest = text.slice(firstLf + 1)
  const close = /^---[ \t]*$/m.exec(rest)
  if (close === null) return undefined
  const front = rest.slice(0, close.index)
  const content = rest.slice(close.index + close[0].length)

  const fields = new Map<string, string>()
  const lines = front.split(/\r?\n/)
  let i = 0
  while (i < lines.length) {
    const line = lines[i]!
    if (line.trim() === '' || /^\s*#/.test(line)) {
      i += 1
      continue
    }
    const match = /^([A-Za-z0-9_-]+)\s*:\s*(.*)$/.exec(line)
    if (match === null) {
      i += 1
      continue
    }
    const key = match[1]!
    let value = match[2]!.trim()
    const block = /^([>|-])(-)?$/.exec(value)
    if (block !== null) {
      const parts: string[] = []
      i += 1
      while (i < lines.length && /^[ \t]/.test(lines[i]!)) {
        parts.push(lines[i]!.replace(/^[ \t]+/, ''))
        i += 1
      }
      value = block[1] === '|' ? parts.join('\n') : parts.join(' ')
    } else {
      i += 1
    }
    fields.set(key, value)
  }

  const name = fields.get('name')
  const description = fields.get('description')
  if (name === undefined || name === '' || description === undefined || description === '') {
    return undefined
  }
  const result: ParsedSkillFrontmatter = {
    name,
    description,
    content: content.replace(/^\r?\n/, '').replace(/\s+$/, ''),
  }
  const whenToUse = fields.get('whenToUse')
  if (whenToUse !== undefined && whenToUse !== '') result.whenToUse = whenToUse
  return result
}

/**
 * 加载打包的 SKILL.md 为运行时技能注册。
 * @param fileUrl - 覆盖打包文件 URL（测试用）；默认 {@link BUNDLED_SKILL_URL}。
 * @returns 注册对象；文件缺失 / 不可读 / frontmatter 校验失败返回 undefined。
 */
export async function loadBundledSkill(fileUrl: string | URL = BUNDLED_SKILL_URL): Promise<SkillRegistration | undefined> {
  try {
    const raw = await readFile(fileUrl, 'utf8')
    const parsed = parseSkillFrontmatter(raw)
    if (parsed === undefined) return undefined
    const registration: SkillRegistration = {
      name: parsed.name,
      description: parsed.description,
      content: parsed.content,
      source: 'bundled',
      provider: 'dsh-automation',
      ...(parsed.whenToUse !== undefined ? { whenToUse: parsed.whenToUse } : {}),
    }
    return registration
  } catch {
    // 打包技能缺失/不可读：注册是便利项而非硬依赖——绝不让宿主挂载崩溃。
    return undefined
  }
}
