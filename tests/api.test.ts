/**
 * /api/automation 挂载层回归测试。
 *
 * 宿主 webServer 的 exact 路由按原始 path 字符串匹配（不展开 :param 模式段），
 * 参数化路径必须注册为单一 prefix 路由、在 handler 内自行分发——否则浏览器端
 * 全部行级操作（详情 / 编辑 / 删除 / 运行）都会 404。本文件锁定该行为。
 */
import { describe, expect, it } from 'vitest'
import { EventEmitter } from 'node:events'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { createMemoryStore } from '../src/storage/sqlite.ts'
import { AutomationService } from '../src/core/service.ts'
import { mountAutomationRoutes } from '../src/server/api.ts'
import type { CreateTaskInput } from '../src/shared/types.ts'

/* ---------------- 测试夹具 ---------------- */

interface RegisteredRoute {
  kind: string
  path: string
  handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>
}

function createService() {
  const memory = createMemoryStore()
  const service = new AutomationService(memory.store, {
    resolveExecutor: () => ({ execute: async () => ({ output: 'ok' }) }),
  }, {
    tickMs: 50,
    logger: () => {},
  })
  return { memory, service }
}

/** 挂载到假 webServer，捕获注册的路由。 */
function mount(service: AutomationService): { routes: RegisteredRoute[]; dispose: () => void } {
  const routes: RegisteredRoute[] = []
  const dispose = mountAutomationRoutes({
    webServer: {
      register: (route: { kind: 'prefix'; path: string; handler: RegisteredRoute['handler'] }) => {
        routes.push(route as RegisteredRoute)
        return () => {}
      },
    },
    webRuntime: { trustedHosts: ['127.0.0.1:3080'] },
  }, service)
  return { routes, dispose }
}

/** 最小 IncomingMessage 假体（EventEmitter 供 readBody 使用）。 */
function fakeReq(url: string, method: string, body?: unknown, extraHeaders: Record<string, string> = {}): IncomingMessage {
  const req = new EventEmitter() as unknown as IncomingMessage & { url: string; method: string; headers: Record<string, string> }
  req.url = url
  req.method = method
  // 浏览器 / HTTP1.1 客户端总会带 Host；围栏按宿主语义要求 Host 可信。
  req.headers = { host: '127.0.0.1:3080', ...extraHeaders }
  // 真实 HTTP 请求无论有无 body 都会触发 data/end；延迟发射等 readBody 挂上监听。
  setTimeout(() => {
    if (body !== undefined) {
      ;(req as unknown as EventEmitter).emit('data', Buffer.from(JSON.stringify(body)))
    }
    ;(req as unknown as EventEmitter).emit('end')
  }, 5)
  return req
}

/** 最小 ServerResponse 假体（捕获 writeHead / end）。 */
class FakeRes {
  status = 0
  headers: Record<string, unknown> | undefined
  body = ''
  writeHead(status: number, headers?: Record<string, unknown>): void {
    this.status = status
    this.headers = headers
  }
  end(payload?: string | Buffer): void {
    this.body = payload === undefined ? '' : String(payload)
  }
  json(): Record<string, unknown> {
    return JSON.parse(this.body) as Record<string, unknown>
  }
}

async function invoke(handler: RegisteredRoute['handler'], req: IncomingMessage): Promise<FakeRes> {
  const res = new FakeRes()
  await handler(req, res as unknown as ServerResponse)
  return res
}

function taskInput(name: string): CreateTaskInput {
  return { name, enabled: true, action: { type: 'command', command: 'echo hi' }, created_by: 'test' }
}

/* ---------------- 用例 ---------------- */

