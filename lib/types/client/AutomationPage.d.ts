/**
 * AutomationPage —— dsh-automation 主面板。
 *
 * 布局：顶部标题 + 状态条，下方四个 Tab：
 *   - 任务（列表 + 新建/编辑 Drawer + 详情抽屉）
 *   - 待运行（Upcoming）
 *   - 运行中（Running）
 *   - 历史（History + Run 详情抽屉）
 *
 * 数据全部来自 /api/automation（api.ts）。无额外运行时依赖（纯 React）。
 */
import { createElement } from 'react';
/** 页面根组件。 */
export declare function AutomationPage(): ReturnType<typeof createElement>;
/** Action 的人类可读标签。 */
export declare function actionLabel(action: {
    type: string;
    skill?: string;
    agent?: string;
    command?: string;
    path?: string;
}): string;
/** Trigger 配置的人类可读标签。 */
export declare function triggerLabel(config: Record<string, unknown>): string;
/** 运行状态标签。 */
export declare function statusLabel(status: string): string;
/** 运行状态颜色。 */
export declare function statusColor(status: string): string;
