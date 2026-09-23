/**
 * Skill / Agent Prompt Action 执行器：通过 DSH agent runtime 执行。
 *
 * 执行方式：为每次 Run 创建一个一次性 agent 会话，把任务 Prompt
 * （skill 类型则注入 skill 内容 + 附加指令）作为 followup 发送，等待
 * agent 收敛（whenIdle）后读取会话最终输出。
 *
 * 依赖宿主 `ctx.agents`（dsh-agent-loop 提供）。宿主未提供时，
 * resolveExecutor 返回 undefined → Worker 报"宿主未提供对应执行器"。
 *
 * 注意：agent 执行是长期任务（分钟 ~ 小时级），与 dsh web 生命周期解耦
 * （由宿主进程承载，Web 重启不中断）。
 */
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { AgentPromptActionSpec, SkillActionSpec } from '../shared/types.ts'
import type { ActionExecutor, ActionExecutionResult, ActionLogFn } from '../core/worker.ts'
import type { AutomationSkills } from '../context-types.ts'

/** Agent 执行器依赖。 */
export interface AgentExecutorDeps {
  /** 创建一次性 agent 会话（宿主 ctx.agents.create 的包装）。 */
  createAgent(options: {
    sessionId: string
    cwd?: string
    setup?: (agent: unknown) => void
  }): Promise<{ agent: AgentLike; dispose(): Promise<void> }>
  /** skill 加载（可选）。 */
  skills?: {
    get(name: string): Promise<{ content: string; name: string; description: string } | undefined>
    list(): Promise<{ name: string; description: string }[]>
  }
  /** 打包 skill 目录（用于把插件自带 skill 注入执行）。 */
  bundledSkillDir?: string
}

/** Agent 最小面（运行时结构镜像）。 */
export interface AgentLike {
  id: string
  followup(message: { role: 'user'; content: { type: 'text'; text: string }[]; source: { kind: string } }): void
  whenIdle(): Promise<void>
  cancel(cause: string): void
  session: {
    /** 读取会话最终消息（结构防御读取）。 */
    query?(...args: unknown[]): unknown
  }
}

/** 基于 dsh-agent 的 Skill / Agent Prompt 执行器。 */
export class AgentActionExecutor implements ActionExecutor {
  constructor(private readonly deps: AgentExecutorDeps) {}

  async execute(
    task: { context?: { cwd?: string } },
    action: SkillActionSpec | AgentPromptActionSpec,
    options: { signal: AbortSignal; log: ActionLogFn },
  ): Promise<ActionExecutionResult> {
    const { signal, log } = options
    const cwd = task.context?.cwd ?? process.cwd()
    const sessionId = `automation_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`

    // 组装 Prompt：skill 类型 = skill 内容 + 附加指令；agent_prompt = prompt。
    let prompt: string
    if (action.type === 'skill') {
      const skillContent = await this.loadSkill(action.skill)
      if (skillContent === undefined) {
        const available = await this.listSkills()
        const hint = available.length > 0 ? `当前可用：${available.join('、')}。` : '当前没有可用技能。'
        return {
          output: '',
          error: `技能不存在：${action.skill}。${hint}`,
          exit_code: 1,
        }
      }
      prompt = [
        `请严格按以下 Skill 的指令执行：`,
        ``,
        `<skill_content>${skillContent}</skill_content>`,
        ``,
        action.prompt !== undefined && action.prompt !== ''
          ? `任务要求：\n${action.prompt}`
          : '请按 Skill 说明完成任务，完成后用一两句话汇报结果。',
      ].join('\n')
    } else {
      prompt = action.prompt
    }

    log(`[agent] 创建一次性会话 ${sessionId}（cwd=${cwd}）。`)

    let handle: { agent: AgentLike; dispose(): Promise<void> } | undefined
    let finished = false
    const finish = (): void => {
      finished = true
    }
    const abort = (): void => {
      handle?.agent.cancel('aborted')
    }
    signal.addEventListener('abort', abort, { once: true })

    try {
      handle = await this.deps.createAgent({ sessionId, cwd })
      log(`[agent] 会话已就绪，发送 Prompt。`)
      handle.agent.followup({
        role: 'user',
        content: [{ type: 'text', text: prompt }],
        source: { kind: 'automation' },
      })
      await handle.agent.whenIdle()
      if (signal.aborted) {
        return { output: '', error: '执行被取消。', exit_code: 1 }
      }
      finish()
      const output = await this.readOutput(handle.agent)
      log(`[agent] 会话结束，输出 ${output.length} 字符。`)
      return { output }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      log(`[agent] 执行异常：${message}`)
      return { output: '', error: message, exit_code: 1 }
    } finally {
      signal.removeEventListener('abort', abort)
      void finished
      if (handle !== undefined) {
        try {
          await handle.dispose()
        } catch {
          // 忽略清理异常。
        }
      }
    }
  }

  /** 加载 skill 内容（优先宿主注册表，回退打包目录）。 */
  private async loadSkill(name: string): Promise<string | undefined> {
    if (this.deps.skills?.get !== undefined) {
      try {
        const skill = await this.deps.skills.get(name)
        if (skill !== undefined && skill.content !== '') return skill.content
      } catch {
        // 回退打包目录。
      }
    }
    if (this.deps.bundledSkillDir !== undefined) {
      try {
        const raw = await readFile(join(this.deps.bundledSkillDir, 'SKILL.md'), 'utf8')
        // 剥离 frontmatter。
        const content = raw.replace(/^---[\s\S]*?---\r?\n/, '')
        return content.trim()
      } catch {
        return undefined
      }
    }
    return undefined
  }

  /** 列出可用 skill 名（错误提示用）。 */
  private async listSkills(): Promise<string[]> {
    if (this.deps.skills?.list !== undefined) {
      try {
        const skills = await this.deps.skills.list()
        return skills.map(s => s.name)
      } catch {
        return []
      }
    }
    return []
  }

  /** 读取会话最终输出（结构防御）。 */
  private async readOutput(agent: AgentLike): Promise<string> {
    // 会话最终 assistant 文本：尝试 session.query / 事件投影。
    // 第一版：尽力而为——从会话可读面提取，失败则返回占位说明。
    try {
      const session = agent.session as unknown as {
        query?: (kind: string) => unknown
      }
      const result = session.query?.('assistant')
      if (typeof result === 'string' && result !== '') return result
      if (result !== undefined) return JSON.stringify(result)
    } catch {
      // 忽略读取失败。
    }
    return '（本次执行完成；详细输出见会话记录。）'
  }
}

/** 从宿主 skills 服务构建 skill 加载器。 */
export function makeSkillLoader(skills: AutomationSkills | undefined): { get: (name: string) => Promise<{ content: string; name: string; description: string } | undefined>; list: () => Promise<{ name: string; description: string }[]> } | undefined {
  if (skills === undefined) return undefined
  const registry = skills as unknown as {
    get?: (name: string) => Promise<{ content: string; name: string; description: string } | undefined>
    list?: () => Promise<{ name: string; description: string }[]>
  }
  if (registry.get === undefined && registry.list === undefined) return undefined
  return {
    get: async (name) => {
      if (registry.get === undefined) return undefined
      try {
        return await registry.get(name)
      } catch {
        return undefined
      }
    },
    list: async () => {
      if (registry.list === undefined) return []
      try {
        return await registry.list()
      } catch {
        return []
      }
    },
  }
}
