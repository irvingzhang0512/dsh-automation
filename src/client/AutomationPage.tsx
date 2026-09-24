/**
 * AutomationPage —— dsh-automation 主面板。
 *
 * 布局：顶部标题 + 状态条，下方四个 Tab：
 *   - 任务（列表 + 新建/编辑 Drawer + 详情抽屉）
 *   - 待运行（Upcoming）
 *   - 运行中（Running）
 *   - 历史（History + Run 详情抽屉）
 *
 * 数据全部来自 /api/automation（api.ts）。无额外运行时依赖（纯 React）。
 */
import { createElement, useEffect, useState } from 'react'
import {
  api, type HistoryWire, type RunningWire, type TaskWire, type TriggerWire, type UpcomingWire,
} from './api.ts'

/**
 * 事件类型别名：@types/react 18.3 的 createElement 只有 "input" 有专用重载，
 * 其他标签（div/select/textarea）走泛型重载，嵌套时内联回调参数推断失败
 * （TS7006）。显式标注即可（运行时不受影响）。
 */
type ChangeEvent = { target: { value: string; checked: boolean } }
type ClickEvent = { stopPropagation(): void }

/** Tab 键。 */
type TabKey = 'tasks' | 'upcoming' | 'running' | 'history'

/** 页面根组件。 */
export function AutomationPage(): ReturnType<typeof createElement> {
  return createElement(AutomationPageImpl)
}

/** 实现（hooks 不能放在条件分支内，独立组件）。 */
function AutomationPageImpl() {
  const [tab, setTab] = useState<TabKey>('tasks')
  const [refreshKey, setRefreshKey] = useState(0)
  const [status, setStatus] = useState<{ running: boolean; queued: number; active: number } | null>(null)

  useEffect(() => {
    let alive = true
    void api.status().then(s => {
      if (alive) setStatus(s.status)
    }).catch(() => {})
    const timer = window.setInterval(() => {
      void api.status().then(s => {
        if (alive) setStatus(s.status)
      }).catch(() => {})
    }, 5000)
    return () => {
      alive = false
      window.clearInterval(timer)
    }
  }, [])

  const refresh = (): void => setRefreshKey(k => k + 1)

  return createElement(
    'div',
    { className: 'da-root', style: { padding: '16px 20px', minWidth: 0 } },
    createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 } },
      createElement('div', null,
        createElement('h1', { style: { fontSize: 18, margin: 0 } }, '自动任务'),
        createElement('div', { style: { fontSize: 12, color: '#888', marginTop: 2 } },
          status === null
            ? '…'
            : `调度${status.running ? '运行中' : '已停止'} · 队列 ${status.queued} · 运行中 ${status.active}`,
        ),
      ),
      createElement('button', { onClick: refresh, style: buttonStyle }, '刷新'),
    ),
    createElement('div', { style: { display: 'flex', gap: 8, borderBottom: '1px solid #e5e5e5', paddingBottom: 8 } },
      tabs.map(t => createElement('button', {
        key: t.key,
        onClick: () => setTab(t.key),
        style: tabStyle(t.key === tab),
      }, t.label)),
    ),
    createElement('div', { style: { flex: 1, minHeight: 0 } },
      tab === 'tasks' && createElement(TasksTab, { refreshKey, onChanged: refresh }),
      tab === 'upcoming' && createElement(UpcomingTab, { refreshKey, onChanged: refresh }),
      tab === 'running' && createElement(RunningTab, { refreshKey, onChanged: refresh }),
      tab === 'history' && createElement(HistoryTab, { refreshKey, onChanged: refresh }),
    ),
  )
}

const tabs: { key: TabKey; label: string }[] = [
  { key: 'tasks', label: '任务' },
  { key: 'upcoming', label: '待运行' },
  { key: 'running', label: '运行中' },
  { key: 'history', label: '历史' },
]

/* ---------------- 样式 ---------------- */

const buttonStyle: React.CSSProperties = {
  padding: '6px 12px', border: '1px solid #d0d0d0', borderRadius: 6, background: '#fff',
  cursor: 'pointer', fontSize: 13,
}

function tabStyle(active: boolean): React.CSSProperties {
  return {
    padding: '6px 14px', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13,
    background: active ? '#e8f0fe' : 'transparent', color: active ? '#1a56db' : '#555',
    fontWeight: active ? 600 : 400,
  }
}

const dangerButtonStyle: React.CSSProperties = { ...buttonStyle, color: '#c0392b', borderColor: '#e0b4b0' }

const smallButtonStyle: React.CSSProperties = { ...buttonStyle, padding: '3px 8px', fontSize: 12 }

/* ---------------- 任务 Tab ---------------- */

