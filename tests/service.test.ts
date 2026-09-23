import { afterEach, describe, expect, it } from 'vitest'
import { createMemoryStore } from '../src/storage/sqlite.ts'
import { AutomationService } from '../src/core/service.ts'
import type { AutomationStore, CreateTaskInput } from '../src/shared/types.ts'

/** 构造任务输入。 */
function taskInput(name: string, action: CreateTaskInput['action'] = { type: 'command', command: 'echo hi' }, extra: Partial<CreateTaskInput> = {}): CreateTaskInput {
  return {
    name,
    enabled: true,
    action,
    created_by: 'test',
    ...extra,
  }
}

/** 测试夹具：内存存储 + 服务（tick 手动驱动）。 */
function createService(store: AutomationStore, options: { executor?: (action: CreateTaskInput['action']) => { output: string; error?: string; exit_code?: number } } = {}) {
  const service = new AutomationService(store, {
    resolveExecutor: (action) => {
      if (action.type === 'skill' || action.type === 'agent_prompt') return undefined
      const fn = options.executor
      if (fn === undefined) {
        return { execute: async () => ({ output: 'ok' }) }
      }
      return { execute: async () => fn(action) }
    },
  }, {
    tickMs: 50,
    logger: () => {},
  })
  return service
}

describe('AutomationService：任务与 Trigger CRUD', () => {
  it('createTask / updateTask / deleteTask / enableTask', () => {
    const memory = createMemoryStore()
    const service = createService(memory.store)
    service.start()
    try {
      const created = service.createTask(taskInput('日报'))
      expect(created.ok).toBe(true)
      const id = (created as { task: { id: string } }).task.id

      const updated = service.updateTask(id, { name: '周报' })
      expect((updated as { task: { name: string } }).task.name).toBe('周报')

      const disabled = service.enableTask(id, false)
      expect((disabled as { task: { enabled: boolean } }).task.enabled).toBe(false)

      const deleted = service.deleteTask(id)
      expect(deleted.ok).toBe(true)
      expect(service.allTasks()).toHaveLength(0)
    } finally {
      service.dispose()
      ;(memory.store as { close(): void }).close()
    }
  })

  it('addTrigger 非法配置返回 INVALID_TRIGGER', () => {
    const memory = createMemoryStore()
    const service = createService(memory.store)
    try {
      const created = service.createTask(taskInput('任务'))
      const id = (created as { task: { id: string } }).task.id
      const bad = service.addTrigger(id, { config: { type: 'daily', time: '99:99' } as never, enabled: true })
      expect(bad.ok).toBe(false)
      expect(bad.code).toBe('INVALID_TRIGGER')
    } finally {
      service.dispose()
      ;(memory.store as { close(): void }).close()
    }
  })

  it('getTaskDetail 返回任务 + triggers + runs', () => {
    const memory = createMemoryStore()
    const service = createService(memory.store)
    try {
      const created = service.createTask(taskInput('详情'))
      const id = (created as { task: { id: string } }).task.id
      service.addTrigger(id, { config: { type: 'daily', time: '09:00' }, enabled: true })
      const detail = service.getTaskDetail(id)
      expect(detail.ok).toBe(true)
      const d = detail as { task: { id: string }; triggers: unknown[]; runs: unknown[] }
      expect(d.task.id).toBe(id)
      expect(d.triggers).toHaveLength(1)
      expect(Array.isArray(d.runs)).toBe(true)
    } finally {
      service.dispose()
      ;(memory.store as { close(): void }).close()
    }
  })
})

