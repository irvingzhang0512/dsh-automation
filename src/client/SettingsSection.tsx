import { createElement as h, useEffect, useState } from 'react'
import { api } from './api.ts'
import { emptyDraftState, receiveOwners, editDraft, draftOperations } from './settings-state.ts'
import type { SettingsOwner } from '../shared/settings.ts'
declare const require: (name: string) => any
const { Button, Tooltip, SegmentedTabs } = require('@deepseek-ai/dsh-client-ui-primitives')
const ownerLabels: Record<SettingsOwner,string> = { 'time-context': '时间感知', schedule: '任务调度', automation: 'Automation 配置' }
export function SettingsSection({ onOpen }: { onOpen: () => void }) {
  const [state,setState] = useState(emptyDraftState)
  const [tab,setTab] = useState('official')
  const [messages,setMessages] = useState<Partial<Record<SettingsOwner,string>>>({})
  const [saving,setSaving] = useState<Partial<Record<SettingsOwner,boolean>>>({})
  const [problem,setProblem] = useState('')
  useEffect(() => { let alive = true; void api.settings().then(value => { if (alive) { setState(previous => receiveOwners(previous,value.owners)); if (!value.compatibility?.matched) setProblem(value.compatibility?.reasons?.join('；') ?? '') } }).catch(error => { if (alive) setProblem(error.message) }); return () => { alive = false } }, [])
  async function save(owner: SettingsOwner) {
    const snapshot = state.owners[owner]!
    setSaving(previous => ({ ...previous, [owner]: true }))
    setMessages(previous => ({ ...previous, [owner]: '正在保存此分区…' }))
    try {
      const result = await api.saveSettings({ owner, entryId: snapshot.entryId, expectedRevisionToken: snapshot.revisionToken, operations: draftOperations(state,owner) })
      setState(previous => receiveOwners(previous,result.owners,owner))
      setMessages(previous => ({ ...previous, [owner]: '已保存；' + snapshot.applies }))
    } catch (error) { setMessages(previous => ({ ...previous, [owner]: (error as Error).message })) }
    finally { setSaving(previous => ({ ...previous, [owner]: false })) }
  }
  const renderOwner = (owner: SettingsOwner) => {
    const snapshot = state.owners[owner]
    if (!snapshot) return h('p',{ key: owner },'正在读取' + ownerLabels[owner] + '…')
    return h('section',{ key: owner, className: 'da-settings-owner', 'data-owner': owner },
      h('h3',null,ownerLabels[owner]),
      !snapshot.writable && h('p',{ role: 'status' },snapshot.unavailableReason ?? '配置所有者不可用，请启用对应插件。'),
      snapshot.fields.map(field => {
        const value = state.drafts[owner]?.[field.path] ?? field.default
        const id = 'automation-setting-' + owner + '-' + field.path
        const expression = value && typeof value === 'object'
        return h('div',{ key: field.path, className: 'da-setting-row', 'data-field': field.path },
          h('label',{ htmlFor: id },field.label),
          h('div',{ className: 'da-setting-control' },
            h('input',{ id, type: field.type === 'number' ? 'number' : 'text', value: expression ? '由组装表达式提供' : String(value), min: field.min, max: field.max, step: 1, disabled: !snapshot.writable || !!saving[owner] || !!expression, onChange: (event: any) => setState(previous => editDraft(previous,owner,field.path,field.type === 'number' ? Number(event.target.value) : event.target.value)) }),
            h(Tooltip,{ label: field.help, openOnClick: true, portal: true, maxWidth: 360 },h(Button,{ type: 'button', size: 'small', 'aria-label': field.label + '帮助' },'ⓘ')),
            h(Button,{ type: 'button', size: 'small', disabled: !snapshot.writable || !!saving[owner], 'aria-label': '恢复继承：' + field.label, onClick: () => setState(previous => editDraft(previous,owner,field.path,snapshot.base[field.path] ?? field.default,true)) },'↺'),
          ),
          h('small',null,expression ? '未编辑表达式将保留。' : Object.hasOwn(snapshot.user,field.path) ? '当前为用户覆盖' : '当前继承组装值或默认值'),
        )
      }),
      h('div',{ className: 'da-settings-actions' },
        h(Button,{ type: 'button', variant: 'primary', disabled: !snapshot.writable || !!saving[owner], onClick: () => void save(owner) },!!saving[owner] ? '保存中…' : '保存' + ownerLabels[owner]),
        h(Button,{ type: 'button', disabled: !!saving[owner], onClick: () => { if (window.confirm('放弃这个分区的未保存修改？')) void api.settings().then(value => setState(previous => receiveOwners(previous,value.owners,owner))).catch(error => setMessages(previous => ({ ...previous, [owner]: error.message }))) } },'放弃修改'),
      ),
      h('p',{ role: 'status', 'data-owner-message': owner },messages[owner] ?? snapshot.applies),
    )
  }
  return h('section',{ className: 'da-settings', 'data-automation-settings': true },
    h('h2',null,'自动化配置'),
    h('p',null,'官方负责会话提醒；Automation 负责无会话的命令和脚本。两区分别保存。'),
    problem && h('p',{ role: 'alert' },problem),
    h('div',{ className: 'da-settings-actions' },h(Button,{ type: 'button', onClick: onOpen },'直接执行任务')),
    h(SegmentedTabs,{ label: '自动化配置分区', items: [{ value: 'official', label: '官方配置' },{ value: 'automation', label: 'Automation 配置' }], value: tab, onChange: setTab }),
    h('div',{ hidden: tab !== 'official', 'data-settings-group': 'official' },renderOwner('time-context'),renderOwner('schedule')),
    h('div',{ hidden: tab !== 'automation', 'data-settings-group': 'automation' },renderOwner('automation')),
    h(MigrationSection),
  )
}
function MigrationSection() {
  const [preview,setPreview] = useState<any>(null), [message,setMessage] = useState(''), [busy,setBusy] = useState(false)
  const [taskId,setTaskId] = useState(''), [sessionId,setSessionId] = useState('')
  const [replacements,setReplacements] = useState<Record<string,string>>({})
  async function replaceRule(trigger: any) { try { await api.updateTrigger(trigger.id,{config:{type:'cron',expr:replacements[trigger.id] ?? '',time_zone:trigger.proposedTimeZone},enabled:true}); await inspect() } catch(error) { setMessage((error as Error).message) } }
  async function inspect() { try { setPreview(await api.migration()); setMessage('只读预览；应用前会备份，恢复遇到后续修改会拒绝覆盖。') } catch (error) { setMessage((error as Error).message) } }
  async function apply(operation: string, migration_id?: string) {
    setBusy(true)
    try { setPreview(await api.mutateMigration({ operation, migration_id, expectedRevisionToken: preview.revisionToken, ...(taskId && operation === 'apply' ? { task_id: taskId, session_id: sessionId } : {}) })); setMessage('操作完成。') } catch (error) { setMessage((error as Error).message) }
    finally { setBusy(false) }
  }
  return h('section',{ className: 'da-settings-owner', 'data-automation-migration': true },
    h('h3',null,'旧任务迁移'),h(Button,{ type: 'button', disabled: busy, onClick: () => void inspect() },'预览旧任务'),
    preview && h('div',null,
      h('p',null,'缺少时区的规则拟采用：' + preview.timeZone + '；运行中不能应用迁移。'),
      preview.tasks.map((task: any) => h('div',{ key: task.id },h('strong',null,task.name),h('p',null,task.type === 'command' || task.type === 'script' ? '直接任务：保留ID、启用状态和历史。' : '旧模型任务已暂停，迁移后使用官方原会话。'),h('pre',{className:'da-migration-rule'},JSON.stringify(task.action,null,2)),task.triggers.map((trigger: any) => h('div',{ key: trigger.id },h('pre',{className:'da-migration-rule'},JSON.stringify(trigger.config,null,2)),h('p',null,(trigger.issue ?? '规则可迁移') + ' · 时区 ' + trigger.proposedTimeZone),trigger.issue && h('div',null,h('label',null,'明确选择新的官方Cron规则（日期不存在时跳过） ',h('input',{value:replacements[trigger.id] ?? '',placeholder:'例如 0 9 1 * *',onChange:(event:any)=>setReplacements(previous=>({...previous,[trigger.id]:event.target.value}))})),h(Button,{type:'button',disabled:busy,onClick:()=>void replaceRule(trigger)},'保存并启用替代规则')))))),
      h('label',null,'迁移对象 ',h('select',{ value: taskId, onChange: (event: any) => setTaskId(event.target.value) },h('option',{ value: '' },'全部直接任务（只固定时区）'),preview.tasks.map((task: any) => h('option',{ key: task.id, value: task.id },task.name)))),
      h('label',null,' 目标原会话 ',h('select',{ value: sessionId, onChange: (event: any) => setSessionId(event.target.value) },h('option',{ value: '' },'模型任务迁移时选择'),preview.sessions.map((session: any) => h('option',{ key: session.id, value: session.id },session.label)))),
      preview.sessionError && h('p',{ role: 'alert' },'会话列表不可用，模型任务迁移已禁用。'),
      h('div',{ className: 'da-settings-actions' },h(Button,{ type: 'button', disabled: busy || preview.running, onClick: () => void apply('apply') },'应用已预览的迁移')),
      preview.records.map((record: any) => h('div',{ key: record.id },h('span',null,record.id + ' · ' + record.state),['applied','failed','recovery-required'].includes(record.state) && h(Button,{ type: 'button', disabled: busy, onClick: () => void apply('restore',record.id) },'恢复迁移前数据'))),
    ),h('p',{ role: 'status' },message),
  )
}
