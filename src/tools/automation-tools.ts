/**
 * automation.* 工具注册。
 *
 * LLM / Skill 不应直接修改任务存储文件——所有操作统一通过工具完成
 * （需求 §12）。第一版提供 16 个工具：
 *
 *   automation.create_task / update_task / delete_task / get_task / list_tasks
 *   automation.enable_task / disable_task
 *   automation.add_trigger / update_trigger / delete_trigger
 *   automation.list_upcoming_runs / list_running_runs / list_history / get_run
 *   automation.run_now / cancel_run
 *
 * 结果信封统一为 { ok, code, message, ... }（与 dsh-structured-document-view
 * 同款约定），并附带独立文本投影（model 可读）。
 */
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { ContentBlock } from '@deepseek-ai/dsh-llm'
import type { ParameterPropertySpec, ToolDefinition } from '@deepseek-ai/dsh-tools'
import type { AutomationService } from '../core/service.ts'
import type { TriggerConfig } from '../shared/types.ts'
import { triggerLabel } from '../shared/time.ts'

/** 全部工具名（SKILL / docs 契约测试用）。 */
export const AUTOMATION_TOOL_NAMES = [
  'automation.create_task',
  'automation.update_task',
  'automation.delete_task',
  'automation.get_task',
  'automation.list_tasks',
  'automation.enable_task',
  'automation.disable_task',
  'automation.add_trigger',
  'automation.update_trigger',
  'automation.delete_trigger',
  'automation.list_upcoming_runs',
  'automation.list_running_runs',
  'automation.list_history',
  'automation.get_run',
  'automation.run_now',
  'automation.cancel_run',
] as const

export type AutomationToolName = (typeof AUTOMATION_TOOL_NAMES)[number]

/** 工具依赖：核心服务。 */
export interface AutomationToolDeps {
  service: AutomationService
}

/* ---------------- schema 片段 ---------------- */

/** 时间字符串（HH:mm 或 ISO）。 */
const timeString: ParameterPropertySpec = {
  type: 'string',
  description: '时刻。每日/每周/每月类触发用 "HH:mm"（如 "18:00"）；once 用 ISO 8601。',
}

const triggerTypeEnum: ParameterPropertySpec = {
  type: 'string',
  enum: ['once', 'hourly', 'daily', 'weekday', 'weekly', 'monthly', 'cron'],
  description: '触发类型：once（仅一次）/ hourly（每小时）/ daily（每天）/ weekday（每周指定几天）/ weekly（每周某天）/ monthly（每月某日）/ cron（高级 cron 表达式）。',
}

/** Action schema（四种类型判别）。 */
const actionSchema: ParameterPropertySpec = {
  type: 'object',
  additionalProperties: false,
  description: '执行动作（四选一）。',
  properties: {
    type: {
      type: 'string',
      enum: ['skill', 'agent_prompt', 'command', 'script'],
      required: true,
      description: '动作类型：skill（运行 DSH Skill）/ agent_prompt（给指定 Agent 发 Prompt）/ command（运行命令）/ script（执行脚本）。',
    },
    skill: { type: 'string', description: 'skill 类型必填：skill 名称（kebab-case）。' },
    prompt: { type: 'string', description: 'skill 类型可选的附加指令；agent_prompt 类型为要发送的 Prompt（必填）。' },
    agent: { type: 'string', description: 'agent_prompt 类型必填：Agent 名称 / 会话标识。' },
    command: { type: 'string', description: 'command 类型必填：要运行的命令。' },
    args: { type: 'array', items: { type: 'string' }, description: 'command / script 的附加参数。' },
    shell: { type: 'boolean', description: 'command 是否通过 shell 执行（默认 false）。' },
    path: { type: 'string', description: 'script 类型必填：脚本路径（.py / .sh）。' },
    interpreter: { type: 'string', description: 'script 解释器覆盖（如 python / bash）。' },
  },
}