describe('AutomationService：运行控制', () => {
  it('runNow 创建手动 Run 并成功执行', async () => {
    const memory = createMemoryStore()
    const service = createService(memory.store, { executor: () => ({ output: '手动输出' }) })
    service.start()
    try {
      const created = service.createTask(taskInput('立即任务'))
      const id = (created as { task: { id: string } }).task.id
      const result = service.runNow(id)
      expect(result.ok).toBe(true)
      const runId = (result as { run_id: string }).run_id

      // 手动驱动：等待队列被消费。
      await waitFor(() => service.getRun(runId)?.status === 'success')
      const run = service.getRun(runId)!
      expect(run.status).toBe('success')
      expect(run.output).toContain('手动输出')
    } finally {
      service.dispose()
      ;(memory.store as { close(): void }).close()
    }
  })

  it('runNow 不存在的任务返回 TASK_NOT_FOUND', () => {
    const memory = createMemoryStore()
    const service = createService(memory.store)
    try {
      const result = service.runNow('task_missing')
      expect(result.ok).toBe(false)
      expect(result.code).toBe('TASK_NOT_FOUND')
    } finally {
      service.dispose()
      ;(memory.store as { close(): void }).close()
    }
  })

  it('cancelRun 取消排队中的 Run', async () => {
    const memory = createMemoryStore()
    const service = createService(memory.store, {
      executor: () => ({ output: '', error: '不该执行' }),
    })
    service.start()
    try {
      const created = service.createTask(taskInput('排队任务'))
      const id = (created as { task: { id: string } }).task.id
      const result = service.runNow(id)
      const runId = (result as { run_id: string }).run_id

      const cancelled = service.cancelRun(runId)
      expect(cancelled.ok).toBe(true)
      await waitFor(() => service.getRun(runId)?.status === 'cancelled')
      expect(service.getRun(runId)?.status).toBe('cancelled')
    } finally {
      service.dispose()
      ;(memory.store as { close(): void }).close()
    }
  })

  it('cancelRun 不存在的 Run 返回 RUN_NOT_FOUND', () => {
    const memory = createMemoryStore()
    const service = createService(memory.store)
    try {
      const result = service.cancelRun('run_missing')
      expect(result.ok).toBe(false)
      expect(result.code).toBe('RUN_NOT_FOUND')
    } finally {
      service.dispose()
      ;(memory.store as { close(): void }).close()
    }
  })

  it('失败的任务：重试后成功', async () => {
    const memory = createMemoryStore()
    let calls = 0
    const service = createService(memory.store, {
      executor: () => {
        calls += 1
        return calls === 1 ? { output: '', error: '第一次失败' } : { output: '第二次成功' }
      },
    })
    service.start()
    try {
      const created = service.createTask(taskInput('重试任务', { type: 'command', command: 'x' }, {
        retry: { enabled: true, max_attempts: 1, delay_seconds: 0 },
      }))
      const id = (created as { task: { id: string } }).task.id
      const result = service.runNow(id)
      const runId = (result as { run_id: string }).run_id

      await waitFor(() => service.getRun(runId)?.status === 'success')
      const run = service.getRun(runId)!
      expect(run.status).toBe('success')
      expect(run.attempt).toBe(2)
      expect(calls).toBe(2)
    } finally {
      service.dispose()
      ;(memory.store as { close(): void }).close()
    }
  })

  it('失败且无重试：标记 failed', async () => {
    const memory = createMemoryStore()
    const service = createService(memory.store, {
      executor: () => ({ output: '', error: '一直失败' }),
    })
    service.start()
    try {
      const created = service.createTask(taskInput('失败任务'))
      const id = (created as { task: { id: string } }).task.id
      const result = service.runNow(id)
      const runId = (result as { run_id: string }).run_id

      await waitFor(() => service.getRun(runId)?.status === 'failed')
      const run = service.getRun(runId)!
      expect(run.error).toContain('一直失败')
    } finally {
      service.dispose()
      ;(memory.store as { close(): void }).close()
    }
  })

  it('skill 类型无宿主执行器：标记 failed', async () => {
    const memory = createMemoryStore()
    const service = createService(memory.store)
    service.start()
    try {
      const created = service.createTask(taskInput('技能任务', { type: 'skill', skill: 'nonexistent' }))
      const id = (created as { task: { id: string } }).task.id
      const result = service.runNow(id)
      const runId = (result as { run_id: string }).run_id

      await waitFor(() => service.getRun(runId)?.status === 'failed')
      expect(service.getRun(runId)?.error).toContain('不支持的 Action 类型')
    } finally {
      service.dispose()
      ;(memory.store as { close(): void }).close()
    }
  })
})

describe('AutomationService：并发策略', () => {
  it('skip：同任务运行中时，新触发标记 skipped', async () => {
    const memory = createMemoryStore()
    // 挂起执行器：第一个实例保持 running。
    let releaseFirst: () => void
    const gate = new Promise<void>((resolvePromise) => {
      releaseFirst = resolvePromise
    })
    let gated = false
    const service = new AutomationService(memory.store, {
      resolveExecutor: () => ({
        execute: async () => {
          if (!gated) {
            gated = true
            await gate
            return { output: 'first-done' }
          }
          return { output: 'second-done' }
        },
      }),
    }, { tickMs: 30, logger: () => {} })
    service.start()
    try {
      const created = service.createTask(taskInput('并发任务', { type: 'command', command: 'x' }, { concurrency: 'skip' }))
      const id = (created as { task: { id: string } }).task.id
      service.addTrigger(id, { config: { type: 'hourly' }, enabled: true })

      // 立即运行第一个实例（挂起）→ running。
      const r1 = service.runNow(id)
      const run1Id = (r1 as { run_id: string }).run_id
      await waitFor(() => service.getRun(run1Id)?.status === 'running')

      // 直接调用私有 fireTrigger 模拟"第二个周期触发"。
      const task = service.allTasks()[0]!
      const trigger = service.allTriggers()[0]!
      const svc = service as unknown as {
        fireTrigger(entry: { trigger: unknown; task: unknown; nextAt: number }, now: number): { run?: unknown; skipped?: boolean; reason?: string }
      }
      const result = svc.fireTrigger({ trigger, task, nextAt: Date.now() }, Date.now())
      expect(result.skipped).toBe(true)
      expect(result.reason).toContain('skip')

      // 队列里应有一条 skipped 记录。
      const history = service.listHistory({ taskId: id })
      expect(history.some(h => h.status === 'skipped')).toBe(true)

      // 释放第一个实例，确认收尾。
      releaseFirst!()
      await waitFor(() => service.getRun(run1Id)?.status === 'success')
      expect(service.getRun(run1Id)?.output).toBe('first-done')
    } finally {
      try { releaseFirst!() } catch { /* 已释放 */ }
      service.dispose()
      ;(memory.store as { close(): void }).close()
    }
  })
})

/** 轮询等待条件成立（超时 3s）。 */
async function waitFor(cond: () => boolean, timeoutMs = 3000): Promise<void> {
  const start = Date.now()
  while (!cond()) {
    if (Date.now() - start > timeoutMs) throw new Error('等待条件超时')
    await new Promise(r => setTimeout(r, 10))
  }
}
