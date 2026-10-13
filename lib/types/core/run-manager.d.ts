/**
 * Run Manager：管理正在运行的 Run（running 集合）。
 *
 * 职责：
 * - 登记运行中 Run；
 * - 提供取消（cancel）与超时（timeout）控制；
 * - 汇报运行中列表（含耗时）。
 */
import type { AutomationId, RunningRun, Run, Task } from '../shared/types.ts';
/** 一个正在运行的条目。 */
export interface ActiveRun {
    run: Run;
    task: Task;
    startedAt: number;
    /** 控制信号：取消 / 超时都通过 abort 收敛执行。 */
    controller: AbortController;
    /** 超时定时器。 */
    timer?: ReturnType<typeof setTimeout>;
}
/** Run Manager 依赖（存储更新）。 */
export interface RunManagerDeps {
    updateRun(id: string, patch: Partial<Run>): Run | undefined;
    appendRunLog(runId: string, line: string): void;
    onFinish(active: ActiveRun, finalStatus: Run['status']): void;
    /** 默认超时秒数（无任务级配置时）。 */
    defaultTimeoutSeconds: number;
}
/** 运行中管理器。 */
export declare class RunManager {
    private readonly deps;
    private readonly active;
    constructor(deps: RunManagerDeps);
    /** 当前运行中数量。 */
    get size(): number;
    /** 是否在运行中。 */
    isRunning(runId: AutomationId): boolean;
    /** 指定任务是否有正在运行的 Run。 */
    hasRunningForTask(taskId: AutomationId): boolean;
    /** 登记一个 Run 开始运行。返回活动条目。 */
    start(run: Run, task: Task): ActiveRun;
    /** 取消一个运行中的 Run（abort 执行；状态由 onFinish 收敛）。 */
    cancel(runId: AutomationId, reason?: string): boolean;
    /** 超时收敛。 */
    private timeout;
    /** 标记运行结束（成功 / 失败 / 取消 / 超时），移出集合并回调。 */
    finish(runId: AutomationId, finalStatus: Run['status']): ActiveRun | undefined;
    /** 强制终止全部运行中 Run（服务停止）。 */
    abortAll(reason?: string): void;
    /** 当前运行中视图（含耗时）。 */
    runningList(): RunningRun[];
    /** 清空（不触发回调，服务卸载用）。 */
    dispose(): void;
}
