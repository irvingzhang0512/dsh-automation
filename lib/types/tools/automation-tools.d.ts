import type { AutomationService } from '../core/service.ts';
/** 全部工具名（SKILL / docs 契约测试用）。 */
export declare const AUTOMATION_TOOL_NAMES: readonly ["automation_create_task", "automation_update_task", "automation_delete_task", "automation_get_task", "automation_list_tasks", "automation_enable_task", "automation_disable_task", "automation_add_trigger", "automation_update_trigger", "automation_delete_trigger", "automation_list_upcoming_runs", "automation_list_running_runs", "automation_list_history", "automation_get_run", "automation_run_now", "automation_cancel_run"];
export type AutomationToolName = (typeof AUTOMATION_TOOL_NAMES)[number];
/** 工具依赖：核心服务。 */
export interface AutomationToolDeps {
    service: AutomationService;
}
export declare function registerAutomationTools(ctx: {
    tools: {
        register(tool: unknown): () => void;
    };
}, deps: AutomationToolDeps): () => void;