function TasksTab(props: { refreshKey: number; onChanged: () => void }) {
  const [tasks, setTasks] = useState<TaskWire[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [drawer, setDrawer] = useState<{ mode: 'create' } | { mode: 'edit'; task: TaskWire } | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setTasks(null)
    void api.listTasks().then(r => {
      if (alive) setTasks(r.tasks)
    }).catch(e => {
      if (alive) setError(e instanceof Error ? e.message : String(e))
    })
    return () => { alive = false }
  }, [props.refreshKey])

  return createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 10 } },
    createElement('div', { style: { display: 'flex', justifyContent: 'flex-end' } },
      createElement('button', { onClick: () => setDrawer({ mode: 'create' }), style: buttonStyle }, '+ 新建任务'),
    ),
    error !== null && createElement('div', { style: { color: '#c0392b', fontSize: 13 } }, error),
    createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
      (tasks ?? []).map(task => createElement('div', {
        key: task.id,
        style: { border: '1px solid #e5e5e5', borderRadius: 8, padding: '10px 14px', background: '#fff' },
      },
        createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 } },
          createElement('div', { style: { minWidth: 0 } },
            createElement('div', { style: { fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 } },
              createElement('span', null, task.name),
              createElement('span', {
                style: {
                  fontSize: 11, padding: '1px 8px', borderRadius: 10,
                  background: task.enabled ? '#e6f4ea' : '#f0f0f0',
                  color: task.enabled ? '#1e7d32' : '#888',
                },
              }, task.enabled ? '启用' : '暂停'),
            ),
            createElement('div', { style: { fontSize: 12, color: '#888', marginTop: 2 } },
              `${actionLabel(task.action)}${task.concurrency !== undefined ? ` · 并发:${task.concurrency}` : ''}${task.timeout_seconds !== undefined ? ` · 超时:${task.timeout_seconds}s` : ''}`,
            ),
          ),
          createElement('div', { style: { display: 'flex', gap: 6, flexShrink: 0 } },
            createElement('button', { style: smallButtonStyle, onClick: () => { void api.runNow(task.id).then(props.onChanged).catch(alertError) } }, '立即运行'),
            createElement('button', { style: smallButtonStyle, onClick: () => { void api.updateTask(task.id, { enabled: !task.enabled }).then(props.onChanged).catch(alertError) } }, task.enabled ? '暂停' : '启用'),
            createElement('button', { style: smallButtonStyle, onClick: () => setDetailId(task.id) }, '详情'),
            createElement('button', { style: smallButtonStyle, onClick: () => setDrawer({ mode: 'edit', task }) }, '编辑'),
            createElement('button', { style: { ...smallButtonStyle, ...dangerButtonStyle }, onClick: () => { void api.deleteTask(task.id).then(props.onChanged).catch(alertError) } }, '删除'),
          ),
        ),
      )),
      tasks !== null && tasks.length === 0 && createElement('div', { style: { color: '#999', fontSize: 13, padding: 16, textAlign: 'center' } }, '还没有任务。点击“+ 新建任务”创建一个。'),
      tasks === null && error === null && createElement('div', { style: { color: '#999', fontSize: 13, padding: 16 } }, '加载中…'),
    ),
    drawer !== null && createElement(TaskDrawer, {
      mode: drawer.mode,
      task: drawer.mode === 'edit' ? drawer.task : undefined,
      onClose: () => setDrawer(null),
      onSaved: () => { setDrawer(null); props.onChanged() },
    }),
    detailId !== null && createElement(TaskDetail, { taskId: detailId, onClose: () => setDetailId(null), onChanged: props.onChanged }),
  )
}

/* ---------------- 任务 Drawer（新建 / 编辑） ---------------- */

