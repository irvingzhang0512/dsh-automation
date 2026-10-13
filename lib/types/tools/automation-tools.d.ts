import type { AutomationService } from '../core/service.ts';
/** 全部工具名（SKILL / docs 契约测试用）。 */
export declare const AUTOMATION_TOOL_NAMES: readonly ["automation.create_task", "automation.update_task", "automation.delete_task", "automation.get_task", "automation.list_tasks", "automation.enable_task", "automation.disable_task", "automation.add_trigger", "automation.update_trigger", "automation.delete_trigger", "automation.list_upcoming_runs", "automation.list_running_runs", "automation.list_history", "automation.get_run", "automation.run_now", "automation.cancel_run"];
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
