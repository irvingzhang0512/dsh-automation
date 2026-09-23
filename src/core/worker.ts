/**
 * Worker：真正执行一个 Run 的 Action。
 *
 * 执行器抽象：ActionExecutor 由宿主提供（Skill / Agent Prompt 需要 DSH
 * agent runtime），Command / Script 由本插件内置（child_process）。
 * Worker 本身不感知具体执行器，只负责：
 * - 调用执行器（带取消信号）；
 * - 收集输出 / 错误 / 退出码；
 * - 尊重超时（由 Run Manager 通过 AbortSignal 传递）。
 */
import type { ActionSpec, Run, Task } from '../shared/types.ts'

/** 执行结果。 */
export interface ActionExecutionResult {
  output: string
  error?: string
  exit_code?: number
}

/** 日志回调（追加到 Run 日志）。 */
export type ActionLogFn = (line: string) => void

/** 执行器契约。 */
export interface ActionExecutor {
  /** 执行一次 Action；signal 中止时尽快收敛。 */
  execute(
    task: Task,
    action: ActionSpec,
    options: { signal: AbortSignal; log: ActionLogFn },
  ): Promise<ActionExecutionResult>
}

/** 执行上下文：任务 + 执行器解析器。 */
export interface WorkerDeps {
  /** 按 Action 类型解析执行器（skill/agent_prompt → 宿主实现；command/script → 内置）。 */
  resolveExecutor(action: ActionSpec): ActionExecutor | undefined
}

/** Worker：驱动一次 Run 的执行。 */
export class AutomationWorker {
  constructor(private readonly deps: WorkerDeps) {}

  /**
   * 执行一个 Run（调用方负责状态流转；本方法只做执行本身）。
   * @returns 执行结果；执行器缺失时返回结构化错误。
   */
  async execute(task: Task, run: Run, signal: AbortSignal, log: ActionLogFn): Promise<ActionExecutionResult> {
    const executor = this.deps.resolveExecutor(task.action)
    if (executor === undefined) {
      const error = `不支持的 Action 类型：${task.action.type}（宿主未提供对应执行器）。`
      log(`[error] ${error}`)
      return { output: '', error, exit_code: 1 }
    }
    try {
      log(`[action] 开始执行 ${task.action.type} Action。`)
      const result = await executor.execute(task, task.action, { signal, log })
      if (signal.aborted) {
        const error = '执行已被取消。'
        log(`[error] ${error}`)
        return { ...result, error: result.error ?? error }
      }
      return result
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      log(`[error] 执行异常：${error}`)
      return { output: '', error, exit_code: 1 }
    }
  }
}
