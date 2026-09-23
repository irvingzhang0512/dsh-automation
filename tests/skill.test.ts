import { describe, expect, it } from 'vitest'
import { parseSkillFrontmatter, loadBundledSkill } from '../src/host/skill-registration.ts'

describe('parseSkillFrontmatter', () => {
  it('解析标准 frontmatter 与正文', () => {
    const raw = `---
name: automation
description: 管理定时任务
whenToUse: 用户提到定时任务时使用
---

# 正文第一行

正文内容。
`
    const parsed = parseSkillFrontmatter(raw)
    expect(parsed?.name).toBe('automation')
    expect(parsed?.description).toBe('管理定时任务')
    expect(parsed?.whenToUse).toBe('用户提到定时任务时使用')
    expect(parsed?.content).toContain('# 正文第一行')
  })

  it('支持折叠块标量（>-）与字面块标量（|）', () => {
    const raw = `---
name: test
description: >-
  折叠的第一行
  第二行合并
---

正文
`
    const parsed = parseSkillFrontmatter(raw)
    expect(parsed?.description).toBe('折叠的第一行 第二行合并')
  })

  it('缺 name / description 返回 undefined', () => {
    expect(parseSkillFrontmatter('---\nfoo: bar\n---\n正文')).toBeUndefined()
    expect(parseSkillFrontmatter('---\nname: x\n---\n正文')).toBeUndefined()
  })

  it('无 frontmatter 返回 undefined', () => {
    expect(parseSkillFrontmatter('# 纯正文')).toBeUndefined()
  })

  it('处理 BOM 前缀', () => {
    const raw = `${String.fromCharCode(0xFEFF)}---\nname: a\ndescription: d\n---\n正文`
    expect(parseSkillFrontmatter(raw)?.name).toBe('a')
  })
})

describe('loadBundledSkill', () => {
  it('加载随包 SKILL.md 并返回注册对象', async () => {
    const skill = await loadBundledSkill()
    expect(skill).toBeDefined()
    expect(skill?.name).toBe('automation')
    expect(skill?.source).toBe('bundled')
    expect(skill?.content.length).toBeGreaterThan(100)
  })

  it('文件缺失返回 undefined（不抛异常）', async () => {
    const skill = await loadBundledSkill(new URL('../../skills/nonexistent/SKILL.md', import.meta.url))
    expect(skill).toBeUndefined()
  })
})
