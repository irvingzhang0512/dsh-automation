/**
 * 浏览器端 /api/automation 客户端。
 *
 * 纯 fetch 封装：请求与响应均为 JSON。所有接口返回统一信封
 * `{ ok, code, message, ... }`（与工具一致）。错误时 throw ApiError。
 */

/** 基础 URL（同源 /api/automation）。 */
export const API_BASE = '/api/automation'

/** API 错误。 */
export class ApiError extends Error {
  readonly code: string
  readonly status: number
  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
  }
}

/** 统一信封（额外字段保留）。 */
export interface Envelope {
  ok: boolean
  code: string
  message: string
  [key: string]: unknown
}

/** 请求并解析 JSON 信封；非 2xx / !ok 抛 ApiError。 */
async function request<T extends Envelope = Envelope>(path: string, options?: { method?: string; body?: unknown; query?: Record<string, string | number | undefined> }): Promise<T> {
  const { method = 'GET', body, query } = options ?? {}
  let url = `${API_BASE}${path}`
  if (query !== undefined) {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) params.set(key, String(value))
    }
    const qs = params.toString()
    if (qs !== '') url = `${url}?${qs}`
  }
  const headers: Record<string, string> = { Accept: 'application/json' }
  let payload: string | undefined
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    payload = JSON.stringify(body)
  }
  const res = await fetch(url, { method, headers, body: payload })
  let data: unknown
  try {
    data = await res.json()
  } catch {
    data = undefined
  }
  const envelope = data as Partial<Envelope> | undefined
  if (!res.ok || envelope?.ok === false) {
    throw new ApiError(res.status, envelope?.code ?? 'HTTP_ERROR', envelope?.message ?? `请求失败（${res.status}）`)
  }
  return data as T
}

/* ---------------- 任务 ---------------- */

export interface ActionSpecWire {
  type: 'skill' | 'agent_prompt' | 'command' | 'script'
  skill?: string
  prompt?: string
  agent?: string
  command?: string
  args?: string[]
  shell?: boolean
  path?: string
  interpreter?: string
}

export interface TaskWire {
  id: string
  name: string
  description?: string
  enabled: boolean
  action: ActionSpecWire
  context?: { cwd?: string; env?: Record<string, string> }
  concurrency?: 'skip' | 'queue' | 'parallel'
  retry?: { enabled: boolean; max_attempts?: number; delay_seconds?: number }
  timeout_seconds?: number
  created_by?: string
  created_at: string
  updated_at: string
}

export interface TriggerWire {
  id: string
  task_id: string
  config: Record<string, unknown>
  enabled: boolean
  created_at: string
  updated_at: string
}

export interface RunWire {
  id: string
  task_id: string
  trigger_id: string
  scheduled_at: string
  started_at?: string
  finished_at?: string
  status: string
  attempt: number
  output?: string
  error?: string
  exit_code?: number
  created_at: string
  updated_at: string
}

export interface UpcomingWire {
  run_id: string
  task_id: string
  task_name: string
  trigger_id: string
  trigger_label: string
  scheduled_at: string
  action: ActionSpecWire
}

export interface RunningWire {
  run_id: string
  task_id: string
  task_name: string
  started_at: string
  elapsed_ms: number
  action: ActionSpecWire
}

export interface HistoryWire {
  run_id: string
  task_id: string
  task_name: string
  scheduled_at: string
  started_at?: string
  finished_at?: string
  status: string
  duration_ms?: number
  error?: string
}

/* ---------------- API 方法 ---------------- */

export const api = {
  /** 服务状态。 */
  status: () => request<Envelope & { status: { running: boolean; queued: number; active: number; homeDir: string } }>('/status'),

  /** 列出任务。 */
  listTasks: () => request<Envelope & { tasks: TaskWire[] }>('/tasks'),

  /** 任务详情（含 triggers / runs）。 */
  getTask: (id: string) => request<Envelope & { task: TaskWire; triggers: TriggerWire[]; runs: RunWire[] }>(`/tasks/${encodeURIComponent(id)}`),

  /** 创建任务。 */
  createTask: (input: Record<string, unknown>) => request<Envelope & { task: TaskWire }>('/tasks', { method: 'POST', body: input }),

  /** 更新任务。 */
  updateTask: (id: string, patch: Record<string, unknown>) => request<Envelope & { task: TaskWire }>(`/tasks/${encodeURIComponent(id)}`, { method: 'PATCH', body: patch }),

  /** 删除任务。 */
  deleteTask: (id: string) => request(`/tasks/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  /** 立即运行。 */
  runNow: (id: string) => request<Envelope & { run_id?: string }>(`/tasks/${encodeURIComponent(id)}/run`, { method: 'POST' }),

  /** 添加执行时间。 */
  addTrigger: (taskId: string, config: Record<string, unknown>) => request<Envelope & { trigger: TriggerWire }>(`/tasks/${encodeURIComponent(taskId)}/triggers`, { method: 'POST', body: { config } }),

  /** 更新执行时间。 */
  updateTrigger: (id: string, patch: Record<string, unknown>) => request<Envelope & { trigger: TriggerWire }>(`/triggers/${encodeURIComponent(id)}`, { method: 'PATCH', body: patch }),

  /** 删除执行时间。 */
  deleteTrigger: (id: string) => request(`/triggers/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  /** 待运行。 */
  listUpcoming: () => request<Envelope & { upcoming: UpcomingWire[] }>('/upcoming'),

  /** 运行中。 */
  listRunning: () => request<Envelope & { running: RunningWire[] }>('/running'),

  /** 历史（可按任务 / 状态筛选）。 */
  listHistory: (filter?: { taskId?: string; status?: string; limit?: number }) => request<Envelope & { runs: HistoryWire[] }>('/history', { query: filter }),

  /** 运行详情。 */
  getRun: (id: string) => request<Envelope & { run: RunWire; logs: string[] }>(`/runs/${encodeURIComponent(id)}`),

  /** 取消运行。 */
  cancelRun: (id: string) => request(`/runs/${encodeURIComponent(id)}/cancel`, { method: 'POST' }),
}
