import { describe, expect, it } from 'vitest'
import { TaskQueue } from '../src/core/queue.ts'
import { AutomationWorker, type ActionExecutor } from '../src/core/worker.ts'
import type { ActionSpec, Run, Task } from '../src/shared/types.ts'

/** 构造 Run。 */
function makeRun(id: string, scheduledAt: string, status: Run['status'] = 'pending'): Run {
  return {
    id,
    task_id: 'task_1',
    trigger_id: 'trigger_1',
    scheduled_at: scheduledAt,
    status,
    attempt: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

/** 构造 Task。 */
function makeTask(action: ActionSpec): Task {
  return {
    id: 'task_1',
    name: '测试',
    enabled: true,
    action,
    created_by: 'test',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

describe('TaskQueue', () => {
  it('按 scheduled_at 升序排队', () => {
    const q = new TaskQueue()
    q.enqueue(makeRun('run_b', '2026-09-23T10:00:00.000Z'))
    q.enqueue(makeRun('run_a', '2026-09-23T09:00:00.000Z'))
    expect(q.peek()?.run.id).toBe('run_a')
    expect(q.size).toBe(2)
  })

  it('dequeue 取出队首并移除', () => {
    const q = new TaskQueue()
    q.enqueue(makeRun('run_b', '2026-09-23T10:00:00.000Z'))
    q.enqueue(makeRun('run_a', '2026-09-23T09:00:00.000Z'))
    const first = q.dequeue()
    expect(first?.run.id).toBe('run_a')
    expect(q.size).toBe(1)
    expect(q.peek()?.run.id).toBe('run_b')
  })

  it('cancel 取消并移除，触发 abort 信号', () => {
    const q = new TaskQueue()
    const entry = q.enqueue(makeRun('run_1', '2026-09-23T09:00:00.000Z'))
    expect(entry.signal.aborted).toBe(false)
    expect(q.cancel('run_1', '用户取消')).toBe(true)
    expect(entry.signal.aborted).toBe(true)
    expect(q.get('run_1')).toBeUndefined()
    expect(q.size).toBe(0)
  })

  it('cancel 不存在的 Run 返回 false', () => {
    const q = new TaskQueue()
    expect(q.cancel('run_missing')).toBe(false)
  })

  it('clear 清空并取消全部', () => {
    const q = new TaskQueue()
    const a = q.enqueue(makeRun('run_a', '2026-09-23T09:00:00.000Z'))
    const b = q.enqueue(makeRun('run_b', '2026-09-23T10:00:00.000Z'))
    q.clear('服务停止')
    expect(a.signal.aborted).toBe(true)
    expect(b.signal.aborted).toBe(true)
    expect(q.size).toBe(0)
  })

  it('pendingIds / all / statusCounts', () => {
    const q = new TaskQueue()
    q.enqueue(makeRun('run_a', '2026-09-23T09:00:00.000Z'))
    q.enqueue(makeRun('run_b', '2026-09-23T10:00:00.000Z', 'running'))
    expect(q.pendingIds()).toEqual(['run_a', 'run_b'])
    expect(q.all()).toHaveLength(2)
    expect(q.statusCounts().pending).toBe(1)
    expect(q.statusCounts().running).toBe(1)
  })
})

describe('AutomationWorker', () => {
  it('执行成功：透传输出', async () => {
    const executor: ActionExecutor = {
      execute: async () => ({ output: '完成！', exit_code: 0 }),
    }
    const worker = new AutomationWorker({ resolveExecutor: () => executor })
    const logs: string[] = []
    const result = await worker.execute(makeTask({ type: 'command', command: 'echo' }), makeRun('run_1', new Date().toISOString()), new AbortController().signal, line => logs.push(line))
    expect(result.output).toBe('完成！')
    expect(result.exit_code).toBe(0)
    expect(result.error).toBeUndefined()
  })

  it('执行器缺失：结构化错误', async () => {
    const worker = new AutomationWorker({ resolveExecutor: () => undefined })
    const result = await worker.execute(makeTask({ type: 'skill', skill: 'whatever' }), makeRun('run_1', new Date().toISOString()), new AbortController().signal, () => {})
    expect(result.exit_code).toBe(1)
    expect(result.error).toContain('不支持的 Action 类型')
  })

  it('执行器抛异常：捕获为错误', async () => {
    const executor: ActionExecutor = {
      execute: async () => {
        throw new Error('内部爆炸')
      },
    }
    const worker = new AutomationWorker({ resolveExecutor: () => executor })
    const result = await worker.execute(makeTask({ type: 'command', command: 'x' }), makeRun('run_1', new Date().toISOString()), new AbortController().signal, () => {})
    expect(result.exit_code).toBe(1)
    expect(result.error).toBe('内部爆炸')
  })

  it('执行完成后 signal 已中止：标记为取消', async () => {
    const controller = new AbortController()
    controller.abort('已取消')
    const executor: ActionExecutor = {
      execute: async () => ({ output: '部分输出' }),
    }
    const worker = new AutomationWorker({ resolveExecutor: () => executor })
    const result = await worker.execute(makeTask({ type: 'command', command: 'x' }), makeRun('run_1', new Date().toISOString()), controller.signal, () => {})
    expect(result.error).toContain('取消')
  })

  it('按 action 类型解析不同执行器', async () => {
    const seen: string[] = []
    const worker = new AutomationWorker({
      resolveExecutor: (action) => {
        seen.push(action.type)
        return { execute: async () => ({ output: 'ok' }) }
      },
    })
    await worker.execute(makeTask({ type: 'command', command: 'ls' }), makeRun('r1', new Date().toISOString()), new AbortController().signal, () => {})
    await worker.execute(makeTask({ type: 'script', path: './a.sh' }), makeRun('r2', new Date().toISOString()), new AbortController().signal, () => {})
    expect(seen).toEqual(['command', 'script'])
  })
})
