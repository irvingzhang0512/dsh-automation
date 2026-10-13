import { isTrustedApiRequest } from "../shared/request-trust.js";
/** JSON 响应。 */
function json(res, status, value) {
    const payload = JSON.stringify(value);
    res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
    });
    res.end(payload);
}
/** 读取并解析请求体（JSON；限 1MB）。 */
function readBody(req) {
    return new Promise((resolvePromise, reject) => {
        const chunks = [];
        let size = 0;
        req.on('data', (chunk) => {
            size += chunk.length;
            if (size > 1024 * 1024) {
                reject(new Error('请求体超过 1MB。'));
                req.destroy();
                return;
            }
            chunks.push(chunk);
        });
        req.on('end', () => {
            if (chunks.length === 0) {
                resolvePromise(undefined);
                return;
            }
            try {
                resolvePromise(JSON.parse(Buffer.concat(chunks).toString('utf8')));
            }
            catch {
                reject(new Error('请求体不是合法 JSON。'));
            }
        });
        req.on('error', reject);
    });
}
/** 路径参数匹配（/tasks/:id → { id: "xxx" }）。 */
function matchPath(pattern, pathname) {
    const pParts = pattern.split('/').filter(part => part !== '');
    const rParts = pathname.split('/').filter(part => part !== '');
    if (pParts.length !== rParts.length)
        return null;
    const params = {};
    for (let i = 0; i < pParts.length; i += 1) {
        const p = pParts[i];
        const r = rParts[i];
        if (p.startsWith(':')) {
            params[p.slice(1)] = decodeURIComponent(r);
        }
        else if (p !== r) {
            return null;
        }
    }
    return params;
}
/** 结果信封转 HTTP 响应（ok → 200，否则按 code 映射 4xx/5xx）。 */
function respondResult(res, result) {
    if (result.ok) {
        json(res, 200, result);
        return;
    }
    const notFound = ['TASK_NOT_FOUND', 'TRIGGER_NOT_FOUND', 'RUN_NOT_FOUND'];
    const status = notFound.includes(result.code) ? 404 : result.code.startsWith('INVALID') ? 400 : result.code === 'NOT_CANCELLABLE' ? 409 : 400;
    json(res, status, result);
}
/** 构造全部路由。 */
export function automationRoutes(service) {
    const routes = [];
    /* --- 任务 --- */
    routes.push({
        method: 'GET',
        path: '/api/automation/tasks',
        handler: (_req, res) => {
            const tasks = service.allTasks();
            json(res, 200, { ok: true, code: 'OK', message: `共 ${tasks.length} 个任务。`, tasks });
        },
    });
    routes.push({
        method: 'POST',
        path: '/api/automation/tasks',
        handler: async (_req, res, _params, body) => {
            const input = body;
            if (typeof input?.name !== 'string' || input.name === '') {
                json(res, 400, { ok: false, code: 'INVALID_INPUT', message: '缺少任务名称（name）。' });
                return;
            }
            if (input.action === undefined || typeof input.action !== 'object') {
                json(res, 400, { ok: false, code: 'INVALID_INPUT', message: '缺少执行动作（action）。' });
                return;
            }
            const result = service.createTask({
                name: input.name,
                description: input.description,
                enabled: input.enabled ?? true,
                action: input.action,
                context: input.context,
                concurrency: input.concurrency,
                retry: input.retry,
                timeout_seconds: input.timeout_seconds,
                created_by: 'web',
            }, input.triggers ?? []);
            respondResult(res, result);
        },
    });
    routes.push({
        method: 'GET',
        path: '/api/automation/tasks/:id',
        handler: (_req, res, params) => {
            respondResult(res, service.getTaskDetail(params.id));
        },
    });
    routes.push({
        method: 'PATCH',
        path: '/api/automation/tasks/:id',
        handler: async (_req, res, params, body) => {
            const patch = body;
            if (patch === undefined || typeof patch !== 'object' || Array.isArray(patch)) {
                json(res, 400, { ok: false, code: 'INVALID_INPUT', message: '请求体需为对象。' });
                return;
            }
            const allowed = ['name', 'description', 'enabled', 'action', 'context', 'concurrency', 'retry', 'timeout_seconds'];
            const clean = {};
            for (const key of allowed) {
                if (key in patch)
                    clean[key] = patch[key];
            }
            respondResult(res, service.updateTask(params.id, clean));
        },
    });
    routes.push({
        method: 'DELETE',
        path: '/api/automation/tasks/:id',
        handler: (_req, res, params) => {
            respondResult(res, service.deleteTask(params.id));
        },
    });
    routes.push({
        method: 'POST',
        path: '/api/automation/tasks/:id/run',
        handler: (_req, res, params) => {
            respondResult(res, service.runNow(params.id));
        },
    });
    /* --- Trigger --- */
    routes.push({
        method: 'GET',
        path: '/api/automation/triggers',
        handler: (_req, res) => {
            const triggers = service.allTriggers();
            json(res, 200, { ok: true, code: 'OK', message: `共 ${triggers.length} 个执行时间。`, triggers });
        },
    });
    routes.push({
        method: 'POST',
        path: '/api/automation/tasks/:id/triggers',
        handler: async (_req, res, params, body) => {
            const input = body;
            if (input?.config === undefined || typeof input.config !== 'object') {
                json(res, 400, { ok: false, code: 'INVALID_INPUT', message: '缺少触发配置（config）。' });
                return;
            }
            respondResult(res, service.addTrigger(params.id, { config: input.config, enabled: input.enabled ?? true }));
        },
    });
    routes.push({
        method: 'PATCH',
        path: '/api/automation/triggers/:id',
        handler: async (_req, res, params, body) => {
            const patch = body;
            if (patch === undefined || typeof patch !== 'object' || Array.isArray(patch)) {
                json(res, 400, { ok: false, code: 'INVALID_INPUT', message: '请求体需为对象。' });
                return;
            }
            respondResult(res, service.updateTrigger(params.id, patch));
        },
    });
    routes.push({
        method: 'DELETE',
        path: '/api/automation/triggers/:id',
        handler: (_req, res, params) => {
            respondResult(res, service.deleteTrigger(params.id));
        },
    });
    /* --- 视图 --- */
    routes.push({
        method: 'GET',
        path: '/api/automation/upcoming',
        handler: (_req, res) => {
            const upcoming = service.listUpcoming();
            json(res, 200, { ok: true, code: 'OK', message: `共 ${upcoming.length} 条待运行。`, upcoming });
        },
    });
    routes.push({
        method: 'GET',
        path: '/api/automation/running',
        handler: (_req, res) => {
            const running = service.listRunning();
            json(res, 200, { ok: true, code: 'OK', message: `共 ${running.length} 个运行中任务。`, running });
        },
    });
    routes.push({
        method: 'GET',
        path: '/api/automation/history',
        handler: (req, res) => {
            const url = new URL(req.url ?? '', 'http://localhost');
            const taskId = url.searchParams.get('taskId') ?? undefined;
            const status = url.searchParams.get('status') ?? undefined;
            const limitRaw = url.searchParams.get('limit');
            const limit = limitRaw !== null && /^\d+$/.test(limitRaw) ? Number(limitRaw) : 100;
            const runs = service.listHistory({ taskId, status: status, limit });
            json(res, 200, { ok: true, code: 'OK', message: `共 ${runs.length} 条历史。`, runs });
        },
    });
    /* --- Run --- */
    routes.push({
        method: 'GET',
        path: '/api/automation/runs',
        handler: (req, res) => {
            const url = new URL(req.url ?? '', 'http://localhost');
            const taskId = url.searchParams.get('taskId') ?? undefined;
            const status = url.searchParams.get('status') ?? undefined;
            const runs = service.listHistory({ taskId, status: status, limit: 100 });
            json(res, 200, { ok: true, code: 'OK', message: `共 ${runs.length} 条运行记录。`, runs });
        },
    });
    routes.push({
        method: 'GET',
        path: '/api/automation/runs/:id',
        handler: (_req, res, params) => {
            const run = service.getRun(params.id);
            if (run === undefined) {
                json(res, 404, { ok: false, code: 'RUN_NOT_FOUND', message: `运行不存在：${params.id}` });
                return;
            }
            const logs = service.readRunLog(params.id);
            json(res, 200, { ok: true, code: 'OK', message: `运行 ${run.id}（${run.status}）。`, run, logs });
        },
    });
    routes.push({
        method: 'POST',
        path: '/api/automation/runs/:id/cancel',
        handler: (_req, res, params) => {
            respondResult(res, service.cancelRun(params.id));
        },
    });
    /* --- 状态 --- */
    routes.push({
        method: 'GET',
        path: '/api/automation/status',
        handler: (_req, res) => {
            json(res, 200, { ok: true, code: 'OK', message: 'ok', status: service.status() });
        },
    });
    return routes;
}
/** 挂载全部路由到 webServer，返回 disposer。 */
export function mountAutomationRoutes(ctx, service, extensions = []) {
    const disposers = [];
    // 信任围栏：与 /api 网关一致（Host 回环/可信权威 + 同源标记），见 shared/request-trust.ts。
    const fence = (req) => isTrustedApiRequest(req, ctx.webRuntime.trustedHosts);
    // 宿主 webServer 的 exact 路由按原始 path 字符串匹配（不展开 :param 模式段），
    // 把 /tasks/:id 等参数化路径注册为 exact 永远无法命中，请求会落到宿主的 /api
    // RPC 通道并返回非 JSON 404。因此这里注册单一 prefix 路由（最长 prefix 优先，
    // /api/automation 会正确压过宿主的 /api 通道），在 handler 内自行做模式匹配与
    // method 分发；未声明的方法返回 405 + Allow 头（与 dshmarket 一致）。
    const byPath = new Map();
    for (const route of [...automationRoutes(service), ...extensions]) {
        let byMethod = byPath.get(route.path);
        if (byMethod === undefined) {
            byMethod = new Map();
            byPath.set(route.path, byMethod);
        }
        byMethod.set(route.method, route);
    }
    disposers.push(ctx.webServer.register({
        kind: 'prefix',
        path: '/api/automation',
        handler: async (req, res) => {
            if (!fence(req)) {
                json(res, 403, { ok: false, code: 'FORBIDDEN', message: '来源不被信任。' });
                return;
            }
            const url = new URL(req.url ?? '', 'http://localhost');
            for (const [path, byMethod] of byPath) {
                const params = matchPath(path, url.pathname);
                if (params === null)
                    continue;
                const route = byMethod.get(req.method ?? '');
                if (route === undefined) {
                    const allowed = [...byMethod.keys()].join(', ');
                    res.writeHead(405, { Allow: allowed, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
                    res.end(JSON.stringify({ ok: false, code: 'METHOD_NOT_ALLOWED', message: `不支持的方法 ${req.method}，允许：${allowed}` }));
                    return;
                }
                try {
                    const body = ['POST', 'PATCH', 'PUT'].includes(route.method) ? await readBody(req) : undefined;
                    await route.handler(req, res, params, body);
                }
                catch (err) {
                    const problem = err;
                    json(res, problem.status ?? 400, { ok: false, code: problem.code ?? 'BAD_REQUEST', message: err instanceof Error ? err.message : String(err) });
                }
                return;
            }
            json(res, 404, { ok: false, code: 'NOT_FOUND', message: '路径不匹配。' });
        },
    }));
    return () => {
        for (const dispose of disposers) {
            try {
                dispose();
            }
            catch {
                // 忽略退订异常。
            }
        }
    };
}
