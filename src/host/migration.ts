import { randomUUID } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { revision, BridgeError, type ConfigEditor } from './settings.ts'
import { systemTimeZone, legacyRuleIssue, scheduleSelector, normalizeTrigger } from '../shared/time.ts'
import { isDirectAction, type AutomationService } from '../core/service.ts'
import type { SqliteAutomationStore } from '../storage/sqlite.ts'
interface SchedulePort { create(session: any, request: any): Promise<any>; delete(request: any): Promise<any>; catalog(): Promise<any[]> }
interface MigrationRecord { id: string; state: string; backup: string; configBackup: string; configurationToken: string; mappings: { id: string; sessionId: string; triggerId: string; expected: unknown }[]; afterRevision?: string; error?: string }
export function createMigrationBridge(store: SqliteAutomationStore, service: AutomationService, editor: ConfigEditor, schedule: SchedulePort, sessionController: any) {
  const prior = store.getMeta<MigrationRecord[]>('migration-records') ?? []
  if (prior.some(record => record.state === 'prepared')) store.setMeta('migration-records', prior.map(record => record.state === 'prepared' ? { ...record, state: 'recovery-required', error: '上次迁移未完成；请核对官方提醒后恢复，不重复创建。' } : record))
  const dataRevision = () => revision([store.fingerprint(), store.getMeta('migration-records')])
  const records = () => store.getMeta<MigrationRecord[]>('migration-records') ?? []
  const configurationToken = () => revision(editor.configuration().map(row => [row.entry.options.id,row.entry.options.config,row.inherited]))
  let operating = false
  async function preview() {
    let sessions: any[] = [], sessionError: string | undefined
    try { const value = await sessionController.list({}, new AbortController().signal); sessions = value.items.filter((item: any) => item.origin !== 'subagent' && !item.parentSessionId).map((item: any) => ({ id: item.sessionId, label: typeof item.projections?.title === 'string' ? item.projections.title : item.projections?.title?.text ?? item.sessionId })) } catch (error) { sessionError = String(error) }
    return { revisionToken: dataRevision(), timeZone: systemTimeZone(), tasks: store.listTasks().map(task => ({ id: task.id, name: task.name, type: task.action.type, enabled: task.enabled, action: task.action, triggers: store.listTriggers(task.id).map(trigger => ({ ...trigger, proposedTimeZone: trigger.config.time_zone ?? systemTimeZone(), issue: legacyRuleIssue(trigger.config) ?? (task.action.type !== 'command' && task.action.type !== 'script' && trigger.config.type === 'monthly' && trigger.config.day > 28 ? '官方提醒不支持月末截断，请修改规则。' : undefined) })) })), sessions, sessionError, records: records().map(record => ({ id: record.id, state: record.state, error: record.error })), running: service.busy }
  }
  function persist(record: MigrationRecord) { const all = records().filter(item => item.id !== record.id); store.setMeta('migration-records', [...all,record]) }
  function backup(): MigrationRecord {
    const file = store.backupNow?.(true)
    if (!file) throw new BridgeError('BACKUP_FAILED', '无法建立一致性备份。')
    const id = randomUUID(), configBackup = join(store.homeDir, 'backup', 'configuration.' + id + '.json')
    writeFileSync(configBackup, JSON.stringify({ documentPath: editor.documentPath, raw: readFileSync(editor.documentPath, 'utf8') }), { mode: 0o600 })
    return { id, state: 'prepared', backup: file, configBackup, configurationToken: configurationToken(), afterRevision: store.fingerprint(), mappings: [] }
  }
  async function mutate(request: any) {
    if (operating || service.busy) throw new BridgeError('TASK_BUSY', '请等待或取消直接任务后迁移。', 409)
    if (request?.expectedRevisionToken !== dataRevision()) throw new BridgeError('MIGRATION_CONFLICT', '数据已变化，请重新预览。', 409)
    if (!['apply','restore'].includes(request.operation)) throw new BridgeError('INVALID_INPUT', '非法迁移操作。')
    operating = true
    await service.quiesce()
    let record: MigrationRecord | undefined
    try {
      if (request.operation === 'restore') {
        const saved = records().find(item => item.id === request.migration_id)
        if (!saved || !['applied','recovery-required','failed'].includes(saved.state)) throw new BridgeError('RESTORE_UNAVAILABLE', '没有可恢复的迁移记录。')
        if (saved.afterRevision && saved.afterRevision !== store.fingerprint()) throw new BridgeError('RESTORE_CONFLICT', '迁移后数据已被修改，拒绝覆盖。', 409)
        if (saved.configurationToken !== configurationToken()) throw new BridgeError('RESTORE_CONFLICT', '配置已变化，拒绝恢复旧配置。', 409)
        const catalog = await schedule.catalog()
        for (const mapping of saved.mappings) {
          const current = catalog.find(item => item.id === mapping.id)
          if (!current || current.lastDelivery || current.status !== 'active') throw new BridgeError('RESTORE_CONFLICT', '官方提醒已删除或投递；拒绝覆盖后续操作。', 409)
          if (current && revision(Object.fromEntries(Object.entries(current).filter(([key]) => !['lastDelivery','status','sessionId'].includes(key)))) !== revision(mapping.expected)) throw new BridgeError('RESTORE_CONFLICT', '官方提醒已被修改或投递，拒绝删除。', 409)
        }
        for (const mapping of [...saved.mappings]) {
          await schedule.delete({ sessionId: mapping.sessionId, id: mapping.id })
          saved.mappings = saved.mappings.filter(item => item.id !== mapping.id)
          saved.state = 'recovery-required'; persist(saved)
        }
        store.restoreSnapshot?.(saved.backup)
        saved.state = 'restored'; saved.afterRevision = undefined; persist(saved)
        return preview()
      }
      const task = request.task_id ? store.getTask(request.task_id) : undefined
      if (request.task_id && !task) throw new BridgeError('TASK_NOT_FOUND', '任务不存在。')
      if (task && !isDirectAction(task.action)) {
        const choices = (await preview()).sessions
        if (!choices.some(item => item.id === request.session_id)) throw new BridgeError('INVALID_SESSION', '请选择可用的原会话。')
        const migrated = store.getMeta('mapped:' + task.id)
        if (migrated) throw new BridgeError('ALREADY_MIGRATED', '任务已迁移，不能重复创建提醒。', 409)
        const enabled = store.listTriggers(task.id).filter(trigger => trigger.enabled)
        if (!enabled.length) throw new BridgeError('INVALID_TRIGGER', '没有可迁移的启用触发器。')
        const targets = enabled.map(trigger => { const issue = legacyRuleIssue(trigger.config); if (issue) throw new BridgeError('RULE_REVIEW_REQUIRED', issue); return { trigger, selector: scheduleSelector(trigger.config) } })
        const prompt = task.action.type === 'skill' ? `请使用会话中可用的 ${task.action.skill} Skill 完成任务。${task.action.prompt ?? ''}` : task.action.type === 'agent_prompt' ? task.action.prompt : ''
        if (!prompt.trim() || task.name.trim().length > 120) throw new BridgeError('INVALID_INPUT', '任务标题或指令不符合官方限制。')
        record = backup(); persist(record)
        for (const target of targets) {
          const created = await schedule.create(request.session_id, { title: task.name.trim(), prompt, ...target.selector })
          record.mappings.push({ id: created.id, sessionId: request.session_id, triggerId: target.trigger.id, expected: created }); persist(record)
        }
        store.transaction?.(() => { store.updateTask(task.id, { enabled: false }); store.setMeta('mapped:' + task.id, record!.mappings) })
      } else {
        const triggers = store.listTriggers().filter(trigger => !task || trigger.task_id === task.id)
        const selected = triggers.filter(trigger => { const t = store.getTask(trigger.task_id); return t && isDirectAction(t.action) })
        const issue = selected.map(trigger => legacyRuleIssue(trigger.config)).find(Boolean)
        if (issue) throw new BridgeError('RULE_REVIEW_REQUIRED', issue)
        record = backup(); persist(record)
        store.transaction?.(() => {
          for (const trigger of selected) {
            const config = { ...trigger.config, time_zone: trigger.config.time_zone ?? systemTimeZone() }
            normalizeTrigger(config); store.updateTrigger(trigger.id, { config })
          }
        })
      }
      record.state = 'applied'
      record.afterRevision = store.fingerprint()
      persist(record)
      return preview()
    } catch (error) {
      if (record) {
        let recoveryFailed = false
        const remaining: MigrationRecord['mappings'] = []
        for (const mapping of record.mappings) { try { await schedule.delete({ sessionId: mapping.sessionId, id: mapping.id }) } catch { recoveryFailed = true; remaining.push(mapping) } }
        record.mappings = remaining
        if (!recoveryFailed) { try { store.restoreSnapshot?.(record.backup) } catch { recoveryFailed = true } }
        record.state = recoveryFailed ? 'recovery-required' : 'failed'; record.error = error instanceof Error ? error.message : String(error); record.afterRevision = store.fingerprint(); persist(record)
      }
      throw error
    } finally { operating = false; service.resume() }
  }
  return { preview, mutate }
}
