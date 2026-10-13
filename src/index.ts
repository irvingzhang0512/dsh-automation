import { ChildProcessExecutor } from './actions/process.ts'
import { AutomationService } from './core/service.ts'
import { SqliteAutomationStore, resolveAutomationDataDir } from './storage/sqlite.ts'
import { AutomationConfigSchema, normalizeConfig, type AutomationConfig } from './host/config.ts'
import { loadBundledSkill } from './host/skill-registration.ts'
import { registerAutomationTools } from './tools/automation-tools.ts'
import { mountAutomationRoutes, type ApiRoute } from './server/api.ts'
import { createSettingsBridge, unpack, type ConfigEditor } from './host/settings.ts'
import { createMigrationBridge } from './host/migration.ts'
import { compatibilityFacts } from './host/compatibility.ts'
export const name = 'dsh-automation'
export const inject = ['tools', 'webServer', 'configEditor', 'pluginPackages', 'schedule', 'sessionController', 'connection']
export const Config = AutomationConfigSchema
export function apply(ctx: any, baseConfig: Partial<AutomationConfig> = {}): void {
  const config = normalizeConfig(unpack(baseConfig))
  const editor = ctx.get('configEditor') as ConfigEditor
  const facts = () => compatibilityFacts(ctx, editor)
  const store = new SqliteAutomationStore({ homeDir: resolveAutomationDataDir(process.env, undefined, config.dataDir), keepBackups: config.keepBackups })
  const executor = new ChildProcessExecutor()
  const service = new AutomationService(store, {
    resolveExecutor: action => action.type === 'command' || action.type === 'script' ? executor : undefined,
    canExecute: () => facts().matched,
    runtimeFacts: facts,
  }, { defaultTimeoutSeconds: config.defaultTimeoutSeconds, tickMs: config.tickMs, logger: line => ctx.logger?.info?.(line) })
  const settings = createSettingsBridge(editor, () => service.busy)
  const migration = createMigrationBridge(store, service, editor, ctx.get('schedule'), ctx.get('sessionController'))
  const extensions: ApiRoute[] = [
    { path: '/api/automation/settings', method: 'GET', handler: (_req,res) => reply(res, { owners: settings.describe(), compatibility: facts() }) },
    { path: '/api/automation/settings', method: 'POST', handler: async (_req,res,_params,body: any) => {
      const own = body?.owner === 'automation' || body?.owner === 'schedule'
      if (own && service.busy) throw Object.assign(Error('请等待或取消运行后保存。'), { code: 'TASK_BUSY', status: 409 })
      if (own) await service.quiesce()
      try { reply(res, { owners: await settings.save(body) }) } finally { if (own) service.resume() }
    } },
    { path: '/api/automation/migration', method: 'GET', handler: async (_req,res) => reply(res, await migration.preview()) },
    { path: '/api/automation/migration', method: 'POST', handler: async (_req,res,_params,body) => {
      if (!facts().matched) throw Object.assign(Error('官方组合不匹配，不能迁移。'), { code: 'COMPATIBILITY', status: 409 })
      reply(res, await migration.mutate(body))
    } },
  ]
  const facade = { webServer: ctx.get('webServer'), webRuntime: { trustedHosts: ctx.get('connection')?.config?.trustedHosts ?? [] } }
  ctx.effect(() => mountAutomationRoutes(facade, service, extensions), 'automation: api')
  ctx.effect(() => registerAutomationTools(ctx, { service }), 'automation: tools')
  ctx.inject(['skills'], (sctx: any) => sctx.effect(() => {
    let disposed = false, remove: (() => void) | undefined
    void loadBundledSkill().then(skill => { if (!disposed && skill) remove = sctx.skills.register(skill) })
    return () => { disposed = true; remove?.() }
  }, 'automation: skill'))
  if (facts().matched) service.start()
  ctx.effect(() => async () => { await service.dispose(); store.close() }, 'automation: shutdown')
}
function reply(res: any, value: unknown): void {
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify({ ok: true, code: 'OK', message: '操作完成', ...(value as object) }))
}
