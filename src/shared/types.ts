/**
 * dsh-automation 共享类型：核心对象模型（Task / Trigger / Run）与 wire 协议。
 *
 * 设计约束（见需求 §4）：
 * - Task：要做什么（做什么）；
 * - Trigger：什么时候运行（一个 Task 可有多个 Trigger，可单独增删）；
 * - Run：某一次实际执行（取消某一次 Run 不等于删除整个 Task）。
 */
import type { JsonValue } from '@deepseek-ai/dsh-util-values'

/** 稳定对象 id（短横线格式）。 */
export type AutomationId = string

/** 第一版支持的 Trigger 类型。 */
export type TriggerType = 'once' | 'hourly' | 'daily' | 'weekday' | 'weekly' | 'monthly' | 'cron'

/** 第一版支持的 Action 类型。 */
export type ActionType = 'skill' | 'agent_prompt' | 'command' | 'script'

/** Run 状态机：pending → running → success / failed / cancelled / timeout（另有 skipped）。 */
export type RunStatus = 'pending' | 'running' | 'success' | 'failed' | 'cancelled' | 'skipped' | 'timeout'

/** 并发策略：上一次没结束下一次又到时怎么处理。 */
export type ConcurrencyPolicy = 'skip' | 'queue' | 'parallel'

/** 创建来源。 */
export type TaskSource = 'web' | 'llm' | 'cli'

/* ------------------------------------------------------------------ */
/* Task                                                               */
/* ------------------------------------------------------------------ */

/** Skill Action：运行 DSH Skill。第一版最重要的 Action。 */
export interface SkillActionSpec {
  type: 'skill'
  /** 已注册的 skill 名称（kebab-case）。 */
  skill: string
  /** 附加给 skill 的指令（可选）。 */
  prompt?: string
}

/** Agent Prompt Action：指定 Agent 并发送 Prompt。 */
export interface AgentPromptActionSpec {
  type: 'agent_prompt'
  /** Agent 名称 / 会话标识。 */
  agent: string
  /** 要发送的 Prompt。 */
  prompt: string
}

/** Command Action：运行 Shell / CLI 命令。 */
export interface CommandActionSpec {
  type: 'command'
  /** 命令本身（如 `git pull`）。 */
  command: string
  /** 附加参数（可选）。 */
  args?: string[]
  /** 是否通过 shell 执行（默认 false，直接 spawn）。 */
  shell?: boolean
}

/** Script Action：执行本地脚本（.py / .sh）。 */
export interface ScriptActionSpec {
  type: 'script'
  /** 脚本路径（相对 cwd 或绝对路径）。 */
  path: string
  /** 传给脚本的参数（可选）。 */
  args?: string[]
  /** 解释器覆盖（如 python / bash）；缺省按扩展名推断。 */
  interpreter?: string
}

/** 全部 Action 判别联合。 */
export type ActionSpec = SkillActionSpec | AgentPromptActionSpec | CommandActionSpec | ScriptActionSpec

/** 失败重试配置。 */
export interface RetryConfig {
  enabled: boolean
  /** 最大重试次数（不含首次；1 = 失败后再试 1 次）。 */
  max_attempts: number
  /** 重试间隔秒。 */
  delay_seconds: number
}

/** 任务定义：要做什么。 */
export interface Task {
  id: AutomationId
  name: string
  description?: string
  enabled: boolean
  action: ActionSpec
  /** 执行上下文（工作目录等）。 */
  context?: {
    cwd?: string
    env?: Record<string, string>
  }
  /** 并发策略，默认 skip。 */
  concurrency?: ConcurrencyPolicy
  retry?: RetryConfig
  /** 超时秒数（默认由系统配置）。 */
  timeout_seconds?: number
  created_by: TaskSource
  created_at: string
  updated_at: string
}

/** 创建任务输入（id / created_at 由服务生成）。 */
export type CreateTaskInput = Omit<Task, 'id' | 'created_at' | 'updated_at'>

/* ------------------------------------------------------------------ */
/* Trigger                                                            */
/* ------------------------------------------------------------------ */

/** Once：仅执行一次。`at` 为本地时间 ISO（可带时区）。 */
export interface OnceTriggerConfig {
  type: 'once'
  /** 触发时刻（ISO 字符串）。 */
  at: string
}

/** Hourly：每隔一小时。`minute` 为每小时的分钟（0-59，默认 0）。 */
export interface HourlyTriggerConfig {
  type: 'hourly'
  minute?: number
}

