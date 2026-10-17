import { createHash } from 'node:crypto'
import { existsSync, statSync } from 'node:fs'
import { SETTINGS_FIELDS, type SettingsOwner, type OwnerSettings } from '../shared/settings.ts'
import { describePresetTime, hasGlobalTimeOwner, savePresetTime } from './preset-time-settings.ts'
export const OWNER_PACKAGES: Record<SettingsOwner, string> = {
  'time-context': '@deepseek-ai/dsh-time-context', schedule: '@deepseek-ai/dsh-schedule', automation: 'dsh-automation',
}
export interface ConfigRow {
  entry: { options: { name: string; id: string; config?: Record<string, unknown>; disabled?: boolean }; fiber?: { config?: unknown; runtime?: { Config?: unknown } }; parent?: { tree?: { ctx?: { baseUrl?: string } } } }
  inherited: Record<string, unknown>; override: Record<string, unknown>
}
export interface ConfigEditor {
  documentPath: string
  configuration(): ConfigRow[]
  edit(entry: ConfigRow['entry'], change: (current: Record<string, unknown>, inherited: Record<string, unknown>) => Record<string, unknown>): Promise<void>
}
export function revision(value: unknown): string { return createHash('sha256').update(JSON.stringify(value)).digest('hex') }
export function unpack(value: unknown): any {
  if (value && typeof (value as any).get === 'function') return unpack((value as any).get())
  if (Array.isArray(value)) return value.map(unpack)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key,item]) => [key,unpack(item)]))
  return value
}
export class BridgeError extends Error { constructor(readonly code: string, message: string, readonly status = 400) { super(message) } }
export function ownerRow(editor: ConfigEditor, owner: SettingsOwner): ConfigRow {
  const rows = editor.configuration().filter(row => row.entry.options.name === OWNER_PACKAGES[owner] && !row.entry.options.disabled)
  if (rows.length !== 1) throw new BridgeError('OWNER_UNAVAILABLE', '配置所有者未启用或实例不唯一。', 409)
  return rows[0]!
}
function project(value: Record<string, unknown>, owner: SettingsOwner): Record<string, unknown> {
  return Object.fromEntries(SETTINGS_FIELDS[owner].filter(field => Object.hasOwn(value, field.path)).map(field => [field.path, value[field.path]]))
}
export function createSettingsBridge(editor: ConfigEditor, busy: () => boolean) {
  const describe = (): OwnerSettings[] => (Object.keys(OWNER_PACKAGES) as SettingsOwner[]).map(owner => {
    try {
      if (owner === 'time-context' && !hasGlobalTimeOwner(editor)) return describePresetTime(editor)
      const row = ownerRow(editor, owner)
      const effective = unpack(row.entry.fiber?.config ?? { ...row.inherited, ...row.override })
      return { owner, entryId: row.entry.options.id, effective: project(effective ?? {}, owner), user: project(row.override, owner), base: project(row.inherited, owner), fields: SETTINGS_FIELDS[owner], writable: !!row.entry.fiber?.runtime?.Config, revisionToken: revision([row.entry.options.config ?? {}, row.inherited]), applies: owner === 'automation' ? '服务重载后；执行中禁止保存' : '官方条目重载后' }
    } catch (error) { return { owner, entryId: '', effective: {}, user: {}, base: {}, fields: SETTINGS_FIELDS[owner], writable: false, revisionToken: '', applies: '不可用', unavailableReason: String(error instanceof Error ? error.message : error) } }
  })
  return {
    describe,
    async save(request: any): Promise<OwnerSettings[]> {
      if (!request || !Object.hasOwn(OWNER_PACKAGES, request.owner)) throw new BridgeError('INVALID_OWNER', '非法配置所有者。')
      const owner = request.owner as SettingsOwner
      if (owner === 'time-context' && !hasGlobalTimeOwner(editor)) { await savePresetTime(editor, request); return describe() }
      if (owner !== 'time-context' && busy()) throw new BridgeError('TASK_BUSY', '请等待或取消正在运行的直接任务后保存。', 409)
      const row = ownerRow(editor, owner)
      if (!row.entry.fiber?.runtime?.Config) throw new BridgeError('OWNER_UNAVAILABLE', '配置所有者未加载。', 409)
      if (row.entry.options.id !== request.entryId) throw new BridgeError('CONFIG_CONFLICT', '配置条目已变化，请核对后重试。', 409)
      if (!Array.isArray(request.operations) || request.operations.length > 8) throw new BridgeError('INVALID_INPUT', '配置修改必须是字段操作列表。')
      await editor.edit(row.entry, (current, inherited) => {
        if (owner === 'automation' && busy()) throw new BridgeError('TASK_BUSY', '直接任务正在运行。', 409)
        if (revision([current, inherited]) !== request.expectedRevisionToken) throw new BridgeError('CONFIG_CONFLICT', '配置已被其他操作修改；草稿已保留，请重新核对。', 409)
        const next = structuredClone(current)
        for (const operation of request.operations) {
          const field = SETTINGS_FIELDS[owner].find(field => field.path === operation.path)
          if (!field || !['set','unset'].includes(operation.op)) throw new BridgeError('INVALID_FIELD', '不能修改未列出的配置字段。')
          if (operation.op === 'unset') { delete next[field.path]; continue }
          const value = operation.value
          if (field.type === 'string') {
            if (typeof value !== 'string') throw new BridgeError('INVALID_VALUE', '配置必须是文本。')
            if (field.path === 'timeZone' && value.trim()) { try { new Intl.DateTimeFormat('en-US', { timeZone: value }) } catch { throw new BridgeError('INVALID_VALUE', '请输入有效IANA时区。') } }
            if (field.path === 'dataDir' && (value.includes('\0') || (value && existsSync(value) && !statSync(value).isDirectory()))) throw new BridgeError('INVALID_VALUE', '数据目录须为有效目录路径，不能是已有文件。')
            if (field.path === 'timeZone' && !value.trim()) { delete next[field.path]; continue }
          } else if (!Number.isSafeInteger(value) || value < (field.min ?? 0) || value > (field.max ?? Number.MAX_SAFE_INTEGER)) throw new BridgeError('INVALID_VALUE', '配置数字超出合法整数范围。')
          next[field.path] = value
        }
        return next
      })
      return describe()
    },
  }
}
