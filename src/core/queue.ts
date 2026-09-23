/**
 * Task Queue：等待执行的 Run 队列。
 *
 * Run 状态机：pending → running → success / failed / cancelled / timeout
 * （另有 skipped——并发策略 skip 时直接跳过本次）。
 *
 * 队列职责（需求 §17）：
 * - 排队（按 scheduled_at 升序，FIFO 稳定）；
 * - 获取任务（队首）；
 * - 状态更新（由调用方驱动）；
 * - 取消任务（pending 取消 → cancelled）；
 * - 超时处理（由 Run Manager 负责，队列不感知）。
 */
import type { AutomationId, Run, RunStatus } from '../shared/types.ts'

/** 可取消的排队任务。 */
export interface QueuedRun {
  run: Run
  /** 取消信号：取消执行（cancel_run / 服务停止）。 */
  signal: AbortSignal
  cancel: (reason?: string) => void
}

/** 比较两个 Run 的调度顺序（scheduled_at 升序，同刻按 id 稳定）。 */
function compareScheduled(a: Run, b: Run): number {
  const ta = Date.parse(a.scheduled_at)
  const tb = Date.parse(b.scheduled_at)
  if (ta !== tb) return ta - tb
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

/** 内存优先级队列（按 scheduled_at 排序）。 */
export class TaskQueue {
  private readonly items: QueuedRun[] = []
  private readonly byId = new Map<AutomationId, QueuedRun>()

  get size(): number {
    return this.items.length
  }

  /** 排队一个 Run。 */
  enqueue(run: Run): QueuedRun {
    const controller = new AbortController()
    const entry: QueuedRun = {
      run,
      signal: controller.signal,
      cancel: (reason) => {
        if (!controller.signal.aborted) {
          controller.abort(reason)
        }
      },
    }
    this.items.push(entry)
    this.items.sort((a, b) => compareScheduled(a.run, b.run))
    this.byId.set(run.id, entry)
    return entry
  }

  /** 取队首（最早的 pending Run），不移除。 */
  peek(): QueuedRun | undefined {
    return this.items[0]
  }

  /** 取出队首并移除。 */
  dequeue(): QueuedRun | undefined {
    const entry = this.items.shift()
    if (entry !== undefined) this.byId.delete(entry.run.id)
    return entry
  }

  /** 按 id 取队列条目。 */
  get(runId: AutomationId): QueuedRun | undefined {
    return this.byId.get(runId)
  }

  /** 取消并移除指定 Run（pending 取消）。返回是否移除。 */
  cancel(runId: AutomationId, reason?: string): boolean {
    const entry = this.byId.get(runId)
    if (entry === undefined) return false
    entry.cancel(reason)
    this.remove(runId)
    return true
  }

  /** 移除指定 Run（不触发取消信号）。 */
  remove(runId: AutomationId): boolean {
    const index = this.items.findIndex(item => item.run.id === runId)
    if (index === -1) return false
    this.items.splice(index, 1)
    this.byId.delete(runId)
    return true
  }

  /** 清空（取消全部 pending）。 */
  clear(reason = '服务停止'): void {
    for (const entry of this.items) entry.cancel(reason)
    this.items.length = 0
    this.byId.clear()
  }

  /** 等待中的 Run id 集合。 */
  pendingIds(): AutomationId[] {
    return this.items.map(item => item.run.id)
  }

  /** 当前队列里所有 Run（按调度顺序）。 */
  all(): Run[] {
    return this.items.map(item => item.run)
  }

  /** 队列内状态统计（调试 / 状态页）。 */
  statusCounts(): Partial<Record<RunStatus, number>> {
    const counts: Partial<Record<RunStatus, number>> = {}
    for (const item of this.items) {
      counts[item.run.status] = (counts[item.run.status] ?? 0) + 1
    }
    return counts
  }
}