function TaskDrawer(props: { mode: 'create' | 'edit'; task?: TaskWire; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(props.task?.name ?? '')
  const [description, setDescription] = useState(props.task?.description ?? '')
  const [actionType, setActionType] = useState<'skill' | 'agent_prompt' | 'command' | 'script'>(props.task?.action.type ?? 'skill')
  const [actionSkill, setActionSkill] = useState(props.task?.action.skill ?? '')
  const [actionAgent, setActionAgent] = useState(props.task?.action.agent ?? '')
  const [actionPrompt, setActionPrompt] = useState(props.task?.action.prompt ?? '')
  const [actionCommand, setActionCommand] = useState(props.task?.action.command ?? '')
  const [actionPath, setActionPath] = useState(props.task?.action.path ?? '')
  const [actionArgs, setActionArgs] = useState(props.task?.action.args?.join(' ') ?? '')
  const [concurrency, setConcurrency] = useState<'skip' | 'queue' | 'parallel'>(props.task?.concurrency ?? 'skip')
  const [timeoutSec, setTimeoutSec] = useState(props.task?.timeout_seconds?.toString() ?? '')
  const [retryEnabled, setRetryEnabled] = useState(props.task?.retry?.enabled ?? false)
  const [retryMax, setRetryMax] = useState(props.task?.retry?.max_attempts?.toString() ?? '2')
  const [retryDelay, setRetryDelay] = useState(props.task?.retry?.delay_seconds?.toString() ?? '60')
  // Trigger（新建时可选添加一个）。
  const [triggerType, setTriggerType] = useState<'daily' | 'hourly' | 'weekly' | 'monthly' | 'once' | 'cron'>('daily')
  const [triggerTime, setTriggerTime] = useState('09:00')
  const [triggerWeekday, setTriggerWeekday] = useState('1')
  const [triggerDay, setTriggerDay] = useState('1')
  const [triggerMinute, setTriggerMinute] = useState('0')
  const [triggerAt, setTriggerAt] = useState('')
  const [triggerExpr, setTriggerExpr] = useState('0 18 * * *')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const buildAction = (): Record<string, unknown> => {
    switch (actionType) {
      case 'skill':
        return { type: 'skill', skill: actionSkill, ...(actionPrompt !== '' ? { prompt: actionPrompt } : {}) }
      case 'agent_prompt':
        return { type: 'agent_prompt', agent: actionAgent, prompt: actionPrompt }
      case 'command': {
        const args = splitArgs(actionArgs)
        return { type: 'command', command: actionCommand, ...(args.length > 0 ? { args } : {}) }
      }
      case 'script': {
        const args = splitArgs(actionArgs)
        return { type: 'script', path: actionPath, ...(args.length > 0 ? { args } : {}) }
      }
    }
  }

  const buildTrigger = (): Record<string, unknown> => {
    switch (triggerType) {
      case 'once':
        return { type: 'once', at: triggerAt }
      case 'hourly':
        return { type: 'hourly', minute: Number(triggerMinute) }
      case 'daily':
        return { type: 'daily', time: triggerTime }
      case 'weekly':
        return { type: 'weekly', weekday: Number(triggerWeekday), time: triggerTime }
      case 'monthly':
        return { type: 'monthly', day: Number(triggerDay), time: triggerTime }
      case 'cron':
        return { type: 'cron', expr: triggerExpr }
    }
  }

  const save = async (): Promise<void> => {
    if (name.trim() === '') {
      setError('请填写任务名称。')
      return
    }
    const action = buildAction()
    if (action.type === 'skill' && action.skill === '') { setError('请填写 Skill 名称。'); return }
    if (action.type === 'agent_prompt' && action.agent === '') { setError('请填写 Agent 名称。'); return }
    if (action.type === 'command' && action.command === '') { setError('请填写命令。'); return }
    if (action.type === 'script' && action.path === '') { setError('请填写脚本路径。'); return }
    setSaving(true)
    setError(null)
    try {
      const input: Record<string, unknown> = {
        name: name.trim(),
        description: description !== '' ? description : undefined,
        action,
        concurrency,
        ...(timeoutSec !== '' ? { timeout_seconds: Number(timeoutSec) } : {}),
        ...(retryEnabled ? { retry: { enabled: true, max_attempts: Number(retryMax) || 2, delay_seconds: Number(retryDelay) || 60 } } : {}),
      }
      if (props.mode === 'create') {
        const created = await api.createTask(input)
        // 新建时若用户填了 Trigger，则添加。
        if (triggerType !== 'once' || triggerAt !== '') {
          try {
            await api.addTrigger(created.task.id, buildTrigger())
          } catch (e) {
            // Trigger 失败不阻塞任务创建。
            void e
          }
        }
      } else if (props.task !== undefined) {
        await api.updateTask(props.task.id, input)
      }
      props.onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  const fieldLabel: React.CSSProperties = { fontSize: 12, color: '#666', marginBottom: 4, display: 'block' }
  const inputStyle: React.CSSProperties = { width: '100%', padding: '6px 8px', border: '1px solid #d0d0d0', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }

  return createElement('div', {
    style: {
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.25)', zIndex: 1000,
      display: 'flex', justifyContent: 'flex-end',
    },
    onClick: props.onClose,
  },
    createElement('div', {
      style: { width: 440, maxWidth: '92vw', background: '#fff', height: '100%', overflowY: 'auto', padding: 20, boxSizing: 'border-box' },
      onClick: (e: ClickEvent) => e.stopPropagation(),
    },
      createElement('h2', { style: { fontSize: 16, margin: '0 0 16px' } }, props.mode === 'create' ? '新建任务' : `编辑任务 · ${props.task?.name ?? ''}`),
      createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 12 } },
        /* 名称 */
        createElement('div', null,
          createElement('label', { style: fieldLabel }, '任务名称 *'),
          createElement('input', { style: inputStyle, value: name, onChange: (e: ChangeEvent) => setName(e.target.value), placeholder: '如：每日项目总结' }),
        ),
        /* 描述 */
        createElement('div', null,
          createElement('label', { style: fieldLabel }, '描述'),
          createElement('input', { style: inputStyle, value: description, onChange: (e: ChangeEvent) => setDescription(e.target.value), placeholder: '可选' }),
        ),
        /* 动作 */
        createElement('div', null,
          createElement('label', { style: fieldLabel }, '执行动作 *'),
          createElement('select', { style: inputStyle, value: actionType, onChange: (e: ChangeEvent) => setActionType(e.target.value as never) },
            createElement('option', { value: 'skill' }, 'Skill'),
            createElement('option', { value: 'agent_prompt' }, 'Agent Prompt'),
            createElement('option', { value: 'command' }, 'Command'),
            createElement('option', { value: 'script' }, 'Script'),
          ),
        ),
        actionType === 'skill' && createElement('div', null,
          createElement('label', { style: fieldLabel }, 'Skill 名称 *'),
          createElement('input', { style: inputStyle, value: actionSkill, onChange: (e: ChangeEvent) => setActionSkill(e.target.value), placeholder: '如：project-daily-report' }),
        ),
        (actionType === 'skill' || actionType === 'agent_prompt') && createElement('div', null,
          createElement('label', { style: fieldLabel }, actionType === 'skill' ? '附加指令（可选）' : 'Prompt *'),
          createElement('textarea', { style: { ...inputStyle, minHeight: 60, resize: 'vertical' }, value: actionPrompt, onChange: (e: ChangeEvent) => setActionPrompt(e.target.value) }),
        ),
        actionType === 'agent_prompt' && createElement('div', null,
          createElement('label', { style: fieldLabel }, 'Agent *'),
          createElement('input', { style: inputStyle, value: actionAgent, onChange: (e: ChangeEvent) => setActionAgent(e.target.value), placeholder: 'Agent 名称 / 会话标识' }),
        ),
        actionType === 'command' && createElement('div', null,
          createElement('label', { style: fieldLabel }, '命令 *'),
          createElement('input', { style: inputStyle, value: actionCommand, onChange: (e: ChangeEvent) => setActionCommand(e.target.value), placeholder: '如：git pull' }),
        ),
        actionType === 'script' && createElement('div', null,
          createElement('label', { style: fieldLabel }, '脚本路径 *'),
          createElement('input', { style: inputStyle, value: actionPath, onChange: (e: ChangeEvent) => setActionPath(e.target.value), placeholder: '如：scripts/daily.py' }),
        ),
        (actionType === 'command' || actionType === 'script') && createElement('div', null,
          createElement('label', { style: fieldLabel }, '参数（空格分隔，可选）'),
          createElement('input', { style: inputStyle, value: actionArgs, onChange: (e: ChangeEvent) => setActionArgs(e.target.value) }),
        ),
        /* 并发 / 超时 */
        createElement('div', { style: { display: 'flex', gap: 12 } },
          createElement('div', { style: { flex: 1 } },
            createElement('label', { style: fieldLabel }, '并发策略'),
            createElement('select', { style: inputStyle, value: concurrency, onChange: (e: ChangeEvent) => setConcurrency(e.target.value as never) },
              createElement('option', { value: 'skip' }, 'skip（默认，跳过）'),
              createElement('option', { value: 'queue' }, 'queue（排队）'),
              createElement('option', { value: 'parallel' }, 'parallel（并行）'),
            ),
          ),
          createElement('div', { style: { flex: 1 } },
            createElement('label', { style: fieldLabel }, '超时（秒）'),
            createElement('input', { style: inputStyle, value: timeoutSec, onChange: (e: ChangeEvent) => setTimeoutSec(e.target.value), placeholder: '默认 1800' }),
          ),
        ),
        /* 重试 */
        createElement('div', null,
          createElement('label', { style: { ...fieldLabel, display: 'flex', alignItems: 'center', gap: 6 } },
            createElement('input', { type: 'checkbox', checked: retryEnabled, onChange: (e: ChangeEvent) => setRetryEnabled(e.target.checked) }),
            '失败重试',
          ),
          retryEnabled && createElement('div', { style: { display: 'flex', gap: 12, marginTop: 8 } },
            createElement('div', { style: { flex: 1 } },
              createElement('label', { style: fieldLabel }, '最大重试次数'),
              createElement('input', { style: inputStyle, value: retryMax, onChange: (e: ChangeEvent) => setRetryMax(e.target.value) }),
            ),
            createElement('div', { style: { flex: 1 } },
              createElement('label', { style: fieldLabel }, '间隔（秒）'),
              createElement('input', { style: inputStyle, value: retryDelay, onChange: (e: ChangeEvent) => setRetryDelay(e.target.value) }),
            ),
          ),
        ),
        /* 执行时间（仅新建时） */
        props.mode === 'create' && createElement('div', null,
          createElement('label', { style: fieldLabel }, '执行时间（可选，后续可加多个）'),
          createElement('select', { style: inputStyle, value: triggerType, onChange: (e: ChangeEvent) => setTriggerType(e.target.value as never) },
            createElement('option', { value: 'daily' }, '每天'),
            createElement('option', { value: 'hourly' }, '每小时'),
            createElement('option', { value: 'weekly' }, '每周'),
            createElement('option', { value: 'monthly' }, '每月'),
            createElement('option', { value: 'once' }, '仅一次'),
            createElement('option', { value: 'cron' }, 'Cron（高级）'),
          ),
          createElement('div', { style: { marginTop: 8 } },
            triggerType === 'once' && createElement('input', { style: inputStyle, value: triggerAt, onChange: (e: ChangeEvent) => setTriggerAt(e.target.value), placeholder: 'ISO 时刻，如 2026-09-23T09:00:00' }),
            triggerType === 'hourly' && createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
              createElement('span', { style: { fontSize: 13 } }, '每小时的第'),
              createElement('input', { style: { ...inputStyle, width: 70 }, value: triggerMinute, onChange: (e: ChangeEvent) => setTriggerMinute(e.target.value) }),
              createElement('span', { style: { fontSize: 13 } }, '分钟'),
            ),
            triggerType === 'daily' && createElement('input', { style: inputStyle, type: 'time', value: triggerTime, onChange: (e: ChangeEvent) => setTriggerTime(e.target.value) }),
            triggerType === 'weekly' && createElement('div', { style: { display: 'flex', gap: 8 } },
              createElement('select', { style: { ...inputStyle, flex: 1 }, value: triggerWeekday, onChange: (e: ChangeEvent) => setTriggerWeekday(e.target.value) },
                weekdays.map(w => createElement('option', { key: w.value, value: String(w.value) }, w.label)),
              ),
              createElement('input', { style: { ...inputStyle, width: 110 }, type: 'time', value: triggerTime, onChange: (e: ChangeEvent) => setTriggerTime(e.target.value) }),
            ),
            triggerType === 'monthly' && createElement('div', { style: { display: 'flex', gap: 8 } },
              createElement('div', { style: { flex: 1 } },
                createElement('label', { style: fieldLabel }, '每月第几日'),
                createElement('input', { style: inputStyle, value: triggerDay, onChange: (e: ChangeEvent) => setTriggerDay(e.target.value) }),
              ),
              createElement('div', { style: { flex: 1 } },
                createElement('label', { style: fieldLabel }, '时刻'),
                createElement('input', { style: inputStyle, type: 'time', value: triggerTime, onChange: (e: ChangeEvent) => setTriggerTime(e.target.value) }),
              ),
            ),
            triggerType === 'cron' && createElement('input', { style: inputStyle, value: triggerExpr, onChange: (e: ChangeEvent) => setTriggerExpr(e.target.value), placeholder: '如 0 18 * * *' }),
          ),
        ),
        error !== null && createElement('div', { style: { color: '#c0392b', fontSize: 13 } }, error),
        createElement('div', { style: { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 } },
          createElement('button', { style: buttonStyle, onClick: props.onClose, disabled: saving }, '取消'),
          createElement('button', { style: { ...buttonStyle, background: '#1a56db', color: '#fff', borderColor: '#1a56db' }, onClick: () => { void save() }, disabled: saving }, saving ? '保存中…' : '保存'),
        ),
      ),
    ),
  )
}

