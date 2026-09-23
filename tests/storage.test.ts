import { afterAll, describe, expect, it } from 'vitest'
import { createMemoryStore } from '../src/storage/sqlite.ts'
import type { AutomationStore, CreateTaskInput, Run } from '../src/shared/types.ts'

/** 构造任务输入。 */
function taskInput(name = '测试任务', action: CreateTaskInput['action'] = { type: 'command', command: 'echo hi' }): CreateTaskInput {
  return {
    name,
    enabled: true,
    action,
    created_by: 'test',
  }
}

/** 构造 Run。 */
function runInput(taskId: string, triggerId: string, overrides: Partial<Run> = {}): Run {
  return {
    id: `run_test_${Math.random().toString(36).slice(2, 8)}`,
    task_id: taskId,
    trigger_id: triggerId,
    scheduled_at: new Date().toISOString(),
    status: 'pending',
    attempt: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

describe('SqliteAutomationStore', () => {
  const memory = createMemoryStore()
  const store: AutomationStore = memory.store

  afterAll(() => {
    try {
      ;(store as { close(): void }).close()
    } catch {
      // 忽略
    }
  })

  it('createTask / getTask / listTasks 往返', () => {
    const task = store.createTask(taskInput('每日总结'))
    expect(task.id).toMatch(/^task_/)
    expect(task.enabled).toBe(true)
    expect(task.action.type).toBe('command')

    const got = store.getTask(task.id)
    expect(got?.name).toBe('每日总结')
    expect(got?.action).toEqual(task.action)

    expect(store.listTasks().some(t => t.id === task.id)).toBe(true)
  })

  it('updateTask 部分更新', () => {
    const task = store.createTask(taskInput('待更新'))
    const updated = store.updateTask(task.id, { name: '已更新', concurrency: 'queue' })
    expect(updated?.name).toBe('已更新')
    expect(updated?.concurrency).toBe('queue')
    expect(updated?.action).toEqual(task.action) // 未动的字段保留
  })

  it('deleteTask 级联删除 triggers 与 runs', () => {
    const task = store.createTask(taskInput('待删除'))
    const trigger = store.addTrigger(task.id, { config: { type: 'daily', time: '09:00' }, enabled: true })
    expect(trigger).toBeDefined()
    store.createRun(runInput(task.id, trigger!.id))

    expect(store.deleteTask(task.id)).toBe(true)
    expect(store.getTask(task.id)).toBeUndefined()
    expect(store.listTriggers(task.id)).toHaveLength(0)
    expect(store.listRuns({ taskId: task.id })).toHaveLength(0)
  })

  it('Trigger CRUD', () => {
    const task = store.createTask(taskInput('多执行时间'))
    const t1 = store.addTrigger(task.id, { config: { type: 'daily', time: '08:00' }, enabled: true })!
    const t2 = store.addTrigger(task.id, { config: { type: 'weekly', weekday: 5, time: '18:00' }, enabled: true })!
    expect(t1.id).toMatch(/^trigger_/)
    expect(store.listTriggers(task.id)).toHaveLength(2)

    const updated = store.updateTrigger(t1.id, { enabled: false })
    expect(updated?.enabled).toBe(false)

    expect(store.deleteTrigger(t2.id)).toBe(true)
    expect(store.getTrigger(t2.id)).toBeUndefined()
    expect(store.listTriggers(task.id)).toHaveLength(1)
  })

  it('addTrigger 返回 undefined 当任务不存在', () => {
    expect(store.addTrigger('task_nonexistent', { config: { type: 'daily', time: '09:00' }, enabled: true })).toBeUndefined()
  })

  it('Run CRUD 与状态筛选', () => {
    const task = store.createTask(taskInput('运行记录'))
    const trigger = store.addTrigger(task.id, { config: { type: 'daily', time: '09:00' }, enabled: true })!
    const r1 = store.createRun(runInput(task.id, trigger.id, { status: 'success' }))
    const r2 = store.createRun(runInput(task.id, trigger.id, { status: 'failed', error: 'boom' }))
    const r3 = store.createRun(runInput(task.id, trigger.id, { status: 'pending' }))

    expect(store.getRun(r1.id)?.status).toBe('success')

    const all = store.listRuns({ taskId: task.id })
    expect(all).toHaveLength(3)

    const failed = store.listRuns({ taskId: task.id, status: 'failed' })
    expect(failed).toHaveLength(1)
    expect(failed[0]?.id).toBe(r2.id)
    expect(failed[0]?.error).toBe('boom')

    const updated = store.updateRun(r3.id, { status: 'running', started_at: new Date().toISOString() })
    expect(updated?.status).toBe('running')
    expect(updated?.started_at).toBeDefined()
  })

  it('appendRunLog / readRunLog 往返（DB 行）', () => {
    const task = store.createTask(taskInput('日志'))
    const trigger = store.addTrigger(task.id, { config: { type: 'hourly' }, enabled: true })!
    const run = store.createRun(runInput(task.id, trigger.id))
    store.appendRunLog(run.id, '第一行')
    store.appendRunLog(run.id, '第二行')
    const logs = store.readRunLog(run.id)
    expect(logs).toContain('第一行')
    expect(logs).toContain('第二行')
  })

  it('readRunLog 不存在返回空数组', () => {
    expect(store.readRunLog('run_nonexistent')).toEqual([])
  })

  it('支持脚本类 action 往返', () => {
    const input = taskInput('脚本任务', { type: 'script', path: './daily.py', args: ['--verbose'] })
    const task = store.createTask(input)
    expect(store.getTask(task.id)?.action).toEqual(input.action)
  })
})

describe('createMemoryStore 隔离', () => {
  it('不同实例互不干扰', () => {
    const a = createMemoryStore()
    const b = createMemoryStore()
    a.store.createTask(taskInput('A'))
    expect(a.store.listTasks()).toHaveLength(1)
    expect(b.store.listTasks()).toHaveLength(0)
    ;(a.store as { close(): void }).close()
    ;(b.store as { close(): void }).close()
  })
})
