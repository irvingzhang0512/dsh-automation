/**
 * Command / Script Action 执行器：基于 child_process。
 *
 * - Command：spawn 命令（可 shell）；
 * - Script：按扩展名推断解释器（.py → python / .sh → bash）或显式 interpreter，
 *   在任务 cwd 下执行本地脚本。
 *
 * 安全：Command 默认不通过 shell 执行（避免注入）；只有显式 shell:true 时用 shell。
 * Script 只允许 .py / .sh（需求 §11.4），其余拒绝。
 */
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import { existsSync } from 'node:fs'
import type { CommandActionSpec, ScriptActionSpec } from '../shared/types.ts'
import type { ActionExecutor, ActionLogFn, ActionExecutionResult } from '../core/worker.ts'

/** 脚本扩展名 → 解释器。 */
const INTERPRETERS: Record<string, string> = {
  '.py': process.platform === 'win32' ? 'python' : 'python3',
  '.sh': process.platform === 'win32' ? 'bash' : 'bash',
}

/** 累计输出到变量（避免无限增长）。 */
const MAX_OUTPUT_CHARS = 200_000

interface CollectedStream {
  text: string
  append(chunk: string): void
  exceeds(): boolean
}

function makeCollector(): CollectedStream {
  let text = ''
  return {
    get text() {
      return text
    },
    append(chunk: string) {
      if (text.length < MAX_OUTPUT_CHARS) {
        text = `${text}${chunk}`.slice(0, MAX_OUTPUT_CHARS)
      }
    },
    exceeds() {
      return text.length >= MAX_OUTPUT_CHARS
    },
  }
}

/** 生成一个执行器实例（无状态，可复用）。 */
export class ChildProcessExecutor implements ActionExecutor {
  async execute(
    _task: { context?: { cwd?: string; env?: Record<string, string> } },
    action: CommandActionSpec | ScriptActionSpec,
    options: { signal: AbortSignal; log: ActionLogFn },
  ): Promise<ActionExecutionResult> {
    const { signal, log } = options
    const cwd = _task.context?.cwd ?? process.cwd()
    const env = { ...process.env, ...(_task.context?.env ?? {}) }

    let command: string
    let args: string[]
    let shell = false

    if (action.type === 'command') {
      if (action.shell === true) {
        command = action.command
        args = []
        shell = true
      } else {
        // 无 shell：按空白分词，支持简单引号。
        const parsed = tokenizeCommand(action.command)
        command = parsed[0] ?? ''
        args = parsed.slice(1)
        if (command === '') {
          return { output: '', error: '命令为空。', exit_code: 1 }
        }
      }
    } else {
      const scriptPath = resolve(cwd, action.path)
      if (!existsSync(scriptPath)) {
        return { output: '', error: `脚本不存在：${scriptPath}`, exit_code: 1 }
      }
      const ext = scriptPath.slice(scriptPath.lastIndexOf('.')).toLowerCase()
      const interpreter = action.interpreter ?? INTERPRETERS[ext]
      if (interpreter === undefined) {
        return { output: '', error: `不支持的脚本扩展名 "${ext}"（支持 .py / .sh）。`, exit_code: 1 }
      }
      if (process.platform === 'win32' && ext === '.sh') {
        // Windows 无原生 bash 时尝试 git-bash。
      }
      command = interpreter
      args = [scriptPath, ...(action.args ?? [])]
    }

    log(`[spawn] ${shell ? command : `${command} ${args.join(' ')}`}（cwd=${cwd}）`)

    return await new Promise<ActionExecutionResult>((resolvePromise) => {
      const child = spawn(command, args, {
        cwd,
        env,
        shell,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      const stdout = makeCollector()
      const stderr = makeCollector()
      let settled = false

      const settle = (exitCode: number | null, reason?: string): void => {
        if (settled) return
        settled = true
        if (stdout.exceeds()) log('[warn] stdout 超过 200KB，已截断。')
        if (stderr.exceeds()) log('[warn] stderr 超过 200KB，已截断。')
        const output = stdout.text
        const errorText = stderr.text.trim()
        if (errorText !== '') {
          log(`[stderr] ${errorText}`)
        }
        if (reason !== undefined) {
          resolvePromise({ output, error: reason, exit_code: exitCode ?? 1 })
          return
        }
        if (exitCode === 0) {
          resolvePromise({ output, exit_code: 0 })
        } else {
          resolvePromise({
            output,
            ...(errorText !== '' ? { error: errorText } : { error: `进程退出码 ${exitCode}` }),
            exit_code: exitCode ?? 1,
          })
        }
      }

      child.stdout.on('data', (chunk: Buffer) => {
        stdout.append(chunk.toString())
        log(chunk.toString().replace(/\n$/, ''))
      })
      child.stderr.on('data', (chunk: Buffer) => {
        stderr.append(chunk.toString())
      })
      child.on('error', (err) => {
        settle(null, `无法启动进程：${err.message}`)
      })
      child.on('close', (code) => {
        settle(code)
      })

      const abort = (): void => {
        if (settled) return
        settle(1, '执行被取消（超时或用户取消）。')
        try {
          child.kill('SIGKILL')
        } catch {
          // Windows 下 kill 失败忽略。
        }
      }
      if (signal.aborted) {
        abort()
      } else {
        signal.addEventListener('abort', abort, { once: true })
      }
      // 确保监听器不泄漏。
      const cleanup = (): void => {
        signal.removeEventListener('abort', abort)
      }
      child.on('close', cleanup)
      child.on('error', cleanup)
    })
  }
}

/** 简单命令行分词（支持单双引号）。 */
export function tokenizeCommand(input: string): string[] {
  const tokens: string[] = []
  const regex = /"([^"]*)"|'([^']*)'|(\S+)/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(input)) !== null) {
    if (match[1] !== undefined) tokens.push(match[1])
    else if (match[2] !== undefined) tokens.push(match[2])
    else if (match[3] !== undefined) tokens.push(match[3])
  }
  return tokens
}