describe('mountAutomationRoutes（prefix 挂载）', () => {
  it('只注册一条 prefix 路由 /api/automation', () => {
    const { memory, service } = createService()
    const { routes, dispose } = mount(service)
    try {
      expect(routes).toHaveLength(1)
      expect(routes[0]?.kind).toBe('prefix')
      expect(routes[0]?.path).toBe('/api/automation')
    } finally {
      dispose()
      service.dispose()
      ;(memory.store as { close(): void }).close()
    }
  })

  it('字面路径仍可分发：GET /tasks', async () => {
    const { memory, service } = createService()
    const { routes, dispose } = mount(service)
    try {
      service.createTask(taskInput('日报'))
      const res = await invoke(routes[0]!.handler, fakeReq('/api/automation/tasks', 'GET'))
      expect(res.status).toBe(200)
      const payload = res.json()
      expect(payload.ok).toBe(true)
      expect((payload.tasks as Array<{ name: string }>)).toHaveLength(1)
    } finally {
      dispose()
      service.dispose()
      ;(memory.store as { close(): void }).close()
    }
  })

  it('参数化路径可分发：GET /tasks/:id 命中真实任务（旧行为是宿主层 404）', async () => {
    const { memory, service } = createService()
    const { routes, dispose } = mount(service)
    try {
      const created = service.createTask(taskInput('参数化'))
      const id = (created as { task: { id: string } }).task.id
      const res = await invoke(routes[0]!.handler, fakeReq(`/api/automation/tasks/${id}`, 'GET'))
      expect(res.status).toBe(200)
      const payload = res.json()
      expect(payload.ok).toBe(true)
      expect((payload.task as { id: string }).id).toBe(id)
    } finally {
      dispose()
      service.dispose()
      ;(memory.store as { close(): void }).close()
    }
  })

  it('参数化路径业务 404 返回 JSON 信封（TASK_NOT_FOUND），而非宿主非 JSON 404', async () => {
    const { memory, service } = createService()
    const { routes, dispose } = mount(service)
    try {
      const res = await invoke(routes[0]!.handler, fakeReq('/api/automation/tasks/task_missing', 'GET'))
      expect(res.status).toBe(404)
      const payload = res.json()
      expect(payload.ok).toBe(false)
      expect(payload.code).toBe('TASK_NOT_FOUND')
    } finally {
      dispose()
      service.dispose()
      ;(memory.store as { close(): void }).close()
    }
  })

  it('POST /tasks/:id/run 可分发（手动运行入队）', async () => {
    const { memory, service } = createService()
    service.start()
    const { routes, dispose } = mount(service)
    try {
      const created = service.createTask(taskInput('手动运行'))
      const id = (created as { task: { id: string } }).task.id
      const res = await invoke(routes[0]!.handler, fakeReq(`/api/automation/tasks/${id}/run`, 'POST'))
      expect(res.status).toBe(200)
      const payload = res.json()
      expect(payload.ok).toBe(true)
      expect(typeof payload.run_id).toBe('string')
    } finally {
      dispose()
      service.dispose()
      ;(memory.store as { close(): void }).close()
    }
  })

  it('回归：浏览器同源 POST（带 Origin）不再 403 来源不被信任', async () => {
    const { memory, service } = createService()
    const { routes, dispose } = mount(service)
    try {
      const created = service.createTask(taskInput('同源POST'))
      const id = (created as { task: { id: string } }).task.id
      const res = await invoke(routes[0]!.handler, fakeReq(`/api/automation/tasks/${id}/run`, 'POST', undefined, {
        origin: 'http://127.0.0.1:3080',
        'content-type': 'application/json',
      }))
      expect(res.status).toBe(200)
      expect(res.json().ok).toBe(true)
    } finally {
      dispose()
      service.dispose()
      ;(memory.store as { close(): void }).close()
    }
  })

  it('跨站 Origin 的 POST 返回 403 来源不被信任', async () => {
    const { memory, service } = createService()
    const { routes, dispose } = mount(service)
    try {
      const res = await invoke(routes[0]!.handler, fakeReq('/api/automation/status', 'GET', undefined, {
        origin: 'http://evil.example',
      }))
      expect(res.status).toBe(403)
      expect(res.json().message).toBe('来源不被信任。')
    } finally {
      dispose()
      service.dispose()
      ;(memory.store as { close(): void }).close()
    }
  })

  it('路径命中但方法未声明返回 405 + Allow', async () => {
    const { memory, service } = createService()
    const { routes, dispose } = mount(service)
    try {
      const res = await invoke(routes[0]!.handler, fakeReq('/api/automation/status', 'PATCH'))
      expect(res.status).toBe(405)
      expect((res.headers as { Allow?: string }).Allow).toContain('GET')
    } finally {
      dispose()
      service.dispose()
      ;(memory.store as { close(): void }).close()
    }
  })

  it('prefix 下未匹配的路径返回 JSON 404', async () => {
    const { memory, service } = createService()
    const { routes, dispose } = mount(service)
    try {
      const res = await invoke(routes[0]!.handler, fakeReq('/api/automation/nope', 'GET'))
      expect(res.status).toBe(404)
      expect(res.json().code).toBe('NOT_FOUND')
    } finally {
      dispose()
      service.dispose()
      ;(memory.store as { close(): void }).close()
    }
  })
})
