/** Worker：驱动一次 Run 的执行。 */
export class AutomationWorker {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    /**
     * 执行一个 Run（调用方负责状态流转；本方法只做执行本身）。
     * @returns 执行结果；执行器缺失时返回结构化错误。
     */
    async execute(task, run, signal, log) {
        const executor = this.deps.resolveExecutor(task.action);
        if (executor === undefined) {
            const error = `不支持的 Action 类型：${task.action.type}（宿主未提供对应执行器）。`;
            log(`[error] ${error}`);
            return { output: '', error, exit_code: 1 };
        }
        try {
            log(`[action] 开始执行 ${task.action.type} Action。`);
            const result = await executor.execute(task, task.action, { signal, log });
            if (signal.aborted) {
                const error = '执行已被取消。';
                log(`[error] ${error}`);
                return { ...result, error: result.error ?? error };
            }
            return result;
        }
        catch (err) {
            const error = err instanceof Error ? err.message : String(err);
            log(`[error] 执行异常：${error}`);
            return { output: '', error, exit_code: 1 };
        }
    }
}
