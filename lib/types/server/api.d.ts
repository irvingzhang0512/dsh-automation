/**
 * /api/automation REST 路由（需求 §25）。
 *
 * 接口（前缀 /api/automation）：
 *   GET    /tasks               列出任务
 *   POST   /tasks               创建任务
 *   GET    /tasks/:id           任务详情（含 trigger / runs）
 *   PATCH  /tasks/:id           更新任务
 *   DELETE /tasks/:id           删除任务
 *   POST   /tasks/:id/run       立即运行
 *   GET    /triggers            列出全部执行时间
 *   POST   /tasks/:id/triggers  添加执行时间
 *   PATCH  /triggers/:id        更新执行时间
 *   DELETE /triggers/:id        删除执行时间
 *   GET    /upcoming            待运行
 *   GET    /running             运行中
 *   GET    /history             历史
 *   GET    /runs                运行列表
 *   GET    /runs/:id            运行详情（含日志）
 *   POST   /runs/:id/cancel     取消运行
 *   GET    /status              服务状态
 *
 * 信任围栏：与 DSH /api 网关一致（trustedHosts）。body 解析限制 1MB。
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { AutomationService } from '../core/service.ts';
import type { AutomationWebRuntime } from '../context-types.ts';
/** 路由定义。 */
export interface ApiRoute {
    method: string;
    path: string;
    handler: (req: IncomingMessage, res: ServerResponse, params: Record<string, string>, body: unknown) => Promise<void> | void;
}
/** 构造全部路由。 */
export declare function automationRoutes(service: AutomationService): ApiRoute[];
/** 挂载全部路由到 webServer，返回 disposer。 */
export declare function mountAutomationRoutes(ctx: {
    webServer: {
        register(route: {
            kind: 'prefix';
            path: string;
            handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>;
        }): () => void;
    };
    webRuntime: AutomationWebRuntime;
}, service: AutomationService, extensions?: ApiRoute[]): () => void;
