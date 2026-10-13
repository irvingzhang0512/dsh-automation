import type { OwnerSettings } from '../shared/settings.ts';
/**
 * 浏览器端 /api/automation 客户端。
 *
 * 纯 fetch 封装：请求与响应均为 JSON。所有接口返回统一信封
 * `{ ok, code, message, ... }`（与工具一致）。错误时 throw ApiError。
 */
/** 基础 URL（同源 /api/automation）。 */
export declare const API_BASE = "/api/automation";
/** API 错误。 */
export declare class ApiError extends Error {
    readonly code: string;
    readonly status: number;
    constructor(status: number, code: string, message: string);
}
/** 统一信封（额外字段保留）。 */
export interface Envelope {
    ok: boolean;
    code: string;
    message: string;
    [key: string]: unknown;
}
export interface ActionSpecWire {
    type: 'skill' | 'agent_prompt' | 'command' | 'script';
    skill?: string;
    prompt?: string;
    agent?: string;
    command?: string;
    args?: string[];
    shell?: boolean;
    path?: string;
    interpreter?: string;
}
export interface TaskWire {
    id: string;
    name: string;
    description?: string;
    enabled: boolean;
    action: ActionSpecWire;
    context?: {
        cwd?: string;
        env?: Record<string, string>;
    };
    concurrency?: 'skip' | 'queue' | 'parallel';
    retry?: {
        enabled: boolean;
        max_attempts?: number;
        delay_seconds?: number;
    };
    timeout_seconds?: number;
    created_by?: string;
    created_at: string;
    updated_at: string;
}
export interface TriggerWire {
    id: string;
    task_id: string;
    config: Record<string, unknown>;
    enabled: boolean;
    created_at: string;
    updated_at: string;
}
export interface RunWire {
    id: string;
    task_id: string;
    trigger_id: string;
    scheduled_at: string;
    started_at?: string;
    finished_at?: string;
    status: string;
    attempt: number;
    output?: string;
    error?: string;
    exit_code?: number;
    created_at: string;
    updated_at: string;
}
export interface UpcomingWire {
    run_id: string;
    task_id: string;
    task_name: string;
    trigger_id: string;
    trigger_label: string;
    scheduled_at: string;
    action: ActionSpecWire;
}
export interface RunningWire {
    run_id: string;
    task_id: string;
    task_name: string;
    started_at: string;
    elapsed_ms: number;
    action: ActionSpecWire;
}
export interface HistoryWire {
    run_id: string;
    task_id: string;
    task_name: string;
    scheduled_at: string;
    started_at?: string;
    finished_at?: string;
    status: string;
    duration_ms?: number;
    error?: string;
}
export declare const api: {
    settings: () => Promise<Envelope & {
        owners: OwnerSettings[];
        compatibility?: {
            matched: boolean;
            reasons: string[];
        };
    }>;
    saveSettings: (body: unknown) => Promise<Envelope & {
        owners: OwnerSettings[];
    }>;
    migration: () => Promise<any>;
    mutateMigration: (body: unknown) => Promise<any>;
    /** 服务状态。 */
    status: () => Promise<Envelope & {
        status: {
            running: boolean;
            queued: number;
            active: number;
            homeDir: string;
        };
    }>;
    /** 列出任务。 */
    listTasks: () => Promise<Envelope & {
        tasks: TaskWire[];
    }>;
    /** 任务详情（含 triggers / runs）。 */
    getTask: (id: string) => Promise<Envelope & {
        task: TaskWire;
        triggers: TriggerWire[];
        runs: RunWire[];
    }>;
    /** 创建任务。 */
    createTask: (input: Record<string, unknown>) => Promise<Envelope & {
        task: TaskWire;
    }>;
    /** 更新任务。 */
    updateTask: (id: string, patch: Record<string, unknown>) => Promise<Envelope & {
        task: TaskWire;
    }>;
    /** 删除任务。 */
    deleteTask: (id: string) => Promise<Envelope>;
    /** 立即运行。 */
    runNow: (id: string) => Promise<Envelope & {
        run_id?: string;
    }>;
    /** 添加执行时间。 */
    addTrigger: (taskId: string, config: Record<string, unknown>) => Promise<Envelope & {
        trigger: TriggerWire;
    }>;
    /** 更新执行时间。 */
    updateTrigger: (id: string, patch: Record<string, unknown>) => Promise<Envelope & {
        trigger: TriggerWire;
    }>;
    /** 删除执行时间。 */
    deleteTrigger: (id: string) => Promise<Envelope>;
    /** 待运行。 */
    listUpcoming: () => Promise<Envelope & {
        upcoming: UpcomingWire[];
    }>;
    /** 运行中。 */
    listRunning: () => Promise<Envelope & {
        running: RunningWire[];
    }>;
    /** 历史（可按任务 / 状态筛选）。 */
    listHistory: (filter?: {
        taskId?: string;
        status?: string;
        limit?: number;
    }) => Promise<Envelope & {
        runs: HistoryWire[];
    }>;
    /** 运行详情。 */
    getRun: (id: string) => Promise<Envelope & {
        run: RunWire;
        logs: string[];
    }>;
    /** 取消运行。 */
    cancelRun: (id: string) => Promise<Envelope>;
};
