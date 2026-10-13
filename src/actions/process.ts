/**
 * Command / Script Action 执行器：基于 child_process。
 *
 * - Command：spawn 命令（可 shell）；
 * - Script：按扩展名推断解释器（.py → python / .sh → bash）或显式 interpreter，
 *   在任务 cwd 下执行本地脚本。
 *
 * 安全：Command 默认不通过 shell 执行（避免注入）；只有显式 shell:true 时用 shell。
 * Script 只允许批准规格中的五种扩展名；解释器覆盖不绕过此限制。
 */
import { spawn } from 'node:child_process'
import { resolve, join, delimiter } from 'node:path'
import { existsSync } from 'node:fs'
import type { CommandActionSpec, ScriptActionSpec } from '../shared/types.ts'
import type { ActionExecutor, ActionLogFn, ActionExecutionResult } from '../core/worker.ts'

/** 脚本扩展名 → 解释器。 */
const INTERPRETERS: Record<string, string> = {
  '.py': process.platform === 'win32' ? 'python' : 'python3',
  '.sh': process.platform === 'win32' ? 'bash' : 'bash',
  '.ps1': 'pwsh',
  '.js': 'node',
  '.mjs': 'node',
}

/** 累计输出到变量（避免无限增长）。 */
const MAX_OUTPUT_CHARS = 200_000
function defaultInterpreter(ext: string): string | undefined {
  if (process.platform === 'win32' && ext === '.sh') {
    for (const directory of (process.env.PATH ?? '').split(delimiter)) {
      if (existsSync(join(directory, 'git.exe'))) {
        const bash = resolve(directory, '../bin/bash.exe')
        if (existsSync(bash)) return bash
      }
    }
  }
  return INTERPRETERS[ext]
}

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
        args = [...(action.args ?? [])]
        shell = true
      } else {
        // 无 shell：按空白分词，支持简单引号。
        const parsed = tokenizeCommand(action.command)
        command = parsed[0] ?? ''
        args = [...parsed.slice(1), ...(action.args ?? [])]
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
      if (!(ext in INTERPRETERS)) return { output: '', error: `不支持的脚本扩展名 ${ext}（支持 .py/.sh/.ps1/.js/.mjs）。`, exit_code: 1 }
      const interpreter = action.interpreter || defaultInterpreter(ext)
      if (interpreter === undefined) {
        return { output: '', error: `不支持的脚本扩展名 "${ext}"（支持 .py/.sh/.ps1/.js/.mjs）。`, exit_code: 1 }
      }
      if (process.platform === 'win32' && ext === '.sh') {
        // Windows 无原生 bash 时尝试 git-bash。
      }
      command = interpreter
      args = [...(ext === '.ps1' ? ['-NoProfile', '-NonInteractive', '-File'] : []), scriptPath, ...(action.args ?? [])]
    }

    log(`[spawn] ${shell ? command : `${command} ${args.join(' ')}`}（cwd=${cwd}）`)

    return await new Promise<ActionExecutionResult>((resolvePromise) => {
      const child = spawn(command, args, {
        cwd,
        env,
        shell,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: process.platform !== 'win32',
      })
      const stdout = makeCollector()
      const stderr = makeCollector()
      let settled = false
      let abortReason: string | undefined

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
            ...(errorText !== '' ? { error: errorText } : { error: action.type === 'script' && exitCode === 9009 ? `解释器 ${command} 不可用，请指定已安装的解释器。` : `进程退出码 ${exitCode}` }),
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
        settle(code, abortReason)
      })

      const abort = (): void => {
        if (settled) return
        abortReason = '执行被取消（超时或用户取消）。'
        try {
          if (process.platform === 'win32' && child.pid) {
            const killer = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' })
            killer.on('error', () => child.kill())
            killer.on('close', code => { if (code !== 0 && !settled) child.kill() })
          } else if (child.pid) process.kill(-child.pid, 'SIGKILL')
          else child.kill('SIGKILL')
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
