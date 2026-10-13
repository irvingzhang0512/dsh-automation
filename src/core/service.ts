/**
 * AutomationService：dsh-automation 的核心调度服务。
 *
 * 组装：
 * - Trigger Engine：轮询计算到期 Trigger，创建 Run 并入队；
 * - Task Queue：等待执行的 pending Run；
 * - Worker：真正执行 Action；
 * - Run Manager：运行中管理（取消 / 超时）；
 * - Retry：失败重试；
 * - Storage：SQLite 持久化。
 *
 * 生命周期：start() / stop()。与 Web 生命周期解耦——服务由宿主进程承载，
 * 客户端关闭不拥有任务生命周期；宿主关闭停止调度，重启按明确恢复规则处理。
 *
 * 并发策略（需求 §19）：
 * - skip（默认）：已有同任务运行中 → 本次 Run 标记 skipped；
 * - queue：等待上一次完成后执行（重新按计划时刻排队）；
 * - parallel：允许同时运行多个实例。
 */
import type {
  AutomationId, AutomationStore, AutomationResult, CreateTaskInput, HistoryRun, Run,
  RunStatus, Task, Trigger, TriggerConfig, TriggerInput, UpcomingRun,
} from '../shared/types.ts'
import { normalizeTrigger, nextOccurrence, triggerLabel, onceInstant, systemTimeZone, legacyRuleIssue } from '../shared/time.ts'
import { TaskQueue } from './queue.ts'
import { AutomationWorker, type ActionExecutor, type ActionLogFn } from './worker.ts'
import { RunManager, type ActiveRun } from './run-manager.ts'

/** 调度轮询间隔（ms）。 */
export const SCHEDULER_TICK_MS = 1000

/** 服务配置。 */
export interface AutomationServiceOptions {
  /** 默认超时秒数（任务未配置时）；0 = 不限。 */
  defaultTimeoutSeconds?: number
  /** 调度轮询间隔（测试可调）。 */
  tickMs?: number
  /** 运行时配置提供者（settings 接入后优先于静态值）。 */
  configProvider?: () => { defaultTimeoutSeconds?: number; tickMs?: number; keepBackups?: number }
  /** 日志写入器（服务级日志）。 */
  logger?: (line: string) => void
}

/** 宿主依赖（执行器解析等）。 */
export interface AutomationHostDeps {
  /** 按直接 Action 类型解析执行器，旧模型动作不可执行。 */
  resolveExecutor(action: Task['action']): ActionExecutor | undefined
  canExecute?: () => boolean
  runtimeFacts?: () => unknown
}

/** 服务状态。 */
export interface ServiceStatus {
  running: boolean
  queued: number
  active: number
  tickMs: number
  compatibility?: unknown
  /** 数据目录（持久化位置）。 */
  homeDir: string
  startedAt?: string
}

/** 内部：一次待调度的触发条目。 */
interface ScheduleEntry {
  trigger: Trigger
  task: Task
  nextAt: number
}

/** 触发结果。 */
export interface TriggerResult {
  run?: Run
  skipped?: boolean
  reason?: string
}

export class AutomationService {
  private readonly store: AutomationStore
  private readonly deps: AutomationHostDeps
  private readonly options: Required<Pick<AutomationServiceOptions, 'defaultTimeoutSeconds' | 'tickMs'>>
  private readonly logger: (line: string) => void

  private readonly queue = new TaskQueue()
  private readonly worker: AutomationWorker
  private readonly runManager: RunManager

  private schedule: ScheduleEntry[] = []
  private timer: ReturnType<typeof setInterval> | undefined
  private startedAt: string | undefined
  private running = false
  private stopped = false
  private disposed = false
  private readonly jobs = new Set<Promise<void>>()
  private quiescing = false


