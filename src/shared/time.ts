/**
 * Trigger 时间计算：纯函数，无副作用，可单测。
 *
 * 负责：
 * - 解析 Trigger 配置；
 * - 计算下一次运行时间（nextOccurrence）；
 * - Cron 表达式解析（标准 5 字段：分 时 日 月 周）。
 *
 * 时间语义：所有触发时间按本地时区解释（与 DSH 会话 cwd/本地一致）。
 * Once 的 `at` 若是带时区的 ISO 字符串则按该时刻换算为本地时间。
 */
import type { TriggerConfig } from './types.ts'

/** 解析失败错误。 */
export class TriggerConfigError extends Error {
  readonly code = 'INVALID_TRIGGER'
  constructor(message: string) {
    super(message)
    this.name = 'TriggerConfigError'
  }
}

/** 校验 "HH:mm"（24 小时制）。 */
export function parseTimeOfDay(value: string): { hour: number; minute: number } {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (match === null) throw new TriggerConfigError(`非法时刻 "${value}"，应为 HH:mm。`)
  const hour = Number(match[1]!)
  const minute = Number(match[2]!)
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    throw new TriggerConfigError(`时刻越界 "${value}"（hour 0-23，minute 0-59）。`)
  }
  return { hour, minute }
}

/** 校验 ISO 时刻（Once）。返回该时刻的 epoch ms；可带时区。 */
export function parseIsoInstant(value: string): number {
  const ms = Date.parse(value)
  if (Number.isNaN(ms)) throw new TriggerConfigError(`非法时刻 "${value}"，应为 ISO 8601 字符串。`)
  return ms
}

/** 规范化星期（JS getDay(): 0=周日 … 6=周六）。 */
export function normalizeWeekday(value: number): number {
  if (!Number.isInteger(value) || value < 0 || value > 6) {
    throw new TriggerConfigError(`非法星期 ${value}（0=周日 … 6=周六）。`)
  }
  return value
}

/** 规范化月份日（1-31）。 */
export function normalizeMonthDay(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > 31) {
    throw new TriggerConfigError(`非法月日 ${value}（1-31）。`)
  }
  return value
}

/** 规范化分钟（0-59）。 */
export function normalizeMinute(value: number): number {
  if (!Number.isInteger(value) || value < 0 || value > 59) {
    throw new TriggerConfigError(`非法分钟 ${value}（0-59）。`)
  }
  return value
}

/** 给定年月，该月天数。 */
export function daysInMonth(year: number, month: number): number {
  // month 1-12
  return new Date(year, month, 0).getDate()
}

/** 本地时区下 y/m/d h:m 的 epoch ms。 */
export function localEpoch(year: number, month: number, day: number, hour: number, minute: number): number {
  return new Date(year, month - 1, day, hour, minute, 0, 0).getTime()
}

/** 找到某月内第 `day` 天（超界裁剪到月末）的本地时刻。 */
function monthDayEpoch(year: number, month: number, day: number, hour: number, minute: number): number {
  const last = daysInMonth(year, month)
  return localEpoch(year, month, Math.min(day, last), hour, minute)
}

/* ------------------------------------------------------------------ */
/* Cron 解析                                                          */
/* ------------------------------------------------------------------ */

/** 一个 cron 字段的取值集合（升序、去重）。 */
export interface CronField {
  /** 是否 `*`（全部取值）。 */
  all: boolean
  /** 显式取值集合（all=false 时）。 */
  values: ReadonlySet<number>
}

/** 解析后的 cron 表达式。 */
export interface ParsedCron {
  minute: CronField
  hour: CronField
  dayOfMonth: CronField
  month: CronField
  dayOfWeek: CronField
}

/** 校验整数在 [min, max]。 */
function checkRange(name: string, value: number, min: number, max: number): void {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new TriggerConfigError(`cron 字段 ${name} 越界：${value}（允许 ${min}-${max}）。`)
  }
}

/** 解析单个 cron 字段（支持 *、数字、范围、步进、列表）。 */
export function parseCronField(name: string, raw: string, min: number, max: number): CronField {
  const text = raw.trim()
  if (text === '') throw new TriggerConfigError(`cron 字段 ${name} 为空。`)
  if (text === '*') return { all: true, values: new Set() }
  const values = new Set<number>()
  for (const part of text.split(',')) {
    if (part === '') throw new TriggerConfigError(`cron 字段 ${name} 含空项。`)
    const stepMatch = /^(.+?)\/(\d+)$/.exec(part)
    const step = stepMatch !== null ? Number(stepMatch[2]!) : 1
    if (!Number.isInteger(step) || step < 1) {
      throw new TriggerConfigError(`cron 字段 ${name} 步进非法：${part}。`)
    }
    const base = stepMatch !== null ? stepMatch[1]! : part
    let from: number
    let to: number
    if (base === '*') {
      from = min
      to = max
    } else {
      const rangeMatch = /^(\d+)-(\d+)$/.exec(base)
      if (rangeMatch !== null) {
        from = Number(rangeMatch[1]!)
        to = Number(rangeMatch[2]!)
        checkRange(name, from, min, max)
        checkRange(name, to, min, max)
        if (from > to) throw new TriggerConfigError(`cron 字段 ${name} 范围反转：${base}。`)
      } else {
        const single = /^\d+$/.exec(base)
        if (single === null) throw new TriggerConfigError(`cron 字段 ${name} 无法解析：${part}。`)
        from = Number(base)
        to = from
        checkRange(name, from, min, max)
      }
    }
    for (let v = from; v <= to; v += step) {
      values.add(v)
    }
  }
  if (values.size === 0) throw new TriggerConfigError(`cron 字段 ${name} 无有效取值。`)
  return { all: false, values }
}

