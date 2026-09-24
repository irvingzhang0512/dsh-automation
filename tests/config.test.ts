import { describe, expect, it } from 'vitest'
import { AutomationConfigSchema, DEFAULT_CONFIG, normalizeConfig } from '../src/host/config.ts'

describe('AutomationConfigSchema', () => {
  it('默认值正确', () => {
    expect(DEFAULT_CONFIG).toEqual({ dataDir: '', defaultTimeoutSeconds: 1800, tickMs: 1000, keepBackups: 10 })
  })

  it('schema 能解析合法值并应用默认', () => {
    const value = AutomationConfigSchema as unknown as (input: unknown) => unknown
    const resolved = value({ defaultTimeoutSeconds: 600 }) as Record<string, unknown>
    expect(resolved.defaultTimeoutSeconds).toBe(600)
    expect(resolved.tickMs).toBe(1000) // 未提供 → schema 默认
    expect(resolved.keepBackups).toBe(10)
  })
})

describe('normalizeConfig', () => {
  it('空/未定义 → 默认值', () => {
    expect(normalizeConfig(undefined)).toEqual(DEFAULT_CONFIG)
    expect(normalizeConfig(null)).toEqual(DEFAULT_CONFIG)
    expect(normalizeConfig({})).toEqual(DEFAULT_CONFIG)
  })

  it('合法字段透传', () => {
    const out = normalizeConfig({ dataDir: '/tmp/x', defaultTimeoutSeconds: 300, tickMs: 500, keepBackups: 3 })
    expect(out).toEqual({ dataDir: '/tmp/x', defaultTimeoutSeconds: 300, tickMs: 500, keepBackups: 3 })
  })

  it('非法/越界字段回退默认', () => {
    const out = normalizeConfig({ dataDir: 42, defaultTimeoutSeconds: -5, tickMs: 0, keepBackups: -1 })
    expect(out).toEqual(DEFAULT_CONFIG)
  })

  it('null 字段回退默认', () => {
    const out = normalizeConfig({ dataDir: null, defaultTimeoutSeconds: null, tickMs: null, keepBackups: null })
    expect(out).toEqual(DEFAULT_CONFIG)
  })
})