  constructor(store: AutomationStore, deps: AutomationHostDeps, options: AutomationServiceOptions = {}) {
    this.store = store
    this.deps = deps
    // 配置优先级：configProvider（初始化读取）> 静态 options > 默认值。
    const provided = options.configProvider?.() ?? {}
    this.options = {
      defaultTimeoutSeconds: provided.defaultTimeoutSeconds ?? options.defaultTimeoutSeconds ?? 1800,
      tickMs: provided.tickMs ?? options.tickMs ?? SCHEDULER_TICK_MS,
    }
    this.logger = options.logger ?? (() => {})
    this.worker = new AutomationWorker({ resolveExecutor: (action) => deps.resolveExecutor(action) })
    this.runManager = new RunManager({
      updateRun: (id, patch) => this.store.updateRun(id, patch),
      appendRunLog: (id, line) => this.store.appendRunLog(id, line),
      onFinish: (entry, finalStatus) => this.finishActive(entry, finalStatus),
      defaultTimeoutSeconds: this.options.defaultTimeoutSeconds,
    })
  }

  /* ---------------- 生命周期 ---------------- */

  /** 启动调度循环（幂等）。 */
  start(): void {
    if (this.disposed) return
    if (this.running) return
    this.stopped = false
    this.running = true
    this.recoverLegacyAndInterrupted()
    this.startedAt = new Date().toISOString()
    this.rebuildSchedule()
    // 恢复：把持久化里 pending 的 Run 重新入队（服务重启恢复）。
    for (const run of (this.store.unfinishedRuns?.() ?? this.store.listRuns({ status: 'pending', limit: 1000 })).filter(run => run.status === 'pending')) {
      this.queue.enqueue(run)
    }
    this.logger('[automation] 调度服务已启动。')
    this.timer = setInterval(() => {
      void this.tick().catch((err) => {
        this.logger(`[automation] 调度 tick 异常：${err instanceof Error ? err.message : String(err)}`)
      })
    }, this.options.tickMs)
    this.timer.unref?.()
  }

  /** 停止调度循环（幂等；不终止已运行任务）。 */
  stop(): void {
    if (!this.running) return
    this.running = false
    if (this.timer !== undefined) {
      clearInterval(this.timer)
      this.timer = undefined
    }
    // 清除重试定时器，但保留队列（下次 start 恢复）。
    this.logger('[automation] 调度服务已停止。')
  }

  /** 服务当前状态。 */
  status(): ServiceStatus {
    return {
      running: this.running,
      compatibility: this.deps.runtimeFacts?.(),
      queued: this.queue.size,
      active: this.runManager.size,
      tickMs: this.options.tickMs,
      homeDir: this.store.homeDir,
      ...(this.startedAt !== undefined ? { startedAt: this.startedAt } : {}),
    }
  }

  /** 卸载：停止调度、终止运行中任务、关闭队列。 */
  dispose(): Promise<void> {
    this.disposed = true
    this.stopped = true
    this.stop()
    this.runManager.abortAll('服务卸载')
    this.queue.clear('服务卸载')
    this.runManager.dispose()
    return Promise.allSettled([...this.jobs]).then(() => undefined)
  }

