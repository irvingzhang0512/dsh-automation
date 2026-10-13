/**
 * AutomationService：dsh-automation 的核心调度服务。
 *
 * 组装：
 * - Trigger Engine：轮询计算到期 Trigger，创建 Run 并入队；
 * - Task Queue：等待执行的 pending Run；
 * - Worker：真正执行 Action；
 * - Run Manager：运行中管理（取消 / 超时）；
 * - Retry：失败重试；
 * - Storage：SQLite 持久化。
 *
 * 生命周期：start() / stop()。与 Web 生命周期解耦——服务由宿主进程承载，
 * 客户端关闭不拥有任务生命周期；宿主关闭停止调度，重启按明确恢复规则处理。
 *
 * 并发策略（需求 §19）：
 * - skip（默认）：已有同任务运行中 → 本次 Run 标记 skipped；
 * - queue：等待上一次完成后执行（重新按计划时刻排队）；
 * - parallel：允许同时运行多个实例。
 */
import type { AutomationId, AutomationStore, AutomationResult, CreateTaskInput, HistoryRun, Run, RunStatus, Task, Trigger, TriggerConfig, TriggerInput, UpcomingRun } from '../shared/types.ts';
import { triggerLabel } from '../shared/time.ts';
import { type ActionExecutor } from './worker.ts';
/** 调度轮询间隔（ms）。 */
export declare const SCHEDULER_TICK_MS = 1000;
/** 服务配置。 */
export interface AutomationServiceOptions {
    /** 默认超时秒数（任务未配置时）；0 = 不限。 */
    defaultTimeoutSeconds?: number;
    /** 调度轮询间隔（测试可调）。 */
    tickMs?: number;
    /** 运行时配置提供者（settings 接入后优先于静态值）。 */
    configProvider?: () => {
        defaultTimeoutSeconds?: number;
        tickMs?: number;
        keepBackups?: number;
    };
    /** 日志写入器（服务级日志）。 */
    logger?: (line: string) => void;
}
/** 宿主依赖（执行器解析等）。 */
export interface AutomationHostDeps {
    /** 按直接 Action 类型解析执行器，旧模型动作不可执行。 */
    resolveExecutor(action: Task['action']): ActionExecutor | undefined;
    canExecute?: () => boolean;
    runtimeFacts?: () => unknown;
}
/** 服务状态。 */
export interface ServiceStatus {
    running: boolean;
    queued: number;
    active: number;
    tickMs: number;
    compatibility?: unknown;
    /** 数据目录（持久化位置）。 */
    homeDir: string;
    startedAt?: string;
}
/** 触发结果。 */
export interface TriggerResult {
    run?: Run;
    skipped?: boolean;
    reason?: string;
}
export declare class AutomationService {
    private readonly store;
    private readonly deps;
    private readonly options;
    private readonly logger;
    private readonly queue;
    private readonly worker;
    private readonly runManager;
    private schedule;
    private timer;
    private startedAt;
    private running;
    private stopped;
    private disposed;
    private readonly jobs;
    private quiescing;
    constructor(store: AutomationStore, deps: AutomationHostDeps, options?: AutomationServiceOptions);
    /** 启动调度循环（幂等）。 */
    start(): void;
    /** 停止调度循环（幂等；不终止已运行任务）。 */
    stop(): void;
    /** 服务当前状态。 */
    status(): ServiceStatus;
    /** 卸载：停止调度、终止运行中任务、关闭队列。 */
    dispose(): Promise<void>;
    quiesce(): Promise<void>;
    resume(): void;
    get busy(): boolean;
    private recoverLegacyAndInterrupted;
    /** 重建调度表（任务 / Trigger 变更后调用）。 */
    rebuildSchedule(): void;
    /** 一个调度 tick：触发到期项 + 消费队列。 */
    private tick;
    /** 触发一个 Trigger：创建 Run 并应用并发策略。 */
    private fireTrigger;
    /** 执行一个已出队的 Run（含重试与状态流转）。 */
    private runQueued;
    /** Run Manager 完成回调（落定时状态）。 */
    private finishActive;
    /** 全部任务（工具 list_tasks 用）。 */
    allTasks(): Task[];
    /** 全部 Trigger（API / 工具用）。 */
    allTriggers(): Trigger[];
    /** 获取单个 Run。 */
    getRun(runId: AutomationId): Run | undefined;
    /** 读取 Run 日志。 */
    readRunLog(runId: AutomationId): string[];
    /** 待运行视图（未来计划 + 队列中 pending）。 */
    listUpcoming(limit?: number): UpcomingRun[];
    /** 运行中视图。 */
    listRunning(): import('../shared/types.ts').RunningRun[];
    /** 历史视图。 */
    listHistory(filter?: {
        taskId?: string;
        status?: RunStatus;
        limit?: number;
    }): HistoryRun[];
    /** 立即运行任务（创建手动 Run 入队）。 */
    runNow(taskId: AutomationId): AutomationResult;
    /** 取消 Run：运行中 → 中止；队列中 → cancelled；已完成 → 无操作。 */
    cancelRun(runId: AutomationId): AutomationResult;
    createTask(input: CreateTaskInput, triggerConfigs?: TriggerConfig[]): AutomationResult;
    updateTask(id: AutomationId, patch: Partial<CreateTaskInput>): AutomationResult;
    deleteTask(id: AutomationId): AutomationResult;
    enableTask(id: AutomationId, enabled: boolean): AutomationResult;
    addTrigger(taskId: AutomationId, input: TriggerInput): AutomationResult;
    updateTrigger(id: AutomationId, patch: Partial<TriggerInput>): AutomationResult;
    deleteTrigger(id: AutomationId): AutomationResult;
    /** 获取任务及其 Trigger（详情页数据）。 */
    getTaskDetail(id: AutomationId): AutomationResult;
}
/** 便捷：Trigger 标签导出（工具/Web 用）。 */
export { triggerLabel };
export type { TriggerConfig };
export declare function isDirectAction(action: Task['action']): boolean;