/**
 * 解析标准 5 字段 cron 表达式（分 时 日 月 周）。
 * 周字段 0=周日 … 6=周六（与 JS getDay 一致）。
 * 语义：日字段与周字段均为 `*` 时按“或”匹配，否则按“与”匹配（标准 cron 行为）。
 */
export function parseCronExpr(expr: string): ParsedCron {
  const parts = expr.trim().split(/\s+/)
  if (parts.length !== 5) {
    throw new TriggerConfigError(`cron 表达式必须为 5 字段（分 时 日 月 周），收到 ${parts.length} 个：${expr}。`)
  }
  const [minuteRaw, hourRaw, dayRaw, monthRaw, weekRaw] = parts
  const minute = parseCronField('minute', minuteRaw!, 0, 59)
  const hour = parseCronField('hour', hourRaw!, 0, 23)
  const dayOfMonth = parseCronField('dayOfMonth', dayRaw!, 1, 31)
  const month = parseCronField('month', monthRaw!, 1, 12)
  const dayOfWeek = parseCronField('dayOfWeek', weekRaw!, 0, 6)
  return { minute, hour, dayOfMonth, month, dayOfWeek }
}

/** 字段是否匹配。 */
function fieldMatches(field: CronField, value: number): boolean {
  return field.all || field.values.has(value)
}

/* ------------------------------------------------------------------ */
/* 下一次运行时间                                                     */
/* ------------------------------------------------------------------ */

/** 规范化 Trigger 配置为统一校验后的内部表示。 */
export interface NormalizedTrigger {
  kind: TriggerConfig['type']
  /** once：epoch ms。 */
  onceAt?: number
  /** hourly。 */
  minute?: number
  /** daily / weekday / weekly / monthly。 */
  time?: { hour: number; minute: number }
  weekdays?: number[]
  weekday?: number
  monthDay?: number
  cron?: ParsedCron
}

/** 解析并规范化 Trigger 配置（创建 / 更新时校验）。 */
export function normalizeTrigger(config: TriggerConfig): NormalizedTrigger {
  switch (config.type) {
    case 'once':
      return { kind: 'once', onceAt: parseIsoInstant(config.at) }
    case 'hourly':
      return { kind: 'hourly', minute: config.minute === undefined ? 0 : normalizeMinute(config.minute) }
    case 'daily':
      return { kind: 'daily', time: parseTimeOfDay(config.time) }
    case 'weekday': {
      if (config.weekdays.length === 0) throw new TriggerConfigError('weekday 触发至少需要一个星期。')
      const weekdays = [...new Set(config.weekdays.map(normalizeWeekday))].sort((a, b) => a - b)
      return { kind: 'weekday', weekdays, time: parseTimeOfDay(config.time) }
    }
    case 'weekly':
      return { kind: 'weekly', weekday: normalizeWeekday(config.weekday), time: parseTimeOfDay(config.time) }
    case 'monthly':
      return { kind: 'monthly', monthDay: normalizeMonthDay(config.day), time: parseTimeOfDay(config.time) }
    case 'cron':
      return { kind: 'cron', cron: parseCronExpr(config.expr) }
    default: {
      const exhaustive: never = config
      throw new TriggerConfigError(`未知 Trigger 类型：${(exhaustive as { type?: string }).type}`)
    }
  }
}

/** 人类可读的 Trigger 标签（Web / 工具展示）。 */
export function triggerLabel(config: TriggerConfig): string {
  switch (config.type) {
    case 'once':
      return `仅一次 · ${config.at}`
    case 'hourly':
      return config.minute === undefined || config.minute === 0 ? '每小时整点' : `每小时 :${String(config.minute).padStart(2, '0')}`
    case 'daily':
      return `每天 ${config.time}`
    case 'weekday':
      return `每星期${config.weekdays.map(w => ['日', '一', '二', '三', '四', '五', '六'][w]).join('、')} ${config.time}`
    case 'weekly':
      return `每星期${['日', '一', '二', '三', '四', '五', '六'][config.weekday]} ${config.time}`
    case 'monthly':
      return `每月 ${config.day} 日 ${config.time}`
    case 'cron':
      return `Cron ${config.expr}`
  }
}