  async quiesce(): Promise<void> { this.quiescing = true; this.stop(); await Promise.allSettled([...this.jobs]) }
  resume(): void { this.quiescing = false; this.start() }
  get busy(): boolean { return this.runManager.size > 0 || this.jobs.size > 0 }
  private recoverLegacyAndInterrupted(): void {
    const oldTasks = this.store.listTasks().filter(task => !isDirectAction(task.action) && task.enabled)
    const reviewTriggers = this.store.listTriggers().filter(trigger => trigger.enabled && !trigger.config.time_zone && legacyRuleIssue(trigger.config))
    if ((oldTasks.length || reviewTriggers.length) && !this.store.getMeta?.('legacy-guard-backup')) {
      const backup = this.store.backupNow?.(true)
      if (!backup) throw Error('无法备份旧任务；拒绝修改旧状态。')
      this.store.setMeta?.('legacy-guard-backup', { backup, createdAt: new Date().toISOString() })
    }
    for (const task of this.store.listTasks()) {
      if (!isDirectAction(task.action) && task.enabled) this.store.updateTask(task.id, { enabled: false })
    }
    for (const run of (this.store.unfinishedRuns?.() ?? this.store.listRuns({ status: 'running', limit: 1000 })).filter(run => run.status === 'running')) {
      this.store.updateRun(run.id, { status: 'failed', error: '宿主中断，执行结果未知；未自动重跑。', finished_at: new Date().toISOString() })
    }
    for (const run of (this.store.unfinishedRuns?.() ?? this.store.listRuns({ status: 'pending', limit: 1000 })).filter(run => run.status === 'pending')) {
      const task = this.store.getTask(run.task_id)
      if (!task || !isDirectAction(task.action)) this.store.updateRun(run.id, { status: 'cancelled', error: '旧模型任务已停用，请迁移到官方 Schedule。', finished_at: new Date().toISOString() })
    }
    for (const trigger of this.store.listTriggers()) {
      const issue = !trigger.config.time_zone ? legacyRuleIssue(trigger.config) : undefined
      if (issue && trigger.enabled) {
        this.store.setMeta?.('review:' + trigger.id, { issue, originalEnabled: true })
        this.store.updateTrigger(trigger.id, { enabled: false })
      }
    }
  }

  /* ---------------- 调度核心 ---------------- */

  /** 重建调度表（任务 / Trigger 变更后调用）。 */
  rebuildSchedule(): void {
    const now = Date.now()
    const entries: ScheduleEntry[] = []
    for (const task of this.store.listTasks()) {
      if (!task.enabled || !isDirectAction(task.action)) continue
      for (const trigger of this.store.listTriggers(task.id)) {
        if (!trigger.enabled) continue
        let normalized
        try {
          normalized = normalizeTrigger(trigger.config)
        } catch {
          continue
        }
        const nextAt = nextOccurrence(normalized, now)
        if (nextAt === undefined) {
          if (trigger.config.type === 'once') {
            const at = new Date(onceInstant(trigger.config)).toISOString()
            if (!this.store.hasOccurrence?.(trigger.id, at)) {
              const nowIso = new Date(now).toISOString()
              this.store.createRun({ id: 'missed_' + trigger.id, task_id: task.id, trigger_id: trigger.id, scheduled_at: at, status: 'skipped', attempt: 1, error: '已错过执行时间；未自动补跑，可手动运行。', created_at: nowIso, updated_at: nowIso, finished_at: nowIso })
            }
          }
          continue
        }
        entries.push({ trigger, task, nextAt })
      }
    }
    this.schedule = entries.sort((a, b) => a.nextAt - b.nextAt)
  }