/* ---------------- 任务详情 ---------------- */

function TaskDetail(props: { taskId: string; onClose: () => void; onChanged: () => void }) {
  const [data, setData] = useState<{ task: TaskWire; triggers: TriggerWire[]; runs: HistoryWire[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [newTriggerType, setNewTriggerType] = useState<'daily' | 'hourly' | 'weekly' | 'monthly' | 'once' | 'cron'>('daily')
  const [newTriggerTime, setNewTriggerTime] = useState('09:00')
  const [newTriggerWeekday, setNewTriggerWeekday] = useState('1')
  const [newTriggerDay, setNewTriggerDay] = useState('1')
  const [newTriggerMinute, setNewTriggerMinute] = useState('0')
  const [newTriggerAt, setNewTriggerAt] = useState('')
  const [newTriggerExpr, setNewTriggerExpr] = useState('0 18 * * *')

  useEffect(() => {
    let alive = true
    void api.getTask(props.taskId).then(r => {
      if (alive) setData({ task: r.task, triggers: r.triggers, runs: r.runs as unknown as HistoryWire[] })
    }).catch(e => {
      if (alive) setError(e instanceof Error ? e.message : String(e))
    })
    return () => { alive = false }
  }, [props.taskId])

  const addTrigger = async (): Promise<void> => {
    if (data === null) return
    let config: Record<string, unknown>
    switch (newTriggerType) {
      case 'once': config = { type: 'once', at: newTriggerAt }; break
      case 'hourly': config = { type: 'hourly', minute: Number(newTriggerMinute) }; break
      case 'daily': config = { type: 'daily', time: newTriggerTime }; break
      case 'weekly': config = { type: 'weekly', weekday: Number(newTriggerWeekday), time: newTriggerTime }; break
      case 'monthly': config = { type: 'monthly', day: Number(newTriggerDay), time: newTriggerTime }; break
      case 'cron': config = { type: 'cron', expr: newTriggerExpr }; break
    }
    await api.addTrigger(data.task.id, config)
    props.onChanged()
    const fresh = await api.getTask(props.taskId)
    setData({ task: fresh.task, triggers: fresh.triggers, runs: fresh.runs as unknown as HistoryWire[] })
  }

  const inputStyle: React.CSSProperties = { padding: '5px 8px', border: '1px solid #d0d0d0', borderRadius: 6, fontSize: 13 }
  const fieldLabel: React.CSSProperties = { fontSize: 12, color: '#666', marginBottom: 4, display: 'block' }

  return createElement('div', {
    style: {
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.25)', zIndex: 1000,
      display: 'flex', justifyContent: 'flex-end',
    },
    onClick: props.onClose,
  },
    createElement('div', {
      style: { width: 520, maxWidth: '94vw', background: '#fff', height: '100%', overflowY: 'auto', padding: 20, boxSizing: 'border-box' },
      onClick: (e: ClickEvent) => e.stopPropagation(),
    },
      error !== null && createElement('div', { style: { color: '#c0392b' } }, error),
      data === null && !error && createElement('div', { style: { color: '#999' } }, '加载中…'),
      data !== null && createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 14 } },
        createElement('div', null,
          createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
            createElement('h2', { style: { fontSize: 16, margin: 0 } }, data.task.name),
            createElement('button', { style: smallButtonStyle, onClick: props.onClose }, '关闭'),
          ),
          createElement('div', { style: { fontSize: 12, color: '#888', marginTop: 4 } },
            `动作: ${actionLabel(data.task.action)} · 并发: ${data.task.concurrency ?? 'skip'}`,
          ),
        ),
        /* 执行时间 */
        createElement('div', null,
          createElement('h3', { style: { fontSize: 13, margin: '0 0 8px' } }, `执行时间（${data.triggers.length}）`),
          createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 6 } },
            data.triggers.map(t => createElement('div', { key: t.id, style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid #eee', borderRadius: 6, padding: '6px 10px' } },
              createElement('span', { style: { fontSize: 13 } }, `${triggerLabel(t.config)} ${t.enabled ? '' : '（已停用）'}`),
              createElement('div', { style: { display: 'flex', gap: 4 } },
                createElement('button', { style: { ...smallButtonStyle, ...dangerButtonStyle }, onClick: () => { void api.deleteTrigger(t.id).then(async () => { props.onChanged(); const fresh = await api.getTask(props.taskId); setData({ task: fresh.task, triggers: fresh.triggers, runs: fresh.runs as unknown as HistoryWire[] }) }).catch(alertError) } }, '删除'),
              ),
            )),
            data.triggers.length === 0 && createElement('div', { style: { color: '#999', fontSize: 13 } }, '还没有执行时间。'),
          ),
          /* 添加执行时间 */
          createElement('div', { style: { marginTop: 10, borderTop: '1px dashed #e0e0e0', paddingTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' } },
            createElement('select', { style: inputStyle, value: newTriggerType, onChange: (e: ChangeEvent) => setNewTriggerType(e.target.value as never) },
              createElement('option', { value: 'daily' }, '每天'),
              createElement('option', { value: 'hourly' }, '每小时'),
              createElement('option', { value: 'weekly' }, '每周'),
              createElement('option', { value: 'monthly' }, '每月'),
              createElement('option', { value: 'once' }, '仅一次'),
              createElement('option', { value: 'cron' }, 'Cron'),
            ),
            newTriggerType === 'once' && createElement('input', { style: inputStyle, value: newTriggerAt, onChange: (e: ChangeEvent) => setNewTriggerAt(e.target.value), placeholder: 'ISO 时刻' }),
            newTriggerType === 'hourly' && createElement('input', { style: { ...inputStyle, width: 70 }, value: newTriggerMinute, onChange: (e: ChangeEvent) => setNewTriggerMinute(e.target.value), placeholder: '分钟' }),
            (newTriggerType === 'daily' || newTriggerType === 'weekly' || newTriggerType === 'monthly') && createElement('input', { style: { ...inputStyle, width: 110 }, type: 'time', value: newTriggerTime, onChange: (e: ChangeEvent) => setNewTriggerTime(e.target.value) }),
            newTriggerType === 'weekly' && createElement('select', { style: inputStyle, value: newTriggerWeekday, onChange: (e: ChangeEvent) => setNewTriggerWeekday(e.target.value) },
              weekdays.map(w => createElement('option', { key: w.value, value: String(w.value) }, w.label)),
            ),
            newTriggerType === 'monthly' && createElement('input', { style: { ...inputStyle, width: 70 }, value: newTriggerDay, onChange: (e: ChangeEvent) => setNewTriggerDay(e.target.value), placeholder: '日' }),
            newTriggerType === 'cron' && createElement('input', { style: { ...inputStyle, width: 180 }, value: newTriggerExpr, onChange: (e: ChangeEvent) => setNewTriggerExpr(e.target.value) }),
            createElement('button', { style: smallButtonStyle, onClick: () => { void addTrigger().catch(alertError) } }, '添加'),
          ),
        ),
        /* 最近运行 */
        createElement('div', null,
          createElement('h3', { style: { fontSize: 13, margin: '0 0 8px' } }, '最近运行'),
          createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 4 } },
            data.runs.slice(0, 10).map(r => createElement('div', { key: r.run_id, style: { display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#666', borderBottom: '1px solid #f2f2f2', padding: '4px 0' } },
              createElement('span', null, `${r.scheduled_at.replace('T', ' ').slice(0, 16)}`),
              createElement('span', { style: { color: statusColor(r.status) } }, statusLabel(r.status)),
            )),
            data.runs.length === 0 && createElement('div', { style: { color: '#999', fontSize: 13 } }, '还没有运行记录。'),
          ),
        ),
      ),
    ),
  )
}