const retrySchema: ParameterPropertySpec = {
  type: 'object',
  additionalProperties: false,
  description: '失败重试配置。',
  properties: {
    enabled: { type: 'boolean', required: true, description: '是否启用重试。' },
    max_attempts: { type: 'integer', description: '最大重试次数（不含首次；1 = 失败后再试 1 次）。' },
    delay_seconds: { type: 'integer', description: '重试间隔秒。' },
  },
}

/** 任务输出 schema 的公共字段。 */
const taskSchema: ParameterPropertySpec = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: { type: 'string', required: true, description: '任务 id。' },
    name: { type: 'string', required: true, description: '任务名称。' },
    description: { type: 'string', description: '任务描述。' },
    enabled: { type: 'boolean', required: true, description: '是否启用。' },
    action: { ...actionSchema, required: true },
    context: {
      type: 'object',
      additionalProperties: false,
      description: '执行上下文。',
      properties: {
        cwd: { type: 'string', description: '工作目录。' },
        env: { type: 'object', additionalProperties: true, description: '环境变量。' },
      },
    },
    concurrency: { type: 'string', enum: ['skip', 'queue', 'parallel'], description: '并发策略。' },
    retry: retrySchema,
    timeout_seconds: { type: 'integer', description: '超时秒数。' },
    created_by: { type: 'string', description: '创建来源。' },
    created_at: { type: 'string', description: '创建时间。' },
    updated_at: { type: 'string', description: '更新时间。' },
  },
  description: '任务对象。',
}

/** 结果信封 schema 基础属性。 */
const baseEnvelope = {
  ok: { type: 'boolean' as const, required: true as const, description: '是否成功。' },
  code: { type: 'string' as const, required: true as const, description: '状态 / 错误码。' },
  message: { type: 'string' as const, required: true as const, description: '人类可读的结果说明。' },
} satisfies Record<string, ParameterPropertySpec>

/** 输出 schema 组合（信封 + 附加字段）。 */
function outputWith<const E extends Record<string, ParameterPropertySpec>>(extra: E): {
  type: 'object'
  additionalProperties: false
  properties: Record<string, ParameterPropertySpec>
} {
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      ...baseEnvelope,
      ...extra,
    },
  }
}

/**
 * 工具注册辅助：收集已由 defineTool 推断好的工具定义。
 * 每个工具定义在调用处用 defineTool({...}) 包裹，获得与范式一致的严格
 * 参数/输出推断（execute 里 args 有精确类型，无需 as never 处理参数）。
 */
function register(
  ctx: { tools: { register(tool: unknown): () => void } },
  disposers: Array<() => void>,
  tool: ToolDefinition,
): void {
  disposers.push(ctx.tools.register(tool))
}

/** 结果文本投影（防御性结构读取）。 */
function textOf(value: unknown): string {
  const v = value as Record<string, unknown>
  const lines: string[] = [`[${String(v.code ?? '?')}] ${String(v.message ?? '')}`]
  const task = v.task as Record<string, unknown> | undefined
  if (task !== undefined) {
    lines.push(`任务: ${String(task.name ?? task.id ?? '')}`)
  }
  const trigger = v.trigger as Record<string, unknown> | undefined
  if (trigger !== undefined) {
    const config = trigger.config as Record<string, unknown> | undefined
    if (config !== undefined) {
      lines.push(`执行时间: ${triggerLabel(config as never)}`)
    }
  }
  const run = v.run as Record<string, unknown> | undefined
  if (run !== undefined) {
    lines.push(`运行: ${String(run.id ?? '')}（${String(run.status ?? '')}）`)
  }
  if (v.task_id !== undefined) lines.push(`任务 id: ${String(v.task_id)}`)
  if (v.scheduled_at !== undefined) lines.push(`计划执行: ${String(v.scheduled_at)}`)
  if (Array.isArray(v.runs) && (v.runs as unknown[]).length > 0) lines.push(`共 ${(v.runs as unknown[]).length} 条运行记录。`)
  if (Array.isArray(v.tasks) && (v.tasks as unknown[]).length > 0) lines.push(`共 ${(v.tasks as unknown[]).length} 个任务。`)
  return lines.join('\n')
}

/** text ContentBlock。 */
function textBlock(text: string): ContentBlock {
  return { type: 'text', text }
}

