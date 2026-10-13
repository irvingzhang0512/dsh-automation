import type { CommandActionSpec, ScriptActionSpec } from '../shared/types.ts';
import type { ActionExecutor, ActionLogFn, ActionExecutionResult } from '../core/worker.ts';
/** 生成一个执行器实例（无状态，可复用）。 */
export declare class ChildProcessExecutor implements ActionExecutor {
    execute(_task: {
        context?: {
            cwd?: string;
            env?: Record<string, string>;
        };
    }, action: CommandActionSpec | ScriptActionSpec, options: {
        signal: AbortSignal;
        log: ActionLogFn;
    }): Promise<ActionExecutionResult>;
}
/** 简单命令行分词（支持单双引号）。 */
export declare function tokenizeCommand(input: string): string[];