/* ---------------- 待运行 Tab ---------------- */

function UpcomingTab(props: { refreshKey: number; onChanged: () => void }) {
  const [items, setItems] = useState<UpcomingWire[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [runDetail, setRunDetail] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setItems(null)
    void api.listUpcoming().then(r => {
      if (alive) setItems(r.upcoming)
    }).catch(e => {
      if (alive) setError(e instanceof Error ? e.message : String(e))
    })
    return () => { alive = false }
  }, [props.refreshKey])

  return createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
    error !== null && createElement('div', { style: { color: '#c0392b', fontSize: 13 } }, error),
    createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 6 } },
      (items ?? []).map(item => createElement('div', { key: `${item.run_id}`, style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #eee', borderRadius: 6, padding: '8px 12px' } },
        createElement('div', null,
          createElement('div', { style: { fontSize: 13, fontWeight: 600 } }, item.task_name),
          createElement('div', { style: { fontSize: 12, color: '#888' } }, `${item.trigger_label} · ${formatTime(item.scheduled_at)}`),
        ),
        createElement('div', { style: { display: 'flex', gap: 4 } },
          createElement('button', { style: smallButtonStyle, onClick: () => { void api.runNow(item.task_id).then(props.onChanged).catch(alertError) } }, '立即运行'),
          !item.run_id.startsWith('upcoming_') && createElement('button', { style: { ...smallButtonStyle, ...dangerButtonStyle }, onClick: () => { void api.cancelRun(item.run_id).then(props.onChanged).catch(alertError) } }, '取消'),
        ),
      )),
      items !== null && items.length === 0 && createElement('div', { style: { color: '#999', fontSize: 13, padding: 16, textAlign: 'center' } }, '没有待运行的任务。'),
      items === null && error === null && createElement('div', { style: { color: '#999', fontSize: 13, padding: 16 } }, '加载中…'),
    ),
    runDetail !== null && createElement(RunDetail, { runId: runDetail, onClose: () => setRunDetail(null) }),
  )
}