/* ---------------- 工具注册 ---------------- */

export function registerAutomationTools(ctx: { tools: { register(tool: unknown): () => void } }, deps: AutomationToolDeps): () => void {
  const { service } = deps
  const disposers: Array<() => void> = []

  /* --- 创建任务 --- */
  register(ctx, disposers, defineTool({
    name: 'automation.create_task',
    description: '创建一个定时自动任务（Task）。任务需要名称、执行动作与至少一个执行时间（Trigger）。返回创建后的完整任务。',
    parameters: {
      name: { type: 'string', required: true, description: '任务名称（如 "每日项目总结"）。' },
      description: { type: 'string', description: '任务描述。' },
      action: actionSchema,
      context: {
        type: 'object',
        additionalProperties: false,
        description: '执行上下文。',
        properties: {
          cwd: { type: 'string', description: '工作目录。' },
          env: { type: 'object', additionalProperties: true, description: '环境变量。' },
        },
      },
      concurrency: { type: 'string', enum: ['skip', 'queue', 'parallel'], description: '并发策略（默认 skip）。' },
      retry: retrySchema,
      timeout_seconds: { type: 'integer', description: '超时秒数。' },
    },
    output: {
      schema: outputWith({ task: taskSchema }),
      render: (_args, value) => [textBlock(textOf(value as never))],
    },
    execute: async (args) => {
      const input: Record<string, unknown> = {
        name: args.name,
        description: args.description,
        enabled: true,
        action: args.action!,
        created_by: 'llm',
      }
      if (args.context !== undefined) input.context = args.context
      if (args.concurrency !== undefined) input.concurrency = args.concurrency
      if (args.retry !== undefined) input.retry = args.retry
      if (args.timeout_seconds !== undefined) input.timeout_seconds = args.timeout_seconds
      return service.createTask(input as never) as never
    },
  }))

  /* --- 更新任务 --- */
  register(ctx, disposers, defineTool({
    name: 'automation.update_task',
    description: '更新一个已有任务（名称/描述/动作/并发/重试/超时等）。注意：enabled 启停请用 automation.enable_task / disable_task。',
    parameters: {
      task_id: { type: 'string', required: true, description: '要更新的任务 id。' },
      name: { type: 'string', description: '新名称。' },
      description: { type: 'string', description: '新描述。' },
      action: actionSchema,
      context: {
        type: 'object',
        additionalProperties: false,
        description: '执行上下文。',
        properties: {
          cwd: { type: 'string', description: '工作目录。' },
          env: { type: 'object', additionalProperties: true, description: '环境变量。' },
        },
      },
      concurrency: { type: 'string', enum: ['skip', 'queue', 'parallel'], description: '并发策略。' },
      retry: retrySchema,
      timeout_seconds: { type: 'integer', description: '超时秒数。' },
    },
    output: {
      schema: outputWith({ task: taskSchema }),
      render: (_args, value) => [textBlock(textOf(value as never))],
    },
    execute: async (args) => {
      const patch: Record<string, unknown> = {}
      if (args.name !== undefined) patch.name = args.name
      if (args.description !== undefined) patch.description = args.description
      if (args.action !== undefined) patch.action = args.action
      if (args.context !== undefined) patch.context = args.context
      if (args.concurrency !== undefined) patch.concurrency = args.concurrency
      if (args.retry !== undefined) patch.retry = args.retry
      if (args.timeout_seconds !== undefined) patch.timeout_seconds = args.timeout_seconds
      return service.updateTask(args.task_id, patch as never) as never
    },
  }))

  /* --- 删除任务 --- */
  register(ctx, disposers, defineTool({
    name: 'automation.delete_task',
    description: '删除一个任务及其全部执行时间。删除后该任务不再运行（历史 Run 记录一并移除）。',
    parameters: {
      task_id: { type: 'string', required: true, description: '要删除的任务 id。' },
    },
    output: {
      schema: outputWith({}),
      render: (_args, value) => [textBlock(textOf(value as never))],
    },
    execute: async (args) => service.deleteTask(args.task_id) as never,
  }))

  /* --- 获取任务 --- */
  register(ctx, disposers, defineTool({
    name: 'automation.get_task',
    description: '获取一个任务的详情，包括其全部执行时间（Trigger）与最近运行记录。',
    parameters: {
      task_id: { type: 'string', required: true, description: '任务 id。' },
    },
    output: {
      schema: outputWith({
        task: taskSchema,
        triggers: { type: 'array', items: { type: 'object', additionalProperties: true }, description: '执行时间列表。' },
        runs: { type: 'array', items: { type: 'object', additionalProperties: true }, description: '最近运行记录。' },
      }),
      render: (_args, value) => [textBlock(textOf(value as never))],
    },
    execute: async (args) => service.getTaskDetail(args.task_id) as never,
  }))

  /* --- 列出任务 --- */
  register(ctx, disposers, defineTool({
    name: 'automation.list_tasks',
    description: '列出全部自动任务（含启用状态、执行动作与执行时间）。',
    parameters: {
      filter: { type: 'string', enum: ['all', 'enabled', 'disabled'], description: '筛选：all（全部）/ enabled（已启用）/ disabled（已暂停），默认 all。' },
    },
    output: {
      schema: outputWith({
        tasks: { type: 'array', items: taskSchema, required: true, description: '任务列表。' },
      }),
      render: (_args, value) => [textBlock(textOf(value as never))],
    },
    execute: async (args) => {
      let tasks = service.allTasks()
      if (args.filter === 'enabled') tasks = tasks.filter(t => t.enabled)
      if (args.filter === 'disabled') tasks = tasks.filter(t => !t.enabled)
      return { ok: true, code: 'OK', message: `共 ${tasks.length} 个任务。`, tasks } as never
    },
  }))

  /* --- 启用 / 暂停 --- */
  register(ctx, disposers, defineTool({
    name: 'automation.enable_task',
    description: '启用一个任务（恢复定时执行）。',
    parameters: {
      task_id: { type: 'string', required: true, description: '任务 id。' },
    },
    output: {
      schema: outputWith({ task: taskSchema }),
      render: (_args, value) => [textBlock(textOf(value as never))],
    },
    execute: async (args) => service.enableTask(args.task_id, true) as never,
  }))

  register(ctx, disposers, defineTool({
    name: 'automation.disable_task',
    description: '暂停一个任务（不再定时执行；已排队的本次运行会取消，运行中的不中断）。',
    parameters: {
      task_id: { type: 'string', required: true, description: '任务 id。' },
    },
    output: {
      schema: outputWith({ task: taskSchema }),
      render: (_args, value) => [textBlock(textOf(value as never))],
    },
    execute: async (args) => service.enableTask(args.task_id, false) as never,
  }))

  /* --- Trigger --- */
  register(ctx, disposers, defineTool({
    name: 'automation.add_trigger',
    description: '给一个任务添加执行时间（Trigger）。一个任务可以有多个执行时间；可单独删除其中某一个。',
    parameters: {
      task_id: { type: 'string', required: true, description: '任务 id。' },
      type: triggerTypeEnum,
      at: timeString,
      minute: { type: 'integer', description: 'hourly 类型：每小时的第几分钟（0-59，默认 0）。' },
      time: timeString,
      weekdays: { type: 'array', items: { type: 'integer' }, description: 'weekday 类型：星期几列表（0=周日 … 6=周六）。' },
      weekday: { type: 'integer', description: 'weekly 类型：星期几（0=周日 … 6=周六）。' },
      day: { type: 'integer', description: 'monthly 类型：每月第几日（1-31）。' },
      expr: { type: 'string', description: 'cron 类型：标准 5 字段 cron 表达式（如 "0 18 * * *"）。' },
    },
    output: {
      schema: outputWith({ trigger: { type: 'object', additionalProperties: true, description: '创建的 Trigger。' } }),
      render: (_args, value) => [textBlock(textOf(value as never))],
    },
    execute: async (args) => {
      const config = buildTriggerConfig(args as never)
      if (config === undefined) {
        return { ok: false, code: 'INVALID_INPUT', message: '缺少触发类型（type）。' } as never
      }
      return service.addTrigger(args.task_id, { config: config as unknown as TriggerConfig, enabled: true }) as never
    },
  }))

  register(ctx, disposers, defineTool({
    name: 'automation.update_trigger',
    description: '更新一个执行时间（Trigger）的配置或启用状态。',
    parameters: {
      trigger_id: { type: 'string', required: true, description: 'Trigger id。' },
      type: triggerTypeEnum,
      at: timeString,
      minute: { type: 'integer', description: 'hourly 类型：每小时的第几分钟。' },
      time: timeString,
      weekdays: { type: 'array', items: { type: 'integer' }, description: 'weekday 类型：星期几列表。' },
      weekday: { type: 'integer', description: 'weekly 类型：星期几。' },
      day: { type: 'integer', description: 'monthly 类型：每月第几日。' },
      expr: { type: 'string', description: 'cron 类型：cron 表达式。' },
      enabled: { type: 'boolean', description: '是否启用该 Trigger。' },
    },
    output: {
      schema: outputWith({ trigger: { type: 'object', additionalProperties: true, description: '更新后的 Trigger。' } }),
      render: (_args, value) => [textBlock(textOf(value as never))],
    },
    execute: async (args) => {
      const patch: Record<string, unknown> = {}
      if (args.enabled !== undefined) patch.enabled = args.enabled
      const config = buildTriggerConfig(args as never)
      if (config !== undefined) patch.config = config
      return service.updateTrigger(args.trigger_id, patch as never) as never
    },
  }))

  register(ctx, disposers, defineTool({
    name: 'automation.delete_trigger',
    description: '删除一个执行时间（Trigger）。只影响该执行时间，不影响任务本身与其它执行时间。',
    parameters: {
      trigger_id: { type: 'string', required: true, description: 'Trigger id。' },
    },
    output: {
      schema: outputWith({}),
      render: (_args, value) => [textBlock(textOf(value as never))],
    },
    execute: async (args) => service.deleteTrigger(args.trigger_id) as never,
  }))

  /* --- 查询 --- */
  register(ctx, disposers, defineTool({
    name: 'automation.list_upcoming_runs',
    description: '查看接下来 DSH 准备运行哪些任务（待运行，按时间排序）。',
    parameters: {},
    output: {
      schema: outputWith({
        upcoming: { type: 'array', items: { type: 'object', additionalProperties: true }, required: true, description: '待运行列表（按计划执行时间升序）。' },
      }),
      render: (_args, value) => [textBlock(textOf(value as never))],
    },
    execute: async () => {
      const upcoming = service.listUpcoming()
      return { ok: true, code: 'OK', message: `共 ${upcoming.length} 条待运行。`, upcoming } as never
    },
  }))

  register(ctx, disposers, defineTool({
    name: 'automation.list_running_runs',
    description: '查看当前正在运行的任务（运行中）。',
    parameters: {},
    output: {
      schema: outputWith({
        running: { type: 'array', items: { type: 'object', additionalProperties: true }, required: true, description: '运行中列表。' },
      }),
      render: (_args, value) => [textBlock(textOf(value as never))],
    },
    execute: async () => {
      const running = service.listRunning() as unknown[]
      return { ok: true, code: 'OK', message: `共 ${running.length} 个运行中任务。`, running } as never
    },
  }))

  register(ctx, disposers, defineTool({
    name: 'automation.list_history',
    description: '查看已完成的运行历史（支持按任务与状态筛选）。',
    parameters: {
      task_id: { type: 'string', description: '按任务筛选。' },
      status: { type: 'string', enum: ['pending', 'running', 'success', 'failed', 'cancelled', 'skipped', 'timeout'], description: '按状态筛选。' },
      limit: { type: 'integer', description: '返回条数（默认 100，最多 1000）。' },
    },
    output: {
      schema: outputWith({
        runs: { type: 'array', items: { type: 'object', additionalProperties: true }, required: true, description: '历史记录。' },
      }),
      render: (_args, value) => [textBlock(textOf(value as never))],
    },
    execute: async (args) => {
      const runs = service.listHistory({ taskId: args.task_id, status: args.status as never, limit: args.limit })
      return { ok: true, code: 'OK', message: `共 ${runs.length} 条历史。`, runs } as never
    },
  }))

  register(ctx, disposers, defineTool({
    name: 'automation.get_run',
    description: '获取一次运行（Run）的详情，包括状态、输出、错误与执行日志。',
    parameters: {
      run_id: { type: 'string', required: true, description: 'Run id。' },
    },
    output: {
      schema: outputWith({
        run: { type: 'object', additionalProperties: true, description: '运行详情。' },
        logs: { type: 'array', items: { type: 'string' }, description: '执行日志行。' },
      }),
      render: (_args, value) => [textBlock(textOf(value as never))],
    },
    execute: async (args) => {
      const run = service.getRun(args.run_id)
      if (run === undefined) return { ok: false, code: 'RUN_NOT_FOUND', message: `运行不存在：${args.run_id}` } as never
      const logs = service.readRunLog(args.run_id)
      return { ok: true, code: 'OK', message: `运行 ${run.id}（${run.status}）。`, run, logs } as never
    },
  }))

  /* --- 运行控制 --- */
  register(ctx, disposers, defineTool({
    name: 'automation.run_now',
    description: '立即运行一个任务（手动触发一次，不影响定时计划）。',
    parameters: {
      task_id: { type: 'string', required: true, description: '任务 id。' },
    },
    output: {
      schema: outputWith({ run_id: { type: 'string', description: '新 Run id。' } }),
      render: (_args, value) => [textBlock(textOf(value as never))],
    },
    execute: async (args) => service.runNow(args.task_id) as never,
  }))

  register(ctx, disposers, defineTool({
    name: 'automation.cancel_run',
    description: '取消一次运行（Run）。运行中 → 请求中止；排队中 → 直接取消；已完成 → 无效。取消某一次运行不影响任务本身与后续周期执行。',
    parameters: {
      run_id: { type: 'string', required: true, description: 'Run id。' },
    },
    output: {
      schema: outputWith({}),
      render: (_args, value) => [textBlock(textOf(value as never))],
    },
    execute: async (args) => service.cancelRun(args.run_id) as never,
  }))

  return () => {
    for (const dispose of disposers) {
      try {
        dispose()
      } catch {
        // 忽略退订异常。
      }
    }
  }
}

