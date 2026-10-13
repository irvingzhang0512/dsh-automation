/** 运行中管理器。 */
export class RunManager {
    deps;
    active = new Map();
    constructor(deps) {
        this.deps = deps;
    }
    /** 当前运行中数量。 */
    get size() {
        return this.active.size;
    }
    /** 是否在运行中。 */
    isRunning(runId) {
        return this.active.has(runId);
    }
    /** 指定任务是否有正在运行的 Run。 */
    hasRunningForTask(taskId) {
        for (const entry of this.active.values()) {
            if (entry.task.id === taskId)
                return true;
        }
        return false;
    }
    /** 登记一个 Run 开始运行。返回活动条目。 */
    start(run, task) {
        const controller = new AbortController();
        const entry = {
            run: { ...run, status: 'running', started_at: new Date().toISOString() },
            task,
            startedAt: Date.now(),
            controller,
        };
        this.deps.updateRun(run.id, { status: 'running', started_at: entry.run.started_at });
        const timeoutSeconds = task.timeout_seconds ?? this.deps.defaultTimeoutSeconds;
        if (timeoutSeconds > 0) {
            const deadline = Date.now() + timeoutSeconds * 1000;
            const arm = () => {
                entry.timer = setTimeout(() => {
                    if (Date.now() < deadline)
                        arm();
                    else
                        this.timeout(entry);
                }, Math.min(deadline - Date.now(), 2147483647));
                entry.timer?.unref?.();
            };
            arm();
        }
        this.active.set(run.id, entry);
        return entry;
    }
    /** 取消一个运行中的 Run（abort 执行；状态由 onFinish 收敛）。 */
    cancel(runId, reason = '用户取消') {
        const entry = this.active.get(runId);
        if (entry === undefined)
            return false;
        if (!entry.controller.signal.aborted) {
            entry.controller.abort(reason);
        }
        this.deps.appendRunLog(runId, `[cancel] ${reason}`);
        return true;
    }
    /** 超时收敛。 */
    timeout(entry) {
        const runId = entry.run.id;
        if (!this.active.has(runId))
            return;
        const timeoutSeconds = entry.task.timeout_seconds ?? this.deps.defaultTimeoutSeconds;
        this.deps.appendRunLog(runId, `[timeout] 超过 ${timeoutSeconds}s 未完成，终止执行。`);
        if (!entry.controller.signal.aborted) {
            entry.controller.abort('timeout');
        }
        // 执行器收敛后由 finish() 落定时状态；这里先标记。
    }
    /** 标记运行结束（成功 / 失败 / 取消 / 超时），移出集合并回调。 */
    finish(runId, finalStatus) {
        const entry = this.active.get(runId);
        if (entry === undefined)
            return undefined;
        this.active.delete(runId);
        if (entry.timer !== undefined)
            clearTimeout(entry.timer);
        this.deps.onFinish(entry, finalStatus);
        return entry;
    }
    /** 强制终止全部运行中 Run（服务停止）。 */
    abortAll(reason = '服务停止') {
        for (const entry of this.active.values()) {
            if (!entry.controller.signal.aborted) {
                entry.controller.abort(reason);
            }
            this.deps.appendRunLog(entry.run.id, `[cancel] ${reason}`);
        }
    }
    /** 当前运行中视图（含耗时）。 */
    runningList() {
        const now = Date.now();
        const list = [];
        for (const entry of this.active.values()) {
            list.push({
                run_id: entry.run.id,
                task_id: entry.task.id,
                task_name: entry.task.name,
                started_at: entry.run.started_at ?? new Date(entry.startedAt).toISOString(),
                elapsed_ms: now - entry.startedAt,
                action: entry.task.action,
            });
        }
        return list.sort((a, b) => a.started_at.localeCompare(b.started_at));
    }
    /** 清空（不触发回调，服务卸载用）。 */
    dispose() {
        for (const entry of this.active.values()) {
            if (entry.timer !== undefined)
                clearTimeout(entry.timer);
        }
        this.active.clear();
    }
}