/* ---------------- 运行中 Tab ---------------- */

function RunningTab(props: { refreshKey: number; onChanged: () => void }) {
  const [items, setItems] = useState<RunningWire[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setItems(null)
    void api.listRunning().then(r => {
      if (alive) setItems(r.running)
    }).catch(e => {
      if (alive) setError(e instanceof Error ? e.message : String(e))
    })
    return () => { alive = false }
  }, [props.refreshKey])

  return createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
    error !== null && createElement('div', { style: { color: '#c0392b', fontSize: 13 } }, error),
    createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 6 } },
      (items ?? []).map(item => createElement('div', { key: item.run_id, style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #eee', borderRadius: 6, padding: '8px 12px' } },
        createElement('div', null,
          createElement('div', { style: { fontSize: 13, fontWeight: 600 } }, item.task_name),
          createElement('div', { style: { fontSize: 12, color: '#888' } }, `已运行 ${Math.round(item.elapsed_ms / 1000)}s · ${formatTime(item.started_at)} 开始`),
        ),
        createElement('button', { style: { ...smallButtonStyle, ...dangerButtonStyle }, onClick: () => { void api.cancelRun(item.run_id).then(props.onChanged).catch(alertError) } }, '取消'),
      )),
      items !== null && items.length === 0 && createElement('div', { style: { color: '#999', fontSize: 13, padding: 16, textAlign: 'center' } }, '当前没有运行中的任务。'),
      items === null && error === null && createElement('div', { style: { color: '#999', fontSize: 13, padding: 16 } }, '加载中…'),
    ),
  )
}