  /** 一个调度 tick：触发到期项 + 消费队列。 */
  private async tick(): Promise<void> {
    if (this.stopped || this.quiescing || !this.running) return
    if (this.deps.canExecute && !this.deps.canExecute()) return
    const now = Date.now()
    // 1) Trigger Engine：触发到期 Trigger。
    for (const entry of [...this.schedule]) {
      if (entry.nextAt > now) continue
      const result = this.fireTrigger(entry, now)
      this.logger(
        `[trigger] ${entry.task.name}（${triggerLabel(entry.trigger.config)}）`
        + ` → ${result.run !== undefined ? `Run ${result.run.id}` : result.skipped === true ? '跳过（并发）' : '无'}`
        + (result.reason !== undefined ? `：${result.reason}` : ''),
      )
      // 计算该 Trigger 的下一次触发。
      const next = nextOccurrence(normalizeTrigger(entry.trigger.config), now)
      entry.nextAt = next ?? Number.POSITIVE_INFINITY
    }
    this.schedule = this.schedule
      .filter(entry => Number.isFinite(entry.nextAt))
      .sort((a, b) => a.nextAt - b.nextAt)

    // Dispatch synchronously, then let independent tasks run without blocking ticks.
    if (this.stopped || this.quiescing) return
    for (const run of this.queue.all()) {
      if ((this.store.getMeta?.<number>('retry:' + run.id) ?? 0) > now) continue
      if (Date.parse(run.scheduled_at) > now) continue
      const task = this.store.getTask(run.task_id)
      if (!task || !isDirectAction(task.action) || (!task.enabled && run.trigger_id !== 'manual')) {
        this.queue.remove(run.id)
        this.store.updateRun(run.id, { status: 'cancelled', error: '任务已暂停、删除或属于旧模型任务。', finished_at: new Date().toISOString() })
        continue
      }
      if (this.runManager.hasRunningForTask(task.id)) {
        if (task.concurrency === 'queue') continue
        if (task.concurrency !== 'parallel') {
          this.queue.remove(run.id)
          this.store.updateRun(run.id, { status: 'skipped', error: '上一实例仍在运行（策略 skip）。', finished_at: new Date().toISOString() })
          continue
        }
      }
      this.queue.remove(run.id)
      this.store.setMeta?.('retry:' + run.id, null)
      const job = this.runQueued(run, task).catch(error => {
        this.store.updateRun(run.id, { status: 'failed', error: String(error), finished_at: new Date().toISOString() })
        this.runManager.finish(run.id, 'failed')
      }).finally(() => this.jobs.delete(job))
      this.jobs.add(job)
    }
  }