/** 从工具参数构造 TriggerConfig（至少需要 type；其余按类型取）。 */
function buildTriggerConfig(args: Record<string, unknown>): Record<string, unknown> | undefined {
  const type = args.type
  if (typeof type !== 'string') return undefined
  switch (type) {
    case 'once':
      return { type, at: requireString(args, 'at') }
    case 'hourly':
      return { type, ...(typeof args.minute === 'number' ? { minute: args.minute } : {}) }
    case 'daily':
      return { type, time: requireString(args, 'time') }
    case 'weekday':
      return { type, weekdays: requireNumberArray(args, 'weekdays'), time: requireString(args, 'time') }
    case 'weekly':
      return { type, weekday: requireNumber(args, 'weekday'), time: requireString(args, 'time') }
    case 'monthly':
      return { type, day: requireNumber(args, 'day'), time: requireString(args, 'time') }
    case 'cron':
      return { type, expr: requireString(args, 'expr') }
    default:
      throw new Error(`不支持的触发类型：${type}。`)
  }
}

function requireString(args: Record<string, unknown>, key: string): string {
  const value = args[key]
  if (typeof value !== 'string' || value === '') {
    throw new Error(`缺少必填参数 ${key}。`)
  }
  return value
}

function requireNumber(args: Record<string, unknown>, key: string): number {
  const value = args[key]
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new Error(`缺少必填参数 ${key}（整数）。`)
  }
  return value
}

function requireNumberArray(args: Record<string, unknown>, key: string): number[] {
  const value = args[key]
  if (!Array.isArray(value) || value.length === 0 || !value.every(v => typeof v === 'number')) {
    throw new Error(`缺少必填参数 ${key}（数字数组）。`)
  }
  return value as number[]
}