/** 比较候选，取严格大于 from 的最小值。 */
function firstAfter(candidates: number[], from: number): number | undefined {
  let best: number | undefined
  for (const c of candidates) {
    if (c > from && (best === undefined || c < best)) best = c
  }
  return best
}

/**
 * 计算 Trigger 在 `from`（epoch ms，含）之后的第一次触发时刻。
 * @returns epoch ms；`once` 已过期返回 undefined。
 */
export function nextOccurrence(normalized: NormalizedTrigger, from: number): number | undefined {
  switch (normalized.kind) {
    case 'once': {
      const at = normalized.onceAt!
      return at > from ? at : undefined
    }
    case 'hourly': {
      const minute = normalized.minute!
      const d = new Date(from)
      // 从当前分钟之后找第一个 minute 匹配的整小时边界。
      const startMs = new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes() + 1, 0, 0).getTime()
      const start = new Date(startMs)
      let candidate = new Date(start.getFullYear(), start.getMonth(), start.getDate(), start.getHours(), minute, 0, 0).getTime()
      if (candidate <= from) {
        candidate = new Date(start.getFullYear(), start.getMonth(), start.getDate(), start.getHours() + 1, minute, 0, 0).getTime()
      }
      return candidate
    }
    case 'daily': {
      const { hour, minute } = normalized.time!
      const d = new Date(from)
      let candidate = localEpoch(d.getFullYear(), d.getMonth() + 1, d.getDate(), hour, minute)
      if (candidate <= from) {
        const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, hour, minute, 0, 0)
        candidate = next.getTime()
      }
      return candidate
    }
    case 'weekday': {
      const { hour, minute } = normalized.time!
      const weekdays = normalized.weekdays!
      const d = new Date(from)
      // 从今天起扫描最多 8 天。
      for (let offset = 0; offset <= 7; offset += 1) {
        const day = new Date(d.getFullYear(), d.getMonth(), d.getDate() + offset)
        if (!weekdays.includes(day.getDay())) continue
        const candidate = localEpoch(day.getFullYear(), day.getMonth() + 1, day.getDate(), hour, minute)
        if (candidate > from) return candidate
      }
      return undefined
    }
    case 'weekly': {
      const { hour, minute } = normalized.time!
      const weekday = normalized.weekday!
      const d = new Date(from)
      for (let offset = 0; offset <= 7; offset += 1) {
        const day = new Date(d.getFullYear(), d.getMonth(), d.getDate() + offset)
        if (day.getDay() !== weekday) continue
        const candidate = localEpoch(day.getFullYear(), day.getMonth() + 1, day.getDate(), hour, minute)
        if (candidate > from) return candidate
      }
      return undefined
    }
    case 'monthly': {
      const { hour, minute } = normalized.time!
      const monthDay = normalized.monthDay!
      const d = new Date(from)
      // 从本月起扫描最多 24 个月。
      for (let offset = 0; offset <= 24; offset += 1) {
        const year = d.getFullYear()
        const month = d.getMonth() + 1 + offset
        const y = year + Math.floor((month - 1) / 12)
        const m = ((month - 1) % 12) + 1
        const candidate = monthDayEpoch(y, m, monthDay, hour, minute)
        if (candidate > from) return candidate
      }
      return undefined
    }
    case 'cron': {
      const cron = normalized.cron!
      const d = new Date(from)
      const domStar = cron.dayOfMonth.all
      const dowStar = cron.dayOfWeek.all
      // 从当前分钟之后扫描（防止与 from 同一分钟重复触发）。
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes() + 1, 0, 0)
      // 最多扫描 5 年。
      const limit = start.getTime() + 5 * 366 * 24 * 3600 * 1000
      for (let cursor = start.getTime(); cursor <= limit;) {
        const dt = new Date(cursor)
        const year = dt.getFullYear()
        const month = dt.getMonth() + 1
        const day = dt.getDate()
        if (!fieldMatches(cron.month, month)) {
          // 跳到下月 1 日 00:00。
          const next = new Date(year, month, 1, 0, 0, 0, 0)
          cursor = next.getTime()
          continue
        }
        const domMatch = fieldMatches(cron.dayOfMonth, day)
        const dowMatch = fieldMatches(cron.dayOfWeek, dt.getDay())
        const dayMatches = domStar && dowStar ? true : domStar ? dowMatch : dowStar ? domMatch : domMatch && dowMatch
        if (!dayMatches) {
          // 跳到次日 00:00。
          const next = new Date(year, month - 1, day + 1, 0, 0, 0, 0)
          cursor = next.getTime()
          continue
        }
        const hour = dt.getHours()
        const minute = dt.getMinutes()
        if (fieldMatches(cron.hour, hour) && fieldMatches(cron.minute, minute)) {
          return cursor
        }
        // 前进 1 分钟。
        cursor += 60 * 1000
      }
      return undefined
    }
  }
}

/** 便捷：直接由 Trigger 配置计算下一次运行时间。 */
export function nextOccurrenceOf(config: TriggerConfig, from: number): number | undefined {
  return nextOccurrence(normalizeTrigger(config), from)
}
