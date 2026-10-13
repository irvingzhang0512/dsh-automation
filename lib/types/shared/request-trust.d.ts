/**
 * 浏览器信任围栏（trust fence），与 /api 网关及 dsh-better-sidebar 的
 * 围栏行为一致（复制自范式插件 dsh-structured-document-view）：
 * Host 回环或配置的可信权威放行；跨站浏览器标记拒绝。这是
 * DNS rebinding / 跨站防护，不是身份认证。
 *
 * 历史教训（0.2.1 及之前）：当时的围栏只做 `trustedHosts.includes(origin)`，
 * 没有 loopback 豁免、不校验 Host 头、无端口条目不匹配带端口 Origin——
 * 默认 loopback 部署下 trustedHosts 为空，浏览器所有带 Origin 的 POST
 * （立即运行 / 保存任务等）全部 403「来源不被信任」，而 GET（不带 Origin）
 * 正常，页面能开、按钮全挂。
 */
import type { IncomingHttpHeaders } from 'node:http';
/** 围栏读取的请求事实（IncomingMessage 的结构子集）。 */
interface TrustRequest {
    headers: IncomingHttpHeaders;
    socket?: {
        remoteAddress?: string;
    };
}
/** hostname 是否为本地回环。 */
export declare function isLoopbackHostname(hostname: string): boolean;
/** 是否放行一条到达自动化 API / WebSocket 桥的请求。 */
export declare function isTrustedApiRequest(request: TrustRequest, trustedHosts: readonly string[]): boolean;
export {};
