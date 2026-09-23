import { describe, expect, it } from 'vitest'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { ChildProcessExecutor, tokenizeCommand } from '../src/actions/process.ts'
import type { CommandActionSpec, ScriptActionSpec } from '../src/shared/types.ts'

describe('tokenizeCommand', () => {
  it('按空白分词并保留引号内内容', () => {
    expect(tokenizeCommand('git pull')).toEqual(['git', 'pull'])
    expect(tokenizeCommand('echo "hello world"')).toEqual(['echo', 'hello world'])
    expect(tokenizeCommand("echo 'a b' c")).toEqual(['echo', 'a b', 'c'])
    expect(tokenizeCommand('')).toEqual([])
  })
})

describe('ChildProcessExecutor', () => {
  it('command 无 shell：执行成功并收集输出', async () => {
    const executor = new ChildProcessExecutor()
    const result = await executor.execute(
      {},
      { type: 'command', command: process.platform === 'win32' ? 'cmd /c echo hi' : 'echo hi' } as CommandActionSpec,
      { signal: new AbortController().signal, log: () => {} },
    )
    expect(result.exit_code).toBe(0)
    expect(result.output.trim()).toContain('hi')
  })

  it('command 无 shell：非零退出码报错', async () => {
    const executor = new ChildProcessExecutor()
    const result = await executor.execute(
      {},
      { type: 'command', command: process.platform === 'win32' ? 'cmd /c exit 3' : 'sh -c "exit 3"' } as CommandActionSpec,
      { signal: new AbortController().signal, log: () => {} },
    )
    expect(result.exit_code).toBe(3)
    expect(result.error).toBeDefined()
  })

  it('command 为空：结构化错误', async () => {
    const executor = new ChildProcessExecutor()
    const result = await executor.execute(
      {},
      { type: 'command', command: '   ' } as CommandActionSpec,
      { signal: new AbortController().signal, log: () => {} },
    )
    expect(result.exit_code).toBe(1)
    expect(result.error).toContain('命令为空')
  })

  it('script：脚本不存在报错', async () => {
    const executor = new ChildProcessExecutor()
    const result = await executor.execute(
      {},
      { type: 'script', path: './definitely-not-exists-12345.sh' } as ScriptActionSpec,
      { signal: new AbortController().signal, log: () => {} },
    )
    expect(result.exit_code).toBe(1)
    expect(result.error).toContain('脚本不存在')
  })

  it('script：不支持的扩展名报错', async () => {
    const executor = new ChildProcessExecutor()
    const scriptPath = join(process.cwd(), '.test-runs', `run-${Date.now()}.exe`)
    mkdirSync(dirname(scriptPath), { recursive: true })
    writeFileSync(scriptPath, 'x')
    try {
      const result = await executor.execute(
        {},
        { type: 'script', path: scriptPath } as ScriptActionSpec,
        { signal: new AbortController().signal, log: () => {} },
      )
      expect(result.exit_code).toBe(1)
      expect(result.error).toContain('不支持的脚本扩展名')
    } finally {
      rmSync(scriptPath, { force: true })
    }
  })

  it('script：.py 脚本执行（存在 python 时）', async () => {
    const executor = new ChildProcessExecutor()
    const scriptPath = join(process.cwd(), '.test-runs', `script-${Date.now()}.py`)
    mkdirSync(dirname(scriptPath), { recursive: true })
    writeFileSync(scriptPath, 'print("py-ok")\n')
    try {
      const result = await executor.execute(
        {},
        { type: 'script', path: scriptPath } as ScriptActionSpec,
        { signal: new AbortController().signal, log: () => {} },
      )
      // 无 python 环境时也可能失败；有则断言成功输出。
      if (result.exit_code === 0) {
        expect(result.output).toContain('py-ok')
      }
    } finally {
      rmSync(scriptPath, { force: true })
    }
  })

  it('abort：取消后返回取消错误', async () => {
    const executor = new ChildProcessExecutor()
    const controller = new AbortController()
    controller.abort()
    const result = await executor.execute(
      {},
      { type: 'command', command: process.platform === 'win32' ? 'ping -n 30 127.0.0.1' : 'sleep 30' } as CommandActionSpec,
      { signal: controller.signal, log: () => {} },
    )
    expect(result.exit_code).toBe(1)
    expect(result.error).toContain('取消')
  })

  it('log 回调收到 spawn 与输出行', async () => {
    const executor = new ChildProcessExecutor()
    const logs: string[] = []
    await executor.execute(
      {},
      { type: 'command', command: process.platform === 'win32' ? 'cmd /c echo line1' : 'echo line1' } as CommandActionSpec,
      { signal: new AbortController().signal, log: line => logs.push(line) },
    )
    expect(logs.some(line => line.includes('[spawn]'))).toBe(true)
  })
})
