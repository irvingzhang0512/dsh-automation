import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { ConfigEditor } from './settings.ts'
export const BUNDLE = '@deepseek-ai/dsh-experimental-schedule-bundle'
export const BASE_VERSION = '0.2.0-rc.2'
export const AUTOMATION_VERSION = BASE_VERSION + '+automation.2'
export const SCHEDULE_PACKAGES = [BUNDLE, '@deepseek-ai/dsh-schedule', '@deepseek-ai/dsh-time-context', '@deepseek-ai/dsh-client-ui-schedule']
export function compareAutomationVersions(a: string, b: string): number {
  const split = (v: string) => { const m = /^(.+)\+automation\.([1-9]\d*)$/.exec(v); if (!m || !Number.isSafeInteger(Number(m[2]))) throw Error('非法 automation 版本'); return [m[1], Number(m[2])] as const }
  const first = split(a), second = split(b)
  if (first[0] !== second[0]) throw Error('不能自动跨官方 Bundle 基线升级。')
  return Math.sign(first[1] - second[1])
}
export function compatibilityFacts(ctx: any, editor: ConfigEditor) {
  const actual: Record<string, string | undefined> = {}, reasons: string[] = []
  try {
    const enabled = JSON.parse(readFileSync(join(dirname(editor.documentPath), 'package.json'), 'utf8')).dsh?.profile?.bundles ?? []
    if (!enabled.includes(BUNDLE)) reasons.push('请启用官方自动化 Bundle。')
    const rows = editor.configuration()
    for (const name of SCHEDULE_PACKAGES) {
      const entries = rows.filter(row => row.entry.options.name === name && !row.entry.options.disabled)
      if (name !== BUNDLE && entries.length !== 1) { reasons.push(name + ' 未启用或实例不唯一'); continue }
      const base = entries[0]?.entry.parent?.tree?.ctx?.baseUrl ?? ctx.fiber?.entry?.parent?.tree.ctx.baseUrl
      actual[name] = base ? ctx.get('pluginPackages')?.packageOf(name, base)?.version : undefined
      if (actual[name] !== BASE_VERSION) reasons.push(name + ' 版本不匹配：' + (actual[name] ?? '未知'))
    }
    actual.desktop = JSON.parse(readFileSync(ctx.get('profileContext').installAnchor, 'utf8')).version
    if (actual.desktop !== BASE_VERSION) reasons.push('Desktop 版本不匹配。')
  } catch (error) { reasons.push('无法读取实际挂载来源：' + String(error)) }
  return { matched: !reasons.length, version: AUTOMATION_VERSION, target: BASE_VERSION, actual, reasons }
}