/** Daily：每天固定时刻。`time` 为 "HH:mm"。 */
export interface DailyTriggerConfig {
  type: 'daily'
  time: string
}

/** Weekday：每周指定星期几的固定时刻。weekdays 0=周日 … 6=周六。 */
export interface WeekdayTriggerConfig {
  type: 'weekday'
  weekdays: number[]
  time: string
}

/** Weekly：每周某一天固定时刻。weekday 0=周日 … 6=周六。 */
export interface WeeklyTriggerConfig {
  type: 'weekly'
  weekday: number
  time: string
}

/** Monthly：每月某日固定时刻。day 1-31（超出月份自动裁剪）。 */
export interface MonthlyTriggerConfig {
  type: 'monthly'
  day: number
  time: string
}

/** Cron：高级模式，标准 5 字段（分 时 日 月 周）。 */
export interface CronTriggerConfig {
  type: 'cron'
  /** 标准 cron 表达式，如 `0 18 * * *`。 */
  expr: string
}

/** 全部 Trigger 配置判别联合。 */
export type TriggerConfig = OnceTriggerConfig | HourlyTriggerConfig | DailyTriggerConfig | WeekdayTriggerConfig | WeeklyTriggerConfig | MonthlyTriggerConfig | CronTriggerConfig

/** 触发规则：什么时候运行。 */
export interface Trigger {
  id: AutomationId
  task_id: AutomationId
  config: TriggerConfig
  enabled: boolean
  created_at: string
  updated_at: string
}

/** 创建 / 更新 Trigger 输入。 */
export type TriggerInput = Omit<Trigger, 'id' | 'task_id' | 'created_at' | 'updated_at'>

/* ------------------------------------------------------------------ */
/* Run                                                                */
/* ------------------------------------------------------------------ */

/** 一次实际运行。 */
export interface Run {
  id: AutomationId
  task_id: AutomationId
  trigger_id: AutomationId
  /** 计划执行时刻（ISO）。 */
  scheduled_at: string
  started_at?: string
  finished_at?: string
  status: RunStatus
  /** 第几次尝试（1 开始）。 */
  attempt: number
  /** 执行输出（文本）。 */
  output?: string
  /** 错误信息（失败 / 超时 / 取消时）。 */
  error?: string
  /** 进程退出码（command/script）。 */
  exit_code?: number
  created_at: string
  updated_at: string
}

/** 待运行视图条目：Task + Trigger + 下一次计划时刻。 */
export interface UpcomingRun {
  run_id: AutomationId
  task_id: AutomationId
  task_name: string
  trigger_id: AutomationId
  trigger_label: string
  scheduled_at: string
  action: ActionSpec
}

/** 运行中视图条目。 */
export interface RunningRun {
  run_id: AutomationId
  task_id: AutomationId
  task_name: string
  started_at: string
  elapsed_ms: number
  action: ActionSpec
}

/** 历史视图条目。 */
export interface HistoryRun {
  run_id: AutomationId
  task_id: AutomationId
  task_name: string
  scheduled_at: string
  started_at?: string
  finished_at?: string
  status: RunStatus
  duration_ms?: number
  error?: string
}

/* ------------------------------------------------------------------ */
/* wire / 结果信封                                                    */
/* ------------------------------------------------------------------ */

/** 工具统一结果信封。附加字段可以是任何数据（Task/Trigger/Run/数组等）。 */
export interface AutomationResult {
  ok: boolean
  code: string
  message: string
  [key: string]: unknown
}

/** 服务对外的最小存储 / 查询面（tools 与 server 共用）。 */
export interface AutomationStore {
  /** 数据目录（持久化位置；状态展示用）。 */
  readonly homeDir: string
  listTasks(): Task[]
  getTask(id: string): Task | undefined
  createTask(input: CreateTaskInput): Task
  updateTask(id: string, patch: Partial<CreateTaskInput>): Task | undefined
  deleteTask(id: string): boolean
  listTriggers(taskId?: string): Trigger[]
  getTrigger(id: string): Trigger | undefined
  addTrigger(taskId: string, input: TriggerInput): Trigger | undefined
  updateTrigger(id: string, patch: Partial<TriggerInput>): Trigger | undefined
  deleteTrigger(id: string): boolean
  listRuns(filter?: { taskId?: string; status?: RunStatus; limit?: number }): Run[]
  getRun(id: string): Run | undefined
  createRun(run: Run): Run
  updateRun(id: string, patch: Partial<Run>): Run | undefined
  appendRunLog(runId: string, line: string): void
  readRunLog(runId: string): string[]
}