  /** 触发一个 Trigger：创建 Run 并应用并发策略。 */
  private fireTrigger(entry: ScheduleEntry, now: number): TriggerResult {
    const task = entry.task
    const trigger = entry.trigger
    const scheduledAt = new Date(entry.nextAt).toISOString()
    if (this.store.hasOccurrence?.(entry.trigger.id, scheduledAt)) return { skipped: true, reason: '该计划时刻已记录。' }
    const run: Run = {
      id: `run_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      task_id: task.id,
      trigger_id: trigger.id,
      scheduled_at: scheduledAt,
      status: 'pending',
      attempt: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    // 并发策略：skip（默认）。
    const policy = task.concurrency ?? 'skip'
    if (policy === 'skip' && this.runManager.hasRunningForTask(task.id)) {
      this.store.createRun({ ...run, status: 'skipped' })
      return { skipped: true, reason: '上一实例仍在运行（策略 skip）' }
    }
    if (policy === 'parallel') {
      // 允许并发，直接入队。
      this.store.createRun(run)
      this.queue.enqueue(run)
      return { run }
    }
    // skip（无冲突）/ queue 都先入队；queue 语义由调度保证串行（同一时刻只消费一个）。
    this.store.createRun(run)
    this.queue.enqueue(run)
    return { run }
  }

  /** 执行一个已出队的 Run（含重试与状态流转）。 */
  private async runQueued(run: Run, task: Task): Promise<void> {
    const active = this.runManager.start(run, task)
    const log: ActionLogFn = (line) => {
      this.store.appendRunLog(run.id, line)
    }
    log(`[run] 开始执行（attempt ${run.attempt}）。`)
    const result = await this.worker.execute(task, run, active.controller.signal, log)
    const now = new Date().toISOString()

    if (active.controller.signal.aborted) {
      const reason = active.controller.signal.reason
      const isTimeout = reason === 'timeout'
      this.store.updateRun(run.id, {
        status: isTimeout ? 'timeout' : 'cancelled',
        error: result.error ?? (isTimeout ? `超过超时时间（${task.timeout_seconds ?? this.options.defaultTimeoutSeconds}s）` : '已取消。'),
        output: result.output,
        exit_code: result.exit_code,
        finished_at: now,
      })
      this.runManager.finish(run.id, isTimeout ? 'timeout' : 'cancelled')
      return
    }

    if (result.error === undefined) {
      this.store.updateRun(run.id, { status: 'success', output: result.output, exit_code: result.exit_code, finished_at: now })
      log('[run] 执行成功。')
      this.runManager.finish(run.id, 'success')
      return
    }

    // 失败：重试判断。
    const retry = task.retry
    const canRetry = retry?.enabled === true && run.attempt <= (retry.max_attempts ?? 0)
    if (canRetry) {
      const nextAttempt = run.attempt + 1
      const delayMs = (retry?.delay_seconds ?? 60) * 1000
      this.store.setMeta?.('retry:' + run.id, Date.now() + delayMs)
      log(`[retry] 第 ${run.attempt} 次失败，${delayMs / 1000}s 后重试（第 ${nextAttempt} 次）。`)
      this.store.updateRun(run.id, {
        status: 'pending',
        output: result.output,
        error: result.error,
        exit_code: result.exit_code,
        attempt: nextAttempt,
      })
      this.runManager.finish(run.id, 'pending')
      const retried = this.store.getRun(run.id)
      if (retried !== undefined) this.queue.enqueue(retried)
      return
    }

    this.store.updateRun(run.id, {
      status: 'failed',
      output: result.output,
      error: result.error,
      exit_code: result.exit_code,
      finished_at: now,
    })
    log(`[run] 执行失败：${result.error}`)
    this.runManager.finish(run.id, 'failed')
  }

  /** Run Manager 完成回调（落定时状态）。 */
  private finishActive(entry: ActiveRun, finalStatus: RunStatus): void {
    // 最终状态已由 runQueued 落库；这里只做清理确认。
    void entry
    void finalStatus
  }

  /* ---------------- 查询 / 运行控制 API ---------------- */

  /** 全部任务（工具 list_tasks 用）。 */
  allTasks(): Task[] {
    return this.store.listTasks()
  }

  /** 全部 Trigger（API / 工具用）。 */
  allTriggers(): Trigger[] {
    return this.store.listTriggers()
  }

  /** 获取单个 Run。 */
  getRun(runId: AutomationId): Run | undefined {
    return this.store.getRun(runId)
  }

  /** 读取 Run 日志。 */
  readRunLog(runId: AutomationId): string[] {
    return this.store.readRunLog(runId)
  }

  /** 待运行视图（未来计划 + 队列中 pending）。 */
  listUpcoming(limit = 50): UpcomingRun[] {
    const now = Date.now()
    const result: UpcomingRun[] = []
    const seen = new Set<AutomationId>()
    // 1) 调度表中的未来触发。
    for (const entry of this.schedule) {
      if (result.length >= limit) break
      result.push({
        run_id: `upcoming_${entry.trigger.id}`,
        task_id: entry.task.id,
        task_name: entry.task.name,
        trigger_id: entry.trigger.id,
        trigger_label: triggerLabel(entry.trigger.config),
        scheduled_at: new Date(entry.nextAt).toISOString(),
        action: entry.task.action,
      })
      seen.add(`upcoming_${entry.trigger.id}`)
    }
    // 2) 队列中 pending 的 Run。
    for (const run of this.queue.all()) {
      if (result.length >= limit) break
      if (run.status !== 'pending') continue
      const task = this.store.getTask(run.task_id)
      if (task === undefined) continue
      const trigger = this.store.getTrigger(run.trigger_id)
      result.push({
        run_id: run.id,
        task_id: task.id,
        task_name: task.name,
        trigger_id: run.trigger_id,
        trigger_label: trigger !== undefined ? triggerLabel(trigger.config) : '手动',
        scheduled_at: run.scheduled_at,
        action: task.action,
      })
    }
    return result.slice(0, limit)
  }

  /** 运行中视图。 */
  listRunning(): import('../shared/types.ts').RunningRun[] {
    return this.runManager.runningList()
  }

  /** 历史视图。 */
  listHistory(filter?: { taskId?: string; status?: RunStatus; limit?: number }): HistoryRun[] {
    const runs = this.store.listRuns({ ...filter, limit: filter?.limit ?? 100 })
    const tasks = new Map(this.store.listTasks().map(t => [t.id, t]))
    return runs.map(run => {
      const entry: HistoryRun = {
        run_id: run.id,
        task_id: run.task_id,
        task_name: tasks.get(run.task_id)?.name ?? run.task_id,
        scheduled_at: run.scheduled_at,
        status: run.status,
      }
      if (run.started_at !== undefined) entry.started_at = run.started_at
      if (run.finished_at !== undefined) entry.finished_at = run.finished_at
      if (run.started_at !== undefined && run.finished_at !== undefined) {
        entry.duration_ms = Date.parse(run.finished_at) - Date.parse(run.started_at)
      }
      if (run.error !== undefined) entry.error = run.error
      return entry
    })
  }

  /** 立即运行任务（创建手动 Run 入队）。 */
  runNow(taskId: AutomationId): AutomationResult {
    if (this.deps.canExecute && !this.deps.canExecute()) return { ok: false, code: 'COMPATIBILITY', message: '官方组合不匹配，已禁止直接执行。' }
    const task = this.store.getTask(taskId)
    if (task === undefined) return { ok: false, code: 'TASK_NOT_FOUND', message: `任务不存在：${taskId}` }
    if (!isDirectAction(task.action)) return officialTaskError()
    if (this.quiescing || this.stopped) return { ok: false, code: 'SERVICE_STOPPED', message: '服务已停止或正在迁移。' }
    const run: Run = {
      id: `run_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      task_id: task.id,
      trigger_id: 'manual',
      scheduled_at: new Date().toISOString(),
      status: 'pending',
      attempt: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    this.store.createRun(run)
    this.queue.enqueue(run)
    return { ok: true, code: 'OK', message: `已立即运行“${task.name}”。`, run_id: run.id }
  }

  /** 取消 Run：运行中 → 中止；队列中 → cancelled；已完成 → 无操作。 */
  cancelRun(runId: AutomationId): AutomationResult {
    if (this.quiescing) return { ok: false, code: 'SERVICE_BUSY', message: '迁移或重载期间不能修改运行。' }
    const run = this.store.getRun(runId)
    if (run === undefined) return { ok: false, code: 'RUN_NOT_FOUND', message: `运行不存在：${runId}` }
    if (run.status === 'running') {
      this.runManager.cancel(runId, '用户取消')
      return { ok: true, code: 'OK', message: `已请求取消运行 ${runId}。` }
    }
    if (run.status === 'pending') {
      this.store.setMeta?.('retry:' + runId, null)
      this.queue.cancel(runId, '用户取消')
      this.store.updateRun(runId, { status: 'cancelled', error: '用户取消。', finished_at: new Date().toISOString() })
      return { ok: true, code: 'OK', message: `已取消排队中的运行 ${runId}。` }
    }
    return { ok: false, code: 'NOT_CANCELLABLE', message: `运行已处于 ${run.status} 状态，无法取消。` }
  }

  /* ---------------- 任务 / Trigger CRUD（工具与 Web 共用） ---------------- */

  createTask(input: CreateTaskInput, triggerConfigs: TriggerConfig[] = []): AutomationResult {
    if (this.quiescing) return { ok: false, code: 'SERVICE_BUSY', message: '正在迁移或重载，请稍后重试。' }
    if (!isDirectAction(input.action)) return officialTaskError()
    const invalid = validateTaskInput(input)
    if (invalid) return { ok: false, code: 'INVALID_INPUT', message: invalid }
    let task: Task
    try {
      const configs = triggerConfigs.map(config => { const next = { ...config, time_zone: config.time_zone ?? systemTimeZone() }; normalizeTrigger(next); return next })
      const create = () => { const created = this.store.createTask(input); for (const config of configs) this.store.addTrigger(created.id, { config, enabled: true }); return created }
      task = this.store.transaction ? this.store.transaction(create) : create()
    } catch (error) { return { ok: false, code: 'INVALID_TRIGGER', message: String(error instanceof Error ? error.message : error) } }
    this.rebuildSchedule()
    return { ok: true, code: 'OK', message: `已创建任务“${task.name}”。`, task }
  }

  updateTask(id: AutomationId, patch: Partial<CreateTaskInput>): AutomationResult {
    if (this.quiescing) return { ok: false, code: 'SERVICE_BUSY', message: '正在迁移或重载，请稍后重试。' }
    const existing = this.store.getTask(id)
    if (existing && !isDirectAction(existing.action)) return officialTaskError()
    if (patch.action && !isDirectAction(patch.action)) return officialTaskError()
    if (existing) { const invalid = validateTaskInput({ ...existing, ...patch }); if (invalid) return { ok: false, code: 'INVALID_INPUT', message: invalid } }
    const task = this.store.updateTask(id, patch)
    if (task === undefined) return { ok: false, code: 'TASK_NOT_FOUND', message: `任务不存在：${id}` }
    this.rebuildSchedule()
    return { ok: true, code: 'OK', message: `已更新任务“${task.name}”。`, task }
  }

  deleteTask(id: AutomationId): AutomationResult {
    if (this.quiescing) return { ok: false, code: 'SERVICE_BUSY', message: '正在迁移或重载，请稍后重试。' }
    if (this.runManager.hasRunningForTask(id)) return { ok: false, code: 'TASK_BUSY', message: '请先取消或等待正在运行的任务。' }
    for (const run of this.queue.all()) if (run.task_id === id) this.cancelRun(run.id)
    if (this.store.deleteTask(id)) {
      this.rebuildSchedule()
      return { ok: true, code: 'OK', message: '任务已删除。' }
    }
    return { ok: false, code: 'TASK_NOT_FOUND', message: `任务不存在：${id}` }
  }

  enableTask(id: AutomationId, enabled: boolean): AutomationResult {
    if (this.quiescing) return { ok: false, code: 'SERVICE_BUSY', message: '正在迁移或重载，请稍后重试。' }
    const existing = this.store.getTask(id)
    if (enabled && existing && !isDirectAction(existing.action)) return officialTaskError()
    const task = this.store.updateTask(id, { enabled })
    if (task === undefined) return { ok: false, code: 'TASK_NOT_FOUND', message: `任务不存在：${id}` }
    this.rebuildSchedule()
    return { ok: true, code: 'OK', message: enabled ? `已启用任务“${task.name}”。` : `已暂停任务“${task.name}”。`, task }
  }

  addTrigger(taskId: AutomationId, input: TriggerInput): AutomationResult {
    if (this.quiescing) return { ok: false, code: 'SERVICE_BUSY', message: '正在迁移或重载，请稍后重试。' }
    try {
      input = { ...input, config: { ...input.config, time_zone: input.config.time_zone ?? systemTimeZone() } }
      normalizeTrigger(input.config)
    } catch (err) {
      return { ok: false, code: 'INVALID_TRIGGER', message: err instanceof Error ? err.message : String(err) }
    }
    const trigger = this.store.addTrigger(taskId, input)
    if (trigger === undefined) return { ok: false, code: 'TASK_NOT_FOUND', message: `任务不存在：${taskId}` }
    this.rebuildSchedule()
    return { ok: true, code: 'OK', message: `已为任务添加执行时间 ${triggerLabel(trigger.config)}。`, trigger }
  }

  updateTrigger(id: AutomationId, patch: Partial<TriggerInput>): AutomationResult {
    if (this.quiescing) return { ok: false, code: 'SERVICE_BUSY', message: '正在迁移或重载，请稍后重试。' }
    if (patch.config !== undefined) {
      try {
        patch = { ...patch, config: { ...patch.config, time_zone: patch.config.time_zone ?? systemTimeZone() } as TriggerConfig }
        normalizeTrigger(patch.config!)
      } catch (err) {
        return { ok: false, code: 'INVALID_TRIGGER', message: err instanceof Error ? err.message : String(err) }
      }
    }
    const trigger = this.store.updateTrigger(id, patch)
    if (trigger && patch.config) this.store.setMeta?.('review:' + id, null)
    if (trigger === undefined) return { ok: false, code: 'TRIGGER_NOT_FOUND', message: `执行时间不存在：${id}` }
    this.rebuildSchedule()
    return { ok: true, code: 'OK', message: '执行时间已更新。', trigger }
  }

  deleteTrigger(id: AutomationId): AutomationResult {
    if (this.quiescing) return { ok: false, code: 'SERVICE_BUSY', message: '正在迁移或重载，请稍后重试。' }
    if (this.store.deleteTrigger(id)) {
      this.rebuildSchedule()
      return { ok: true, code: 'OK', message: '执行时间已删除。' }
    }
    return { ok: false, code: 'TRIGGER_NOT_FOUND', message: `执行时间不存在：${id}` }
  }

  /** 获取任务及其 Trigger（详情页数据）。 */
  getTaskDetail(id: AutomationId): AutomationResult {
    const task = this.store.getTask(id)
    if (task === undefined) return { ok: false, code: 'TASK_NOT_FOUND', message: `任务不存在：${id}` }
    const triggers = this.store.listTriggers(id)
    const runs = this.store.listRuns({ taskId: id, limit: 20 })
    return { ok: true, code: 'OK', message: 'ok', task, triggers, runs }
  }
}

/** 便捷：Trigger 标签导出（工具/Web 用）。 */
export { triggerLabel }
export type { TriggerConfig }

export function isDirectAction(action: Task['action']): boolean { return action?.type === 'command' || action?.type === 'script' }
function officialTaskError(): AutomationResult { return { ok: false, code: 'USE_OFFICIAL_SCHEDULE', message: '会话/Skill任务请在原会话使用官方 schedule_create；旧任务请从迁移入口选择目标会话。' } }
function validateTaskInput(input: CreateTaskInput): string | undefined {
  if (input.action.type !== 'command' && input.action.type !== 'script') return '请使用官方会话任务。'
  if (!input.name?.trim()) return '请填写任务名称。'
  if (typeof input.enabled !== 'boolean') return '启用状态须为布尔值。'
  if (input.context?.cwd !== undefined && typeof input.context.cwd !== 'string') return '工作目录须为文本。'
  if (input.context?.env && (Array.isArray(input.context.env) || typeof input.context.env !== 'object' || Object.entries(input.context.env).some(([key,value]) => !key || key.includes('=') || typeof value !== 'string'))) return '环境变量须为名称与文本值的映射。'
  if (input.action.type === 'command' && !input.action.command?.trim()) return '请填写命令。'
  if (input.action.type === 'script' && !input.action.path?.trim()) return '请填写脚本路径。'
  if (input.action.args && (!Array.isArray(input.action.args) || input.action.args.some(value => typeof value !== 'string'))) return '参数必须是字符串列表。'
  if (input.timeout_seconds !== undefined && (!Number.isSafeInteger(input.timeout_seconds) || input.timeout_seconds < 0)) return '超时须为非负整数秒；0表示不限。'
  if (input.concurrency && !['skip','queue','parallel'].includes(input.concurrency)) return '非法重叠策略。'
  if (input.retry && (!Number.isSafeInteger(input.retry.max_attempts) || input.retry.max_attempts < 0 || !Number.isSafeInteger(input.retry.delay_seconds) || input.retry.delay_seconds < 0)) return '重试次数和间隔须为非负整数。'
  return undefined
}
