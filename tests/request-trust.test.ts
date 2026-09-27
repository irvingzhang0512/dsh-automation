/**
 * 信任围栏（shared/request-trust）单元测试。
 *
 * 回归背景：0.2.1 的围栏只做 `trustedHosts.includes(origin)`，默认 loopback
 * 部署下 trustedHosts 为空，浏览器所有带 Origin 的 POST（立即运行等）
 * 全部 403「来源不被信任」。这里按宿主网关语义逐条锁定。
 */
import { describe, expect, it } from 'vitest'
import { isLoopbackHostname, isTrustedApiRequest } from '../src/shared/request-trust.ts'

/** 构造请求事实（headers 子集）。 */
function req(headers: Record<string, string>): { headers: Record<string, string> } {
  return { headers }
}

describe('isLoopbackHostname', () => {
  it('认得 localhost / [::1] / 127.x.x.x，拒绝其它', () => {
    expect(isLoopbackHostname('localhost')).toBe(true)
    expect(isLoopbackHostname('[::1]')).toBe(true)
    expect(isLoopbackHostname('127.0.0.1')).toBe(true)
    expect(isLoopbackHostname('127.7.7.7')).toBe(true)
    expect(isLoopbackHostname('1270.0.1')).toBe(false)
    expect(isLoopbackHostname('192.168.1.5')).toBe(false)
    expect(isLoopbackHostname('example.com')).toBe(false)
  })
})

describe('isTrustedApiRequest（loopback 部署，trustedHosts 为空）', () => {
  const hosts: readonly string[] = []

  it('浏览器同源 POST：Host 与 Origin 同主机 → 放行（回归：立即运行 403）', () => {
    expect(isTrustedApiRequest(req({
      host: '127.0.0.1:3080',
      origin: 'http://127.0.0.1:3080',
      'content-type': 'application/json',
    }), hosts)).toBe(true)
  })

  it('浏览器同源 POST（localhost 访问）→ 放行', () => {
    expect(isTrustedApiRequest(req({
      host: 'localhost:3080',
      origin: 'http://localhost:3080',
    }), hosts)).toBe(true)
  })

  it('浏览器同源 POST（IPv6 loopback）→ 放行', () => {
    expect(isTrustedApiRequest(req({
      host: '[::1]:3080',
      origin: 'http://[::1]:3080',
    }), hosts)).toBe(true)
  })

  it('无 Origin 的 GET（页面加载 / 列表）→ 放行', () => {
    expect(isTrustedApiRequest(req({ host: '127.0.0.1:3080' }), hosts)).toBe(true)
  })

  it('跨站 POST（恶意页面的 Origin）→ 拒绝', () => {
    expect(isTrustedApiRequest(req({
      host: '127.0.0.1:3080',
      origin: 'http://evil.example',
    }), hosts)).toBe(false)
  })

  it('sec-fetch-site: cross-site 一律拒绝', () => {
    expect(isTrustedApiRequest(req({
      host: '127.0.0.1:3080',
      'sec-fetch-site': 'cross-site',
    }), hosts)).toBe(false)
  })

  it('缺失 Host 头 → 拒绝（与宿主网关一致）', () => {
    expect(isTrustedApiRequest(req({}), hosts)).toBe(false)
  })

  it('Origin 非法 URL → 拒绝', () => {
    expect(isTrustedApiRequest(req({
      host: '127.0.0.1:3080',
      origin: 'not-a-url',
    }), hosts)).toBe(false)
  })
})

describe('isTrustedApiRequest（非 loopback 部署）', () => {
  it('Host 匹配无端口 trustedHosts 条目（任意端口）→ 放行', () => {
    expect(isTrustedApiRequest(req({ host: '192.168.1.5:4000' }), ['192.168.1.5'])).toBe(true)
  })

  it('Host 匹配带端口条目仅限精确权威', () => {
    expect(isTrustedApiRequest(req({ host: '192.168.1.5:3080' }), ['192.168.1.5:3080'])).toBe(true)
    expect(isTrustedApiRequest(req({ host: '192.168.1.5:4000' }), ['192.168.1.5:3080'])).toBe(false)
  })

  it('Host 不在 trustedHosts → 拒绝', () => {
    expect(isTrustedApiRequest(req({ host: '192.168.1.9:3080' }), ['192.168.1.5'])).toBe(false)
  })

  it('非 loopback 且同源 Origin → 放行', () => {
    expect(isTrustedApiRequest(req({
      host: '192.168.1.5:3080',
      origin: 'http://192.168.1.5:3080',
    }), ['192.168.1.5'])).toBe(true)
  })

  it('非 loopback 且跨站 Origin → 拒绝', () => {
    expect(isTrustedApiRequest(req({
      host: '192.168.1.5:3080',
      origin: 'http://evil.example',
    }), ['192.168.1.5'])).toBe(false)
  })
})
