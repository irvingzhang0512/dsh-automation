/**
 * SQLite 存储层（Node 内置 node:sqlite，无需原生依赖）。
 *
 * 数据目录遵循 DSH 统一规范：`~/.dsh/automation/`（`$DSH_HOME` 可覆盖）：
 *
 *   automation.db   # SQLite（tasks / triggers / runs / run_logs）
 *   logs/           # 运行日志（run_xxx.log，人类可读副本）
 *
 * 职责：
 * - 建表与迁移（第一版 v1）；
 * - Task / Trigger / Run 的 CRUD；
 * - Run 日志：写入 DB（结构化行）+ logs/ 文件（文本副本）；
 * - 同步 API（DatabaseSync），Node 事件循环内天然串行，无需外部锁。
 */
import { DatabaseSync, type SQLInputValue } from 'node:sqlite'
import { mkdirSync, readFileSync, appendFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { randomBytes } from 'node:crypto'
import type {
  AutomationStore, AutomationId, Run, RunStatus, Task, Trigger, TriggerInput,
  CreateTaskInput, TriggerConfig, RetryConfig, ActionSpec, ConcurrencyPolicy, TaskSource,
} from '../shared/types.ts'

/** 默认数据目录：`~/.dsh/automation`（尊重 $DSH_HOME）。 */
export function defaultAutomationHome(): string {
  const dshHome = process.env.DSH_HOME ?? join(homedir(), '.dsh')
  return join(dshHome, 'automation')
}

/** 短随机 id 片段。 */
function rand(): string {
  return randomBytes(4).toString('hex')
}

/** 生成稳定 id（task_ / trigger_ / run_ 前缀 + 时间戳 + 随机）。 */
export function makeId(prefix: 'task' | 'trigger' | 'run'): AutomationId {
  const time = Date.now().toString(36)
  return `${prefix}_${time}_${rand()}`
}

/** JSON 安全的读写。 */
function parseJson<T>(raw: string | null | undefined): T | undefined {
  if (raw === null || raw === undefined || raw === '') return undefined
  try {
    return JSON.parse(raw) as T
  } catch {
    return undefined
  }
}

function stringifyJson(value: unknown): string | null {
  if (value === undefined) return null
  return JSON.stringify(value)
}

/** 行 → Task。 */
interface TaskRow {
  id: string
  name: string
  description: string | null
  enabled: number
  action_json: string
  context_json: string | null
  concurrency: string | null
  retry_json: string | null
  timeout_seconds: number | null
  created_by: string
  created_at: string
  updated_at: string
}

function rowToTask(row: TaskRow): Task {
  return {
    id: row.id,
    name: row.name,
    ...(row.description !== null ? { description: row.description } : {}),
    enabled: row.enabled === 1,
    action: parseJson<ActionSpec>(row.action_json)!,
    ...(row.context_json !== null ? { context: parseJson<NonNullable<Task['context']>>(row.context_json) } : {}),
    ...(row.concurrency !== null ? { concurrency: row.concurrency as ConcurrencyPolicy } : {}),
    ...(row.retry_json !== null ? { retry: parseJson<RetryConfig>(row.retry_json) } : {}),
    ...(row.timeout_seconds !== null ? { timeout_seconds: row.timeout_seconds } : {}),
    created_by: row.created_by as TaskSource,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

/** 行 → Trigger。 */
interface TriggerRow {
  id: string
  task_id: string
  config_json: string
  enabled: number
  created_at: string
  updated_at: string
}

function rowToTrigger(row: TriggerRow): Trigger {
  return {
    id: row.id,
    task_id: row.task_id,
    config: parseJson<TriggerConfig>(row.config_json)!,
    enabled: row.enabled === 1,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

/** 行 → Run。 */
interface RunRow {
  id: string
  task_id: string
  trigger_id: string
  scheduled_at: string
  started_at: string | null
  finished_at: string | null
  status: string
  attempt: number
  output: string | null
  error: string | null
  exit_code: number | null
  created_at: string
  updated_at: string
}

function rowToRun(row: RunRow): Run {
  return {
    id: row.id,
    task_id: row.task_id,
    trigger_id: row.trigger_id,
    scheduled_at: row.scheduled_at,
    ...(row.started_at !== null ? { started_at: row.started_at } : {}),
    ...(row.finished_at !== null ? { finished_at: row.finished_at } : {}),
    status: row.status as RunStatus,
    attempt: row.attempt,
    ...(row.output !== null ? { output: row.output } : {}),
    ...(row.error !== null ? { error: row.error } : {}),
    ...(row.exit_code !== null ? { exit_code: row.exit_code } : {}),
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

/** 存储选项。 */
export interface SqliteStoreOptions {
  /** 数据目录（缺省 ~/.dsh/automation）。 */
  homeDir?: string
}

/** SQLite 实现的 AutomationStore。 */
export class SqliteAutomationStore implements AutomationStore {
  readonly homeDir: string
  readonly dbPath: string
  readonly logsDir: string
  private readonly db: DatabaseSync

  constructor(options: SqliteStoreOptions = {}) {
    this.homeDir = options.homeDir ?? defaultAutomationHome()
    this.logsDir = join(this.homeDir, 'logs')
    mkdirSync(this.homeDir, { recursive: true })
    mkdirSync(this.logsDir, { recursive: true })
    this.dbPath = join(this.homeDir, 'automation.db')
    this.db = new DatabaseSync(this.dbPath)
    this.db.exec('PRAGMA journal_mode = WAL;')
    this.db.exec('PRAGMA synchronous = NORMAL;')
    this.migrate()
  }

  /** 关闭数据库（服务卸载时调用）。 */
  close(): void {
    this.db.close()
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        enabled INTEGER NOT NULL DEFAULT 1,
        action_json TEXT NOT NULL,
        context_json TEXT,
        concurrency TEXT,
        retry_json TEXT,
        timeout_seconds INTEGER,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS triggers (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        config_json TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_triggers_task ON triggers(task_id);
      CREATE TABLE IF NOT EXISTS runs (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        trigger_id TEXT NOT NULL,
        scheduled_at TEXT NOT NULL,
        started_at TEXT,
        finished_at TEXT,
        status TEXT NOT NULL,
        attempt INTEGER NOT NULL DEFAULT 1,
        output TEXT,
        error TEXT,
        exit_code INTEGER,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_runs_task ON runs(task_id);
      CREATE INDEX IF NOT EXISTS idx_runs_status ON runs(status);
      CREATE INDEX IF NOT EXISTS idx_runs_scheduled ON runs(scheduled_at);
      CREATE TABLE IF NOT EXISTS run_logs (
        run_id TEXT PRIMARY KEY,
        lines TEXT NOT NULL DEFAULT ''
      );
    `)
  }

  /* ---------------- Task ---------------- */

  listTasks(): Task[] {
    const rows = this.db.prepare('SELECT * FROM tasks ORDER BY created_at ASC').all() as unknown as TaskRow[]
    return rows.map(rowToTask)
  }

  getTask(id: string): Task | undefined {
    const row = this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as unknown as TaskRow | undefined
    return row === undefined ? undefined : rowToTask(row)
  }

  createTask(input: CreateTaskInput): Task {
    const now = new Date().toISOString()
    const task: Task = {
      ...input,
      id: makeId('task'),
      created_at: now,
      updated_at: now,
    }
    this.db.prepare(`
      INSERT INTO tasks (id, name, description, enabled, action_json, context_json,
        concurrency, retry_json, timeout_seconds, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      task.id, task.name, task.description ?? null, task.enabled ? 1 : 0,
      stringifyJson(task.action), stringifyJson(task.context),
      task.concurrency ?? null, stringifyJson(task.retry),
      task.timeout_seconds ?? null, task.created_by, task.created_at, task.updated_at,
    )
    return task
  }

  updateTask(id: string, patch: Partial<CreateTaskInput>): Task | undefined {
    const existing = this.getTask(id)
    if (existing === undefined) return undefined
    const next: Task = { ...existing, ...patch, id, updated_at: new Date().toISOString() }
    this.db.prepare(`
      UPDATE tasks SET name = ?, description = ?, enabled = ?, action_json = ?,
        context_json = ?, concurrency = ?, retry_json = ?, timeout_seconds = ?,
        created_by = ?, updated_at = ?
      WHERE id = ?
    `).run(
      next.name, next.description ?? null, next.enabled ? 1 : 0,
      stringifyJson(next.action), stringifyJson(next.context),
      next.concurrency ?? null, stringifyJson(next.retry),
      next.timeout_seconds ?? null, next.created_by, next.updated_at, id,
    )
    return next
  }

  deleteTask(id: string): boolean {
    const tx = this.db.prepare('DELETE FROM tasks WHERE id = ?').run(id)
    // 级联清理关联的 trigger 与 run（保留 run 记录以便历史，但删除任务后不再展示）。
    this.db.prepare('DELETE FROM triggers WHERE task_id = ?').run(id)
    this.db.prepare('DELETE FROM runs WHERE task_id = ?').run(id)
    return tx.changes > 0
  }

  /* ---------------- Trigger ---------------- */

  listTriggers(taskId?: string): Trigger[] {
    const rows = taskId === undefined
      ? this.db.prepare('SELECT * FROM triggers ORDER BY created_at ASC').all()
      : this.db.prepare('SELECT * FROM triggers WHERE task_id = ? ORDER BY created_at ASC').all(taskId)
    return (rows as unknown as TriggerRow[]).map(rowToTrigger)
  }

  getTrigger(id: string): Trigger | undefined {
    const row = this.db.prepare('SELECT * FROM triggers WHERE id = ?').get(id) as unknown as TriggerRow | undefined
    return row === undefined ? undefined : rowToTrigger(row)
  }

  addTrigger(taskId: string, input: TriggerInput): Trigger | undefined {
    const task = this.getTask(taskId)
    if (task === undefined) return undefined
    const now = new Date().toISOString()
    const trigger: Trigger = {
      ...input,
      id: makeId('trigger'),
      task_id: taskId,
      created_at: now,
      updated_at: now,
    }
    this.db.prepare(`
      INSERT INTO triggers (id, task_id, config_json, enabled, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(trigger.id, taskId, stringifyJson(trigger.config), trigger.enabled ? 1 : 0, now, now)
    return trigger
  }

  updateTrigger(id: string, patch: Partial<TriggerInput>): Trigger | undefined {
    const existing = this.getTrigger(id)
    if (existing === undefined) return undefined
    const next: Trigger = { ...existing, ...patch, id, updated_at: new Date().toISOString() }
    this.db.prepare(`
      UPDATE triggers SET config_json = ?, enabled = ?, updated_at = ? WHERE id = ?
    `).run(stringifyJson(next.config), next.enabled ? 1 : 0, next.updated_at, id)
    return next
  }

  deleteTrigger(id: string): boolean {
    const tx = this.db.prepare('DELETE FROM triggers WHERE id = ?').run(id)
    return tx.changes > 0
  }

  /* ---------------- Run ---------------- */

  listRuns(filter?: { taskId?: string; status?: RunStatus; limit?: number }): Run[] {
    const clauses: string[] = []
    const params: unknown[] = []
    if (filter?.taskId !== undefined) {
      clauses.push('task_id = ?')
      params.push(filter.taskId)
    }
    if (filter?.status !== undefined) {
      clauses.push('status = ?')
      params.push(filter.status)
    }
    const where = clauses.length > 0 ? ` WHERE ${clauses.join(' AND ')}` : ''
    const limit = filter?.limit ?? 100
    const rows = this.db.prepare(
      `SELECT * FROM runs${where} ORDER BY scheduled_at DESC LIMIT ${Math.max(1, Math.min(limit, 1000))}`,
    ).all(...params as SQLInputValue[]) as unknown as RunRow[]
    return rows.map(rowToRun)
  }

  getRun(id: string): Run | undefined {
    const row = this.db.prepare('SELECT * FROM runs WHERE id = ?').get(id) as unknown as RunRow | undefined
    return row === undefined ? undefined : rowToRun(row)
  }

  createRun(run: Run): Run {
    this.db.prepare(`
      INSERT INTO runs (id, task_id, trigger_id, scheduled_at, started_at, finished_at,
        status, attempt, output, error, exit_code, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      run.id, run.task_id, run.trigger_id, run.scheduled_at,
      run.started_at ?? null, run.finished_at ?? null, run.status, run.attempt,
      run.output ?? null, run.error ?? null, run.exit_code ?? null,
      run.created_at, run.updated_at,
    )
    return run
  }

  updateRun(id: string, patch: Partial<Run>): Run | undefined {
    const existing = this.getRun(id)
    if (existing === undefined) return undefined
    const next: Run = { ...existing, ...patch, id, updated_at: new Date().toISOString() }
    this.db.prepare(`
      UPDATE runs SET scheduled_at = ?, started_at = ?, finished_at = ?, status = ?,
        attempt = ?, output = ?, error = ?, exit_code = ?, updated_at = ?
      WHERE id = ?
    `).run(
      next.scheduled_at, next.started_at ?? null, next.finished_at ?? null, next.status,
      next.attempt, next.output ?? null, next.error ?? null, next.exit_code ?? null,
      next.updated_at, id,
    )
    return next
  }

  /* ---------------- Run 日志 ---------------- */

  appendRunLog(runId: string, line: string): void {
    const existing = this.db.prepare('SELECT lines FROM run_logs WHERE run_id = ?').get(runId) as
      | { lines: string }
      | undefined
    const next = existing === undefined ? line : `${existing.lines}${existing.lines === '' ? '' : '\n'}${line}`
    if (existing === undefined) {
      this.db.prepare('INSERT INTO run_logs (run_id, lines) VALUES (?, ?)').run(runId, next)
    } else {
      this.db.prepare('UPDATE run_logs SET lines = ? WHERE run_id = ?').run(next, runId)
    }
    // 人类可读副本：logs/run_<runId>.log
    try {
      const file = join(this.logsDir, `${runId}.log`)
      appendFileSync(file, `${line}\n`)
    } catch {
      // 日志文件写入失败不影响主流程。
    }
  }

  readRunLog(runId: string): string[] {
    const row = this.db.prepare('SELECT lines FROM run_logs WHERE run_id = ?').get(runId) as
      | { lines: string }
      | undefined
    if (row === undefined) {
      // 回退到文件副本。
      const file = join(this.logsDir, `${runId}.log`)
      if (existsSync(file)) {
        try {
          return readFileSync(file, 'utf8').split(/\r?\n/).filter(line => line !== '')
        } catch {
          return []
        }
      }
      return []
    }
    return row.lines === '' ? [] : row.lines.split('\n')
  }
}

/** 供测试用的临时存储（不干扰真实数据）。 */
export function createMemoryStore(): { store: AutomationStore; dbPath: string } {
  const dir = join(process.cwd(), '.test-runs', `automation-${rand()}`)
  const store = new SqliteAutomationStore({ homeDir: dir })
  return { store, dbPath: dir }
}
