/**
 * dsh-automation —— 宿主半区。
 *
 * 职责：
 * - 启动 AutomationService（Trigger Engine / Queue / Worker / Run Manager /
 *   Retry / SQLite 持久化），与 Web 生命周期解耦；
 * - 注册 16 个 automation.* 工具；
 * - 注册 /api/automation REST 路由；
 * - 自注册打包的中文 Skill（skills/automation/SKILL.md）；
 * - 提供 automationService 服务（Web 客户端经 API 使用）。
 *
 * 依赖：tools、webServer、webRuntime、skills 必需；agents（dsh-agent-loop）
 * 可选——缺失时 skill / agent_prompt 类 Action 报"宿主未提供对应执行器"，
 * command / script 仍可用。
 */
import { WebSocketServer } from 'ws'
import type { IncomingMessage } from 'node:http'
import type { Duplex } from 'node:stream'
import { AutomationService } from './core/service.ts'
import { ChildProcessExecutor } from './actions/process.ts'
import { AgentActionExecutor, makeSkillLoader } from './actions/agent.ts'
import { SqliteAutomationStore, resolveAutomationDataDir } from './storage/sqlite.ts'
import { loadBundledSkill, BUNDLED_SKILL_DIR } from './host/skill-registration.ts'
import { AUTOMATION_CONFIG_NS, AutomationConfigSchema, DEFAULT_CONFIG, normalizeConfig, type AutomationConfig } from './host/config.ts'
import { isTrustedApiRequest } from './shared/request-trust.ts'
import { registerAutomationTools } from './tools/automation-tools.ts'
import { mountAutomationRoutes } from './server/api.ts'
import type { Context } from './context-types.ts'

/** cordis.yml 行用的插件标识。 */
export const name = 'dsh-automation'

/** 挂载前必需的服务（settings 为软依赖，缺失时用默认配置）。 */
export const inject = ['tools', 'webServer', 'webRuntime', 'skills', 'settings']

/** 服务状态推送 WebSocket 路径。 */
export const BRIDGE_PATH = '/automation/ws'

/**
 * 插件主体：启动自动化服务、挂载工具 / API / 桥。
 * @param ctx - 宿主插件上下文（tools、webServer、webRuntime、skills、agents、settings）。
 */
export function apply(ctx: Context, config: Partial<AutomationConfig> = {}): void {
  // 实时配置：settings 服务存在时注册 namespace，变更立即生效；否则用 base+默认。
  let getConfig: () => AutomationConfig = () => normalizeConfig({ ...DEFAULT_CONFIG, ...config })
  const settings = ctx.settings
  if (settings?.register !== undefined) {
    ctx.inject(['settings'], (sctx) => {
      const scope = sctx.settings?.register?.(AUTOMATION_CONFIG_NS, AutomationConfigSchema, {
        base: normalizeConfig(config),
        applies: 'live',
      })
      if (scope !== undefined) {
        getConfig = () => normalizeConfig(scope.get() as unknown)
        scope.watch((next) => {
          getConfig = () => normalizeConfig(next as unknown)
        })
      }
      sctx.effect(() => () => {
        getConfig = () => normalizeConfig({ ...DEFAULT_CONFIG, ...config })
      }, 'dsh-automation: settings cleanup')
    })
  }

  // 数据目录：DSH 统一规范解析（配置 dataDir 可覆盖）。
  const cfg = getConfig()
  const homeDir = resolveAutomationDataDir(process.env, undefined, cfg.dataDir)
  const store = new SqliteAutomationStore({ homeDir, keepBackups: cfg.keepBackups })
  const service = new AutomationService(store, {
    resolveExecutor: (action) => {
      if (action.type === 'command' || action.type === 'script') {
        return processExecutor
      }
      if (action.type === 'skill' || action.type === 'agent_prompt') {
        return buildAgentExecutor(ctx)
      }
      return undefined
    },
  }, {
    configProvider: () => getConfig(),
    defaultTimeoutSeconds: cfg.defaultTimeoutSeconds,
    tickMs: cfg.tickMs,
    logger: (line) => {
      // 服务级日志：第一版输出到 stderr（避免污染 stdout 协议面）。
      process.stderr.write(`[dsh-automation] ${line}\n`)
    },
  })

  // 启动调度服务（宿主进程承载；Web 重启不影响）。
  service.start()

  // 对外提供服务（Web 客户端 / 其他插件可注入）。
  const removeService = ctx.provide('automationService', {
    id: 'dsh-automation' as const,
    service,
  })

  // 状态推送 WebSocket（运行中 / 状态实时更新；第一版为可选增强）。
  // 信任围栏：与 REST API 同一实现（Host 回环/可信权威 + 同源标记）。
  const fence = (req: IncomingMessage): boolean =>
    isTrustedApiRequest(req, ctx.webRuntime.trustedHosts)
  const wss = new WebSocketServer({ noServer: true })
  const bridgeDisposer = ctx.webServer.registerUpgrade({
    path: BRIDGE_PATH,
    handler: (req, socket, head) => {
      const incoming = req as IncomingMessage
      if (!fence(incoming)) {
        ;(socket as unknown as Duplex).destroy()
        return
      }
      wss.handleUpgrade(incoming, socket as unknown as Duplex, head as Buffer, (ws) => {
        ws.send(JSON.stringify({ type: 'hello', status: service.status() }))
        const tick = setInterval(() => {
          if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({ type: 'status', status: service.status() }))
          }
        }, 5000)
        ws.on('close', () => clearInterval(tick))
      })
    },
  })

  // 工具注册。
  const toolsDisposer = registerAutomationTools(ctx, { service })

  // REST API。
  const apiDisposer = mountAutomationRoutes(ctx, service)

  // 自注册打包的 SKILL.md。
  ctx.effect(() => {
    const skills = ctx.skills
    let disposed = false
    let skillDisposer: (() => void) | undefined
    if (skills?.register !== undefined) {
      void loadBundledSkill().then((skill) => {
        if (disposed || skill === undefined) return
        skillDisposer = skills.register(skill)
      })
    }
    return () => {
      disposed = true
      skillDisposer?.()
    }
  }, 'dsh-automation: bundled skill')

  ctx.effect(() => () => {
    service.dispose()
    removeService()
    toolsDisposer()
    apiDisposer()
    bridgeDisposer()
    wss.close()
    try {
      store.close()
    } catch {
      // 忽略关闭异常。
    }
  }, 'dsh-automation: teardown')
}

/** Command / Script 执行器单例。 */
const processExecutor = new ChildProcessExecutor()

/** Skill / Agent Prompt 执行器（依赖 ctx.agents；缺失返回 undefined）。 */
function buildAgentExecutor(ctx: Context): AgentActionExecutor | undefined {
  const agents = ctx.agents
  if (agents === undefined) return undefined
  const bundledSkillUrl = new URL(`${BUNDLED_SKILL_DIR}/SKILL.md`, import.meta.url)
  const bundledSkillDir = decodeURIComponent(bundledSkillUrl.pathname)
    .replace(/\/SKILL\.md$/, '')
  return new AgentActionExecutor({
    createAgent: async (options) => {
      const handle = await agents.create({
        sessionId: options.sessionId,
        meta: { cwd: options.cwd },
        setup: options.setup,
      })
      return {
        agent: handle.agent as never,
        dispose: () => handle.dispose(),
      }
    },
    skills: makeSkillLoader(ctx.skills),
    bundledSkillDir,
  })
}
