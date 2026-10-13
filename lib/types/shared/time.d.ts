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
import type { TriggerConfig } from './types.ts';
import type { ScheduleCreateRequest } from '@deepseek-ai/dsh-schedule';
/** 解析失败错误。 */
export declare class TriggerConfigError extends Error {
    readonly code = "INVALID_TRIGGER";
    constructor(message: string);
}
/** 校验 "HH:mm"（24 小时制）。 */
export declare function parseTimeOfDay(value: string): {
    hour: number;
    minute: number;
};
/** 校验 ISO 时刻（Once）。返回该时刻的 epoch ms；可带时区。 */
export declare function parseIsoInstant(value: string): number;
/** 规范化星期（JS getDay(): 0=周日 … 6=周六）。 */
export declare function normalizeWeekday(value: number): number;
/** 规范化月份日（1-31）。 */
export declare function normalizeMonthDay(value: number): number;
/** 规范化分钟（0-59）。 */
export declare function normalizeMinute(value: number): number;
/** 给定年月，该月天数。 */
export declare function daysInMonth(year: number, month: number): number;
/** 本地时区下 y/m/d h:m 的 epoch ms。 */
export declare function localEpoch(year: number, month: number, day: number, hour: number, minute: number): number;
/** 一个 cron 字段的取值集合（升序、去重）。 */
export interface CronField {
    /** 是否 `*`（全部取值）。 */
    all: boolean;
    /** 显式取值集合（all=false 时）。 */
    values: ReadonlySet<number>;
}
/** 解析后的 cron 表达式。 */
export interface ParsedCron {
    minute: CronField;
    hour: CronField;
    dayOfMonth: CronField;
    month: CronField;
    dayOfWeek: CronField;
}
/** 解析单个 cron 字段（支持 *、数字、范围、步进、列表）。 */
export declare function parseCronField(name: string, raw: string, min: number, max: number): CronField;
/**
 * 解析标准 5 字段 cron 表达式（分 时 日 月 周）。
 * 周字段 0=周日 … 6=周六（与 JS getDay 一致）。
 * 语义：日字段与周字段均为 `*` 时按“或”匹配，否则按“与”匹配（标准 cron 行为）。
 */
export declare function parseCronExpr(expr: string): ParsedCron;
/** 规范化 Trigger 配置为统一校验后的内部表示。 */
export interface NormalizedTrigger {
    config?: TriggerConfig;
    kind: TriggerConfig['type'];
    /** once：epoch ms。 */
    onceAt?: number;
    /** hourly。 */
    minute?: number;
    /** daily / weekday / weekly / monthly。 */
    time?: {
        hour: number;
        minute: number;
    };
    weekdays?: number[];
    weekday?: number;
    monthDay?: number;
    cron?: ParsedCron;
}
/** 人类可读的 Trigger 标签（Web / 工具展示）。 */
export declare function triggerLabel(config: TriggerConfig): string;
/**
 * 计算 Trigger 在 `from`（epoch ms，含）之后的第一次触发时刻。
 * @returns epoch ms；`once` 已过期返回 undefined。
 */
export declare function legacyNextOccurrence(normalized: NormalizedTrigger, from: number): number | undefined;
/** 便捷：直接由 Trigger 配置计算下一次运行时间。 */
export declare function nextOccurrenceOf(config: TriggerConfig, from: number): number | undefined;
/** Current execution uses the official public Schedule rule constructors. */
export declare function systemTimeZone(): string;
export declare function triggerTimeZone(config: TriggerConfig): string;
export declare function normalizeTrigger(config: TriggerConfig): NormalizedTrigger;
export declare function scheduleSelector(config: TriggerConfig): Omit<ScheduleCreateRequest, 'title' | 'prompt'>;
export declare function onceInstant(config: TriggerConfig): number;
export declare function nextOccurrence(normalized: NormalizedTrigger, from: number): number | undefined;
/** Old parser matched date AND weekday; official Vixie rules may instead use OR. */
export declare function legacyRuleIssue(config: TriggerConfig): string | undefined;
