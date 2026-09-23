import { describe, expect, it } from 'vitest'
import {
  nextOccurrence, normalizeTrigger, parseCronExpr, parseTimeOfDay,
  TriggerConfigError, triggerLabel, nextOccurrenceOf,
} from '../src/shared/time.ts'
import type { TriggerConfig } from '../src/shared/types.ts'

describe('parseTimeOfDay', () => {
  it('解析合法时刻', () => {
    expect(parseTimeOfDay('09:00')).toEqual({ hour: 9, minute: 0 })
    expect(parseTimeOfDay('18:30')).toEqual({ hour: 18, minute: 30 })
  })
  it('拒绝越界时刻', () => {
    expect(() => parseTimeOfDay('24:00')).toThrow(TriggerConfigError)
    expect(() => parseTimeOfDay('09:60')).toThrow(TriggerConfigError)
    expect(() => parseTimeOfDay('nine')).toThrow(TriggerConfigError)
  })
})

describe('parseCronExpr', () => {
  it('解析标准 5 字段', () => {
    const cron = parseCronExpr('0 18 * * *')
    expect(cron.minute.values.has(0)).toBe(true)
    expect(cron.hour.values.has(18)).toBe(true)
    expect(cron.dayOfMonth.all).toBe(true)
    expect(cron.month.all).toBe(true)
    expect(cron.dayOfWeek.all).toBe(true)
  })
  it('支持范围与步进', () => {
    const cron = parseCronExpr('*/15 9-17 * * 1-5')
    expect(cron.minute.all).toBe(false)
    expect([...cron.minute.values]).toEqual([0, 15, 30, 45])
    expect([...cron.hour.values]).toEqual([9, 10, 11, 12, 13, 14, 15, 16, 17])
    expect([...cron.dayOfWeek.values]).toEqual([1, 2, 3, 4, 5])
  })
  it('拒绝错误字段数', () => {
    expect(() => parseCronExpr('0 18 * *')).toThrow(TriggerConfigError)
    expect(() => parseCronExpr('0 18 * * * *')).toThrow(TriggerConfigError)
  })
})

describe('normalizeTrigger', () => {
  it('校验 daily', () => {
    const n = normalizeTrigger({ type: 'daily', time: '08:00' })
    expect(n.kind).toBe('daily')
    expect(n.time).toEqual({ hour: 8, minute: 0 })
  })
  it('校验 hourly 默认分钟', () => {
    expect(normalizeTrigger({ type: 'hourly' }).minute).toBe(0)
    expect(normalizeTrigger({ type: 'hourly', minute: 15 }).minute).toBe(15)
  })
  it('拒绝空 weekday 列表', () => {
    expect(() => normalizeTrigger({ type: 'weekday', weekdays: [], time: '09:00' })).toThrow(TriggerConfigError)
  })
  it('校验 once ISO', () => {
    expect(normalizeTrigger({ type: 'once', at: '2026-09-23T09:00:00' }).onceAt).toBeGreaterThan(0)
    expect(() => normalizeTrigger({ type: 'once', at: 'not-a-date' })).toThrow(TriggerConfigError)
  })
})

describe('nextOccurrence', () => {
  const from = new Date(2026, 8, 23, 8, 0, 0).getTime() // 2026-09-23 08:00

  it('daily：当天 09:00', () => {
    const n = normalizeTrigger({ type: 'daily', time: '09:00' })
    const next = nextOccurrence(n, from)!
    expect(new Date(next).getHours()).toBe(9)
    expect(new Date(next).getMinutes()).toBe(0)
    expect(new Date(next).getDate()).toBe(23)
  })

  it('daily：当天已过 → 次日', () => {
    const n = normalizeTrigger({ type: 'daily', time: '07:00' })
    const next = nextOccurrence(n, from)!
    expect(new Date(next).getDate()).toBe(24)
    expect(new Date(next).getHours()).toBe(7)
  })

  it('hourly：下一个整点', () => {
    const n = normalizeTrigger({ type: 'hourly' })
    const next = nextOccurrence(n, from)!
    expect(new Date(next).getHours()).toBe(9)
    expect(new Date(next).getMinutes()).toBe(0)
  })

  it('hourly：指定分钟', () => {
    const n = normalizeTrigger({ type: 'hourly', minute: 30 })
    const next = nextOccurrence(n, from)!
    expect(new Date(next).getMinutes()).toBe(30)
  })

  it('weekly：本周五 → 下周五', () => {
    // 2026-09-23 是周三。
    const n = normalizeTrigger({ type: 'weekly', weekday: 5, time: '10:00' })
    const next = nextOccurrence(n, from)!
    const d = new Date(next)
    expect(d.getDay()).toBe(5)
    expect(d.getHours()).toBe(10)
  })

  it('weekday：周一/周三/周五', () => {
    const n = normalizeTrigger({ type: 'weekday', weekdays: [1, 3, 5], time: '12:00' })
    const next = nextOccurrence(n, from)!
    const d = new Date(next)
    expect([1, 3, 5]).toContain(d.getDay())
    expect(next).toBeGreaterThan(from)
  })

  it('monthly：每月 1 日', () => {
    const n = normalizeTrigger({ type: 'monthly', day: 1, time: '00:30' })
    const next = nextOccurrence(n, from)!
    const d = new Date(next)
    expect(d.getDate()).toBe(1)
    expect(d.getMonth()).toBe(9) // 10 月
  })

  it('once：未来触发，过期返回 undefined', () => {
    const future = new Date(2026, 8, 23, 12, 0, 0).getTime()
    expect(nextOccurrence(normalizeTrigger({ type: 'once', at: new Date(future).toISOString() }), from)).toBe(future)
    const past = new Date(2026, 8, 22, 12, 0, 0).getTime()
    expect(nextOccurrence(normalizeTrigger({ type: 'once', at: new Date(past).toISOString() }), from)).toBeUndefined()
  })

  it('cron：每天 18:00', () => {
    const n = normalizeTrigger({ type: 'cron', expr: '0 18 * * *' })
    const next = nextOccurrence(n, from)!
    const d = new Date(next)
    expect(d.getHours()).toBe(18)
    expect(d.getMinutes()).toBe(0)
    expect(next).toBeGreaterThan(from)
  })

  it('cron：工作日 9 点', () => {
    const n = normalizeTrigger({ type: 'cron', expr: '0 9 * * 1-5' })
    const next = nextOccurrence(n, from)!
    const d = new Date(next)
    expect([1, 2, 3, 4, 5]).toContain(d.getDay())
    expect(d.getHours()).toBe(9)
  })
})

describe('triggerLabel', () => {
  it('生成人类可读标签', () => {
    expect(triggerLabel({ type: 'daily', time: '18:00' })).toBe('每天 18:00')
    expect(triggerLabel({ type: 'cron', expr: '0 18 * * *' })).toBe('Cron 0 18 * * *')
    expect(triggerLabel({ type: 'weekly', weekday: 5, time: '17:00' })).toBe('每星期五 17:00')
  })
})

describe('nextOccurrenceOf 便捷', () => {
  it('直接由配置计算', () => {
    const config: TriggerConfig = { type: 'daily', time: '09:00' }
    const next = nextOccurrenceOf(config, new Date(2026, 8, 23, 8, 0, 0).getTime())!
    expect(new Date(next).getHours()).toBe(9)
  })
})
