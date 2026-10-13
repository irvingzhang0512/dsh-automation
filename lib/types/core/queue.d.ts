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
import type { AutomationId, Run, RunStatus } from '../shared/types.ts';
/** 可取消的排队任务。 */
export interface QueuedRun {
    run: Run;
    /** 取消信号：取消执行（cancel_run / 服务停止）。 */
    signal: AbortSignal;
    cancel: (reason?: string) => void;
}
/** 内存优先级队列（按 scheduled_at 排序）。 */
export declare class TaskQueue {
    private readonly items;
    private readonly byId;
    get size(): number;
    /** 排队一个 Run。 */
    enqueue(run: Run): QueuedRun;
    /** 取队首（最早的 pending Run），不移除。 */
    peek(): QueuedRun | undefined;
    /** 取出队首并移除。 */
    dequeue(): QueuedRun | undefined;
    /** 按 id 取队列条目。 */
    get(runId: AutomationId): QueuedRun | undefined;
    /** 取消并移除指定 Run（pending 取消）。返回是否移除。 */
    cancel(runId: AutomationId, reason?: string): boolean;
    /** 移除指定 Run（不触发取消信号）。 */
    remove(runId: AutomationId): boolean;
    /** 清空（取消全部 pending）。 */
    clear(reason?: string): void;
    /** 等待中的 Run id 集合。 */
    pendingIds(): AutomationId[];
    /** 当前队列里所有 Run（按调度顺序）。 */
    all(): Run[];
    /** 队列内状态统计（调试 / 状态页）。 */
    statusCounts(): Partial<Record<RunStatus, number>>;
}