/* ---------------- 历史 Tab ---------------- */

function HistoryTab(props: { refreshKey: number; onChanged: () => void }) {
  const [items, setItems] = useState<HistoryWire[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [runDetail, setRunDetail] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setItems(null)
    void api.listHistory(statusFilter !== '' ? { status: statusFilter } : undefined).then(r => {
      if (alive) setItems(r.runs)
    }).catch(e => {
      if (alive) setError(e instanceof Error ? e.message : String(e))
    })
    return () => { alive = false }
  }, [props.refreshKey, statusFilter])

  return createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
    createElement('div', { style: { display: 'flex', gap: 8, alignItems: 'center' } },
      createElement('label', { style: { fontSize: 13, color: '#666' } }, '状态:'),
      createElement('select', { style: { padding: '4px 8px', border: '1px solid #d0d0d0', borderRadius: 6, fontSize: 13 }, value: statusFilter, onChange: (e: ChangeEvent) => setStatusFilter(e.target.value) },
        createElement('option', { value: '' }, '全部'),
        ['success', 'failed', 'cancelled', 'timeout', 'skipped', 'running', 'pending'].map(s => createElement('option', { key: s, value: s }, statusLabel(s))),
      ),
    ),
    error !== null && createElement('div', { style: { color: '#c0392b', fontSize: 13 } }, error),
    createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 4 } },
      (items ?? []).map(item => createElement('div', { key: item.run_id, style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f2f2f2', padding: '6px 4px' } },
        createElement('div', null,
          createElement('div', { style: { fontSize: 13, fontWeight: 600 } }, item.task_name),
          createElement('div', { style: { fontSize: 12, color: '#888' } },
            `${formatTime(item.scheduled_at)}${item.duration_ms !== undefined ? ` · ${Math.round(item.duration_ms / 1000)}s` : ''}${item.error !== undefined ? ` · ${item.error.slice(0, 40)}` : ''}`,
          ),
        ),
        createElement('div', { style: { display: 'flex', gap: 6, alignItems: 'center' } },
          createElement('span', { style: { fontSize: 12, color: statusColor(item.status), fontWeight: 600 } }, statusLabel(item.status)),
          createElement('button', { style: smallButtonStyle, onClick: () => setRunDetail(item.run_id) }, '日志'),
        ),
      )),
      items !== null && items.length === 0 && createElement('div', { style: { color: '#999', fontSize: 13, padding: 16, textAlign: 'center' } }, '没有历史记录。'),
      items === null && error === null && createElement('div', { style: { color: '#999', fontSize: 13, padding: 16 } }, '加载中…'),
    ),
    runDetail !== null && createElement(RunDetail, { runId: runDetail, onClose: () => setRunDetail(null) }),
  )
}

/* ---------------- Run 详情 ---------------- */

