import type { ReactElement } from 'react';
/** 页面根组件。 */
export interface AutomationPageProps {
    embedded?: boolean;
    createRequest?: number;
    onCreateConsumed?: (request: number) => void;
    registerLeaveGuard?: (guard: () => boolean) => () => void;
}
export declare function AutomationPage(props?: AutomationPageProps): ReactElement;
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
