import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { Context } from '@deepseek-ai/cordis'
import { ToolRuntime, type ToolDefinition } from '@deepseek-ai/dsh-tools'
import { AutomationService } from '../src/core/service.ts'
import { createMemoryStore } from '../src/storage/sqlite.ts'
import { AUTOMATION_TOOL_NAMES, registerAutomationTools } from '../src/tools/automation-tools.ts'

const cleanups: Array<() => Promise<void>> = []
afterEach(async () => { for (const cleanup of cleanups.splice(0)) await cleanup() })

function fixture() {
  const ctx = new Context()
  ctx.provide('systemPrompt')
  ctx.set('systemPrompt', { tools: () => () => {} } as never)
  const runtime = new ToolRuntime(ctx)
  const { store } = createMemoryStore()
  const service = new AutomationService(store, { resolveExecutor: () => undefined })
  const dispose = registerAutomationTools({ tools: { register: tool => runtime.register(tool as ToolDefinition) } }, { service })
  let sequence = 0
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const result = await runtime.execute({
      name, arguments: args, callId: `tool-name-${++sequence}` as never,
      signal: new AbortController().signal,
    })
    expect(result.isError, JSON.stringify(result)).toBe(false)
    if (result.isError) throw Error('工具执行失败')
    const value = result.value as Record<string, any>
    expect(value).toEqual(expect.objectContaining({ ok: expect.any(Boolean), code: expect.any(String), message: expect.any(String) }))
    expect(result.content.some(block => block.type === 'text')).toBe(true)
    return value
  }
  cleanups.push(async () => { dispose(); await service.dispose(); store.close() })
  return { runtime, service, store, dispose, call }
}

describe('自动化工具的模型接口兼容性', () => {
  it('真实注册16个合法且唯一的名称，旧名不注册，卸载全部释放', () => {
    const { runtime, dispose } = fixture()
    const names = runtime.schemas().map(tool => tool.name)
    expect(names).toHaveLength(16)
    expect(new Set(names).size).toBe(16)
    expect(names).toEqual([...AUTOMATION_TOOL_NAMES])
    for (const name of names) {
      expect(name).toMatch(/^[a-zA-Z0-9_-]+$/)
      expect(name.length).toBeLessThanOrEqual(64)
      expect(runtime.get(name.replace('automation_', 'automation.'))).toBeUndefined()
    }
    dispose()
    expect(runtime.schemas()).toEqual([])
  })

  it('捆绑Skill与当前工具契约覆盖实际注册的新名称', () => {
    const { runtime } = fixture()
    const skill = readFileSync(new URL('../skills/automation/SKILL.md', import.meta.url), 'utf8')
    const docs = readFileSync(new URL('../docs/tools.md', import.meta.url), 'utf8')
    const mentioned = [...new Set(skill.match(/\bautomation_[a-z_]+\b/g))].sort()
    expect(mentioned).toEqual(runtime.schemas().map(tool => tool.name).sort())
    for (const tool of runtime.schemas()) expect(docs).toContain('`' + tool.name + '`')
    expect(skill).not.toMatch(/\bautomation\.[a-z_]+/)
  })

  it('通过新名称完成16项服务操作，保留任务／触发器／运行的关联和结果信封', async () => {
    const { call, store } = fixture()
    const created = await call('automation_create_task', { name: '名称兼容回归', action: { type: 'command', command: 'node', args: ['-e', ''] } })
    const taskId = created.task.id
    expect((await call('automation_update_task', { task_id: taskId, name: '已更新' })).task.id).toBe(taskId)
    expect((await call('automation_get_task', { task_id: taskId })).task.name).toBe('已更新')
    expect((await call('automation_list_tasks')).tasks.map((task: any) => task.id)).toEqual([taskId])
    expect((await call('automation_disable_task', { task_id: taskId })).task.enabled).toBe(false)
    expect((await call('automation_enable_task', { task_id: taskId })).task.enabled).toBe(true)
    const added = await call('automation_add_trigger', { task_id: taskId, type: 'once', at: '2099-01-01T09:00:00+08:00', time_zone: 'Asia/Shanghai' })
    const triggerId = added.trigger.id
    expect((await call('automation_list_upcoming_runs')).upcoming).toHaveLength(1)
    expect((await call('automation_update_trigger', { trigger_id: triggerId, enabled: false })).trigger.id).toBe(triggerId)
    const runId = (await call('automation_run_now', { task_id: taskId })).run_id
    const run = await call('automation_get_run', { run_id: runId })
    expect(run.run.task_id).toBe(taskId)
    expect(run.run.trigger_id).toBe('manual')
    expect(run.run.status).toBe('pending')
    expect((await call('automation_list_running_runs')).running).toEqual([])
    expect((await call('automation_list_history', { task_id: taskId, status: 'pending' })).runs).toHaveLength(1)
    expect((await call('automation_cancel_run', { run_id: runId })).ok).toBe(true)
    expect(store.getRun(runId)?.status).toBe('cancelled')
    expect(store.getTask(taskId)?.enabled).toBe(true)
    expect(store.listTriggers(taskId).map(trigger => trigger.id)).toEqual([triggerId])
    expect((await call('automation_delete_trigger', { trigger_id: triggerId })).ok).toBe(true)
    expect((await call('automation_delete_task', { task_id: taskId })).ok).toBe(true)
    expect(store.getTask(taskId)).toBeUndefined()
    expect(store.getRun(runId)).toBeUndefined()
  })

  it('未知对象和非法触发规则仍返回原结构化错误，旧名不能分发', async () => {
    const { call, runtime, store } = fixture()
    expect((await call('automation_get_task', { task_id: 'missing' })).code).toBe('TASK_NOT_FOUND')
    expect((await call('automation_get_run', { run_id: 'missing' })).code).toBe('RUN_NOT_FOUND')
    expect((await call('automation_add_trigger', { task_id: 'missing' })).code).toBe('INVALID_INPUT')
    expect((await call('automation_add_trigger', { task_id: 'missing', type: 'daily', time: '99:99' })).code).toBe('INVALID_TRIGGER')
    const old = await runtime.execute({ name: 'automation.create_task', arguments: { name: '不得执行' }, callId: 'retired-tool' as never, signal: new AbortController().signal })
    expect(old.isError).toBe(true)
    expect(store.listTasks()).toEqual([])
  })
})
