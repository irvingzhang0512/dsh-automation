/**
 * 本插件的宿主 Context 类型：vendored cordis Context 与所需服务面的
 * 结构镜像的交叉类型（与 dsh-better-sidebar-controller 同一做法——
 * 不重复 declare module 避免 TS2717）。
 */
import type { Context as CordisContext } from '@deepseek-ai/cordis'
import type { SkillRegistration } from '@deepseek-ai/dsh-skill'
import type { IncomingMessage, ServerResponse } from 'node:http'

/** webServer 服务面（HTTP 路由 + WebSocket upgrade）。 */
export interface AutomationWebServer {
  register(options: {
    kind: 'exact' | 'prefix'
    path: string
    handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>
  }): () => void
  registerUpgrade(options: {
    path: string
    handler: (req: IncomingMessage, socket: unknown, head: Buffer) => void | Promise<void>
  }): () => void
}

/** webRuntime 服务面（可信主机列表）。 */
export interface AutomationWebRuntime {
  readonly trustedHosts: readonly string[]
}

/** skills 服务面（技能注册中心，可选）。 */
export interface AutomationSkills {
  register(skill: SkillRegistration): () => void
}

/** tools 服务面。 */
export interface AutomationTools {
  register(tool: unknown): () => void
}

/** agents 服务面（Agent 注册中心；执行 skill / agent_prompt 用，可选）。 */
export interface AutomationAgents {
  create(options: {
    sessionId: string
    meta?: { cwd?: string; agentPreset?: string }
    agentOptions?: { provider?: string; model?: string }
    setup?: (agentCtx: CordisContext, agent: unknown) => void
  }): Promise<{ agent: { id: string; followup(message: unknown): void; whenIdle(): Promise<void>; cancel(cause: string): void; session: unknown }; dispose(): Promise<void> }>
}

/** 本插件看到的 Context。 */
export interface AutomationContextShape {
  webServer: AutomationWebServer
  webRuntime: AutomationWebRuntime
  skills?: AutomationSkills
  tools: AutomationTools
  agents?: AutomationAgents
  /** cordis 生命周期工具。 */
  effect(fn: () => (() => void) | void, label?: string): void
  get<T = unknown>(name: string): T | undefined
  provide<T>(name: string, value: T): () => void
}

/** 结构镜像 + vendored cordis Context 的交叉类型。 */
export type Context = CordisContext & AutomationContextShape
