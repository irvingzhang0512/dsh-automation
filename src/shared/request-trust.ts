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
import type { IncomingHttpHeaders } from 'node:http'

/** 围栏读取的请求事实（IncomingMessage 的结构子集）。 */
interface TrustRequest {
  headers: IncomingHttpHeaders
}

function header(headers: IncomingHttpHeaders, name: string): string | undefined {
  const value = headers[name]
  return typeof value === 'string' ? value : undefined
}

/** 解析 Host 头的权威（authority）；不可解析返回 undefined。 */
function parseAuthority(authority: string): URL | undefined {
  try {
    return new URL(`http://${authority}`)
  } catch {
    return undefined
  }
}

/** hostname 是否为本地回环。 */
export function isLoopbackHostname(hostname: string): boolean {
  if (hostname === 'localhost' || hostname === '[::1]') return true
  const parts = hostname.split('.')
  return parts.length === 4
    && parts[0] === '127'
    && parts.every(part => /^\d{1,3}$/.test(part) && Number(part) <= 255)
}

/** 请求权威是否匹配 trustedHosts 中的一条（无端口条目匹配该主机任意端口）。 */
function isTrustedAuthority(hostUrl: URL, trustedHosts: readonly string[]): boolean {
  return trustedHosts.some((entry) => {
    const entryUrl = parseAuthority(entry)
    if (entryUrl === undefined) return false
    return entryUrl.port === '' || entryUrl.port === '80' || entryUrl.port === '443'
      ? entryUrl.hostname === hostUrl.hostname
      : entryUrl.host === hostUrl.host
  })
}

/** 是否放行一条到达自动化 API / WebSocket 桥的请求。 */
export function isTrustedApiRequest(request: TrustRequest, trustedHosts: readonly string[]): boolean {
  const host = header(request.headers, 'host')
  if (host === undefined) return false
  const hostUrl = parseAuthority(host)
  if (hostUrl === undefined) return false
  if (!isLoopbackHostname(hostUrl.hostname) && !isTrustedAuthority(hostUrl, trustedHosts)) return false
  if (header(request.headers, 'sec-fetch-site') === 'cross-site') return false
  const origin = header(request.headers, 'origin')
  if (origin === undefined) return true
  try {
    return new URL(origin).hostname === hostUrl.hostname
  } catch {
    return false
  }
}