function RunDetail(props: { runId: string; onClose: () => void }) {
  const [data, setData] = useState<{ run: { id: string; status: string; error?: string; output?: string; scheduled_at: string; started_at?: string; finished_at?: string; exit_code?: number }; logs: string[] } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    void api.getRun(props.runId).then(r => {
      if (alive) setData({ run: r.run as never, logs: r.logs })
    }).catch(e => {
      if (alive) setError(e instanceof Error ? e.message : String(e))
    })
    return () => { alive = false }
  }, [props.runId])

  return createElement('div', {
    style: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.25)', zIndex: 1100, display: 'flex', justifyContent: 'flex-end' },
    onClick: props.onClose,
  },
    createElement('div', {
      style: { width: 560, maxWidth: '94vw', background: '#fff', height: '100%', overflowY: 'auto', padding: 20, boxSizing: 'border-box' },
      onClick: (e: ClickEvent) => e.stopPropagation(),
    },
      error !== null && createElement('div', { style: { color: '#c0392b' } }, error),
      data === null && !error && createElement('div', { style: { color: '#999' } }, '加载中…'),
      data !== null && createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 12 } },
        createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
          createElement('div', null,
            createElement('h2', { style: { fontSize: 16, margin: 0 } }, `运行 ${data.run.id.slice(0, 20)}…`),
            createElement('div', { style: { fontSize: 12, color: statusColor(data.run.status), fontWeight: 600 } }, statusLabel(data.run.status)),
          ),
          createElement('button', { style: smallButtonStyle, onClick: props.onClose }, '关闭'),
        ),
        createElement('div', { style: { fontSize: 12, color: '#888' } },
          `计划: ${formatTime(data.run.scheduled_at)}`,
          data.run.started_at !== undefined ? ` · 开始: ${formatTime(data.run.started_at)}` : '',
          data.run.finished_at !== undefined ? ` · 结束: ${formatTime(data.run.finished_at)}` : '',
          data.run.exit_code !== undefined ? ` · 退出码: ${data.run.exit_code}` : '',
        ),
        data.run.error !== undefined && createElement('div', { style: { fontSize: 13, color: '#c0392b', background: '#fdf0ef', borderRadius: 6, padding: 10 } }, data.run.error),
        data.run.output !== undefined && data.run.output !== '' && createElement('div', null,
          createElement('h3', { style: { fontSize: 13, margin: '0 0 6px' } }, '输出'),
          createElement('pre', { style: { fontSize: 12, background: '#f7f7f7', borderRadius: 6, padding: 10, overflowX: 'auto', maxHeight: 240, overflowY: 'auto', whiteSpace: 'pre-wrap', margin: 0 } }, data.run.output),
        ),
        createElement('div', null,
          createElement('h3', { style: { fontSize: 13, margin: '0 0 6px' } }, '执行日志'),
          data.logs.length === 0
            ? createElement('div', { style: { color: '#999', fontSize: 13 } }, '（无日志）')
            : createElement('pre', { style: { fontSize: 12, background: '#f7f7f7', borderRadius: 6, padding: 10, overflowX: 'auto', maxHeight: 320, overflowY: 'auto', whiteSpace: 'pre-wrap', margin: 0 } }, data.logs.join('\n')),
        ),
      ),
    ),
  )
}

/* ---------------- 辅助 ---------------- */

const weekdays = [
  { value: 0, label: '周日' },
  { value: 1, label: '周一' },
  { value: 2, label: '周二' },
  { value: 3, label: '周三' },
  { value: 4, label: '周四' },
  { value: 5, label: '周五' },
  { value: 6, label: '周六' },
]

/** Action 的人类可读标签。 */
export function actionLabel(action: { type: string; skill?: string; agent?: string; command?: string; path?: string }): string {
  switch (action.type) {
    case 'skill': return `Skill: ${action.skill ?? ''}`
    case 'agent_prompt': return `Agent: ${action.agent ?? ''}`
    case 'command': return `命令: ${action.command ?? ''}`
    case 'script': return `脚本: ${action.path ?? ''}`
    default: return action.type
  }
}

/** Trigger 配置的人类可读标签。 */
export function triggerLabel(config: Record<string, unknown>): string {
  const type = config.type as string
  switch (type) {
    case 'once': return `仅一次 · ${String(config.at ?? '')}`
    case 'hourly': return config.minute === 0 || config.minute === undefined ? '每小时整点' : `每小时 :${String(config.minute).padStart(2, '0')}`
    case 'daily': return `每天 ${String(config.time ?? '')}`
    case 'weekday': {
      const ws = (config.weekdays as number[] | undefined) ?? []
      return `每星期${ws.map(w => weekdays.find(x => x.value === w)?.label ?? w).join('、')} ${String(config.time ?? '')}`
    }
    case 'weekly': return `每星期${weekdays.find(x => x.value === config.weekday)?.label ?? String(config.weekday)} ${String(config.time ?? '')}`
    case 'monthly': return `每月 ${String(config.day ?? '')} 日 ${String(config.time ?? '')}`
    case 'cron': return `Cron ${String(config.expr ?? '')}`
    default: return type
  }
}

/** 运行状态标签。 */
export function statusLabel(status: string): string {
  switch (status) {
    case 'pending': return '排队中'
    case 'running': return '运行中'
    case 'success': return '成功'
    case 'failed': return '失败'
    case 'cancelled': return '已取消'
    case 'timeout': return '超时'
    case 'skipped': return '已跳过'
    default: return status
  }
}

/** 运行状态颜色。 */
export function statusColor(status: string): string {
  switch (status) {
    case 'running': return '#1a56db'
    case 'success': return '#1e7d32'
    case 'failed': return '#c0392b'
    case 'cancelled': return '#888'
    case 'timeout': return '#b26a00'
    case 'skipped': return '#888'
    default: return '#555'
  }
}

/** 时间格式化。 */
function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('zh-CN', { hour12: false })
  } catch {
    return iso
  }
}

/** 空格分词（参数输入）。 */
function splitArgs(text: string): string[] {
  return text.split(/\s+/).filter(part => part !== '')
}

/** 错误提示。 */
function alertError(e: unknown): void {
  // eslint-disable-next-line no-alert
  window.alert(e instanceof Error ? e.message : String(e))
}
