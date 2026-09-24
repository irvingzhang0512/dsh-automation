/**
 * dsh-automation 插件配置：schemastery schema 定义、默认值与类型推导。
 *
 * 配置经 DSH 设置系统（ctx.settings）注册——宿主通用设置 UI 依据 schema
 * 自动渲染「自动任务」设置卡，保存到 `<DSH_HOME>/settings.yaml`。
 * 变更实时生效（applies: 'live'），代码通过 getConfig() 读取当前值。
 */
import Schema from '@deepseek-ai/schemastery'

/** 配置项语义说明。 */
export const AUTOMATION_CONFIG_NS = 'dsh-automation' as const

/**
 * 插件配置 schema。
 *
 * - `dataDir`：数据目录覆盖；留空（默认）自动解析为 DSH 统一数据目录下的
 *   `automation/`（`$DSH_DATA_DIR` → `$DSH_HOME/data/automation` → `~/.dsh/data/automation`）。
 * - `defaultTimeoutSeconds`：任务未单独配置超时时的默认值。
 * - `tickMs`：调度轮询间隔（毫秒）。变更后需重启生效（服务启动时快照）。
 * - `keepBackups`：SQLite 备份保留份数（长期持久化）。
 */
export const AutomationConfigSchema = Schema.object({
  dataDir: Schema.string()
    .description('数据目录覆盖；留空自动解析为 DSH 数据目录下的 automation/')
    .default(''),
  defaultTimeoutSeconds: Schema.natural()
    .description('任务默认超时秒数（任务未单独配置时）')
    .default(1800),
  tickMs: Schema.natural()
    .description('调度轮询间隔（毫秒）；修改后需重启 DSH 生效')
    .default(1000),
  keepBackups: Schema.natural()
    .description('SQLite 备份保留份数')
    .default(10),
})

/** 配置类型（精确；schemastery 推导类型过宽含 null，此处手工固定）。 */
export interface AutomationConfig {
  /** 数据目录覆盖；空串表示按 DSH 规范自动解析。 */
  dataDir: string
  /** 任务默认超时秒数。 */
  defaultTimeoutSeconds: number
  /** 调度轮询间隔（毫秒）。 */
  tickMs: number
  /** SQLite 备份保留份数。 */
  keepBackups: number
}

/** 兜底默认配置（settings 服务缺失 / schema 解析失败时）。 */
export const DEFAULT_CONFIG: AutomationConfig = {
  dataDir: '',
  defaultTimeoutSeconds: 1800,
  tickMs: 1000,
  keepBackups: 10,
}

/** 从任意来源（可能含非法/缺失字段）归一化为合法配置。 */
export function normalizeConfig(raw: unknown): AutomationConfig {
  const value = (raw ?? {}) as Partial<Record<keyof AutomationConfig, unknown>>
  return {
    dataDir: typeof value.dataDir === 'string' ? value.dataDir : DEFAULT_CONFIG.dataDir,
    defaultTimeoutSeconds: typeof value.defaultTimeoutSeconds === 'number' && value.defaultTimeoutSeconds > 0
      ? Math.floor(value.defaultTimeoutSeconds)
      : DEFAULT_CONFIG.defaultTimeoutSeconds,
    tickMs: typeof value.tickMs === 'number' && value.tickMs > 0
      ? Math.floor(value.tickMs)
      : DEFAULT_CONFIG.tickMs,
    keepBackups: typeof value.keepBackups === 'number' && value.keepBackups >= 0
      ? Math.floor(value.keepBackups)
      : DEFAULT_CONFIG.keepBackups,
  }
}
