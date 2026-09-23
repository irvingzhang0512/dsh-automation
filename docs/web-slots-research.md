# DSH Web 插件：顶层导航入口与独立页面注册调研报告（dsh-automation 前期调研）

> 调研对象版本：DSH `0.1.5-rc.2`（`@deepseek-ai/dsh` CLI 包）
> 宿主包位置：`C:\Users\irving\AppData\Roaming\npm\node_modules\@deepseek-ai\dsh\`（含其 `node_modules\@deepseek-ai\*` 全部相关包）
> 范式插件：`F:\irving-dsh-plugins\dsh-structured-document-view\`、`F:\irving-dsh-plugins\dsh-better-sidebar-controller\`
> 说明：npm 发布包只含编译产物（`lib/*.js` + `lib/types/*.d.ts`），**不含 `apps/web/src` 源码**；本报告基于 `.d.ts` 类型签名、编译实现与两个范式插件的真实源码还原 API，均可直接照着写插件。

---

## 0. 结论速览（TL;DR）

1. **没有 URL 路由**。DSH web shell 不使用 react-router / history，插件"页面"不是 `/automation` 这种 URL，而是 **slot 组合**：导航选择是 store 状态（`ctx.layout.selectPanel`），不是路由跳转。
2. **"新会话"按钮正下方就是全局面板列表区**（`sidebar.panellist` list slot）。dsh-automation 要做"新会话按钮下方固定入口 + 独立主页面"，**原生正解是**：
   - 在 `main` keyed slot 注册一个 key=你的面板 id 的页面组件（占用中央主列）；
   - 在 `sidebar.panellist` list slot 注册一个 `id`/`label`/`order` 相同的入口（图标 + 文字，点击 `selectPanel(id)`）。
3. 客户端注册 API 是 `ctx.slots.register(options, Component)` / `ctx.slots.inject(key, callback)`（`@deepseek-ai/dsh-client-ui-renderer` 提供 `ctx.slots`）。
4. 宿主半区 API：`ctx.webServer.register/registerUpgrade/registerFallback/tapIndex`、`ctx.webRuntime.trustedHosts`（信任围栏）、`ctx.tools.register(defineTool({...}))`、`ctx.skills.register(skill)`。
5. 打包：宿主半区 tsc 编译成 `lib/index.js`；客户端半区 tsdown 打单一 CJS bundle，**banner/footer 包 `window.__ModuleLoader__.load({ id, factory })`**，`exports` 需含 `./client`、`./cordis.patch.yml`；`cordis.patch.yml` 用 `insert` 行声明插件装载（`inject` 列表是宿主的服务依赖）。
6. `/plugins/dsh-automation` 这个路径的真实含义是**客户端 bundle 的静态资源路由**（`/plugins/<id>/client.js`），不是页面路由。

---

## 1. Web shell 布局与左侧导航（"新会话"按钮在哪、怎么注入入口）

### 1.1 shell 的组成方式

web shell 不是一个单体应用，而是 **"Vite 静态壳（`@deepseek-ai/dsh-web-frontend` 的 dist）+ 一批浏览器端 cordis 插件"** 的组合。浏览器端结构：

- `@deepseek-ai/dsh-client-ui-layout`：把 **AppFrame** 注册进内置 `root` slot，并声明 4 个子 slot：`sidebar` / `main` / `rightbar` / `shell.overlay`。
  源：`dsh/node_modules/@deepseek-ai/dsh-client-ui-layout/lib/types/client/index.d.ts`（`declare module '@deepseek-ai/dsh-client-ui-slots' { interface SlotMap { ... } }`，L24-84）
- `@deepseek-ai/dsh-client-ui-sidebar`：`SidebarRoot` 占据 `sidebar` slot，并声明 6 个内部孔（contract/slots.d.ts L14-74）：

```ts
'sidebar.brand.mark'    // kind:'single', scope:'root'  —— 品牌 logo（可替换）
'sidebar.brand.name'    // kind:'single', scope:'root'  —— 品牌名（可替换）
'sidebar.panellist'     // kind:'list',   scope:'root'  —— 全局面板图标列表（可加）
'sidebar.workspaces'    // kind:'single', scope:'root'  —— 工作区/会话浏览区（唯一占用）
'sidebar.settings'      // kind:'single', scope:'root'  —— 底部设置位（唯一占用）
'sidebar.footer.action' // kind:'list',   scope:'root'  —— 设置旁的附加动作（可加）
```
  源：`dsh/node_modules/@deepseek-ai/dsh-client-ui-sidebar/lib/types/client/contract/slots.d.ts`

### 1.2 "新会话"按钮的位置与渲染顺序

从编译产物还原的 `SidebarRoot` 渲染顺序（`dsh-client-ui-sidebar/lib/client.js` L139-304）：

```
┌ logoRow ────────────────────────────┐  ← 品牌按钮（startSession 兜底）+ 折叠开关
├ 新会话按钮 ─────────────────────────┤  ← t("session.new") = "新会话"/"New Session"
│                                      │      onClick = startSession()
├ panelList（全局面板导航）────────────┤  ← sidebar.panellist 的每条目渲染为 PanelRow
│   PanelRow = icon + label            │      （icon 来自 renderSlot('sidebar.panellist',{size,active},{only:id})）
│   点击 → selectPanel(id)             │  ← ★ 这就是"新会话按钮正下方"
├ regionArea ─────────────────────────┤  ← renderSlot("sidebar.workspaces", { wide, expandSidebar })
│   （工作区/会话列表浏览区）           │      （由 ui-workspace 的 WorkspaceBrowser 占用）
├ footArea ───────────────────────────┤
│   footerActions = renderSlot('sidebar.footer.action', { wide })
│   settingsArea  = renderSlot('sidebar.settings',       { wide })
└─────────────────────────────────────┘
```

关键编译代码（`dsh-client-ui-sidebar/lib/client.js`）：

```js
// L208 附近：新会话按钮
onClick: () => { startSession(); }   // 文案 t("session.new")

// L263 附近：面板导航行（位于新会话按钮下方）
function PanelRow({ id, label, wide, usePanelInfo, selectPanel, renderSlot }) {
  const active = usePanelInfo((info) => info.activePanelId === id)
  return <button onClick={() => selectPanel(id)} aria-current={active ? "page" : undefined}>
    {renderSlot("sidebar.panellist", { size: wide ? 16 : 18, active }, { only: id })}
    {wide && <span>{label}</span>}
  </button>
}
```

所以：**给 `sidebar.panellist` 加一条目 = 在新会话按钮正下方加一个固定入口**；入口点击后 `selectPanel(id)` 会切到 `main` 里 key 相同的面板（见第 2 节）。这正是 dsh-automation 要的交互。

### 1.3 客户端注册 API（`ctx.slots`）

`ctx.slots` 是 `SlotRegistry`（`@deepseek-ai/dsh-client-ui-renderer`），注册接口：

```ts
// dsh/node_modules/@deepseek-ai/dsh-client-ui-renderer/lib/types/client/registry.d.ts
class SlotRegistry extends Service {
  register(options: RegisterOptions, component?: ComponentType): () => void   // 返回 disposer
  inject(key: keyof SlotMap & string, callback: () => SlotInjectionEffect): () => void
  entries(key: string): readonly StoredEntry[]
  entriesOfSlot(key: string): readonly StoredEntry[]
  snapshot(): Readonly<Record<string, readonly StoredEntry[]>>
  spec(): SlotSpec
  subscribe(listener: () => void): () => void
  getVersion(): number
  install(renderer: SlotRenderer, host?: SlotRendererHost): void
  installLocale(face: LocaleFace): void
  installScope(adapter: SlotScopeAdapter): void
  provideRoot(contribution: RootStandardSourceContribution): () => void
  onEntryError(fn: (key, entry, error, info) => void): () => void
}
```

`register` 的 options 核心字段（由 `@deepseek-ai/dsh-client-ui-slots` 的 `SlotCore.register` 定义，`register` 的重载在 `dsh-client-ui-slots/lib/types/index.d.ts`）：

```ts
interface RegisterOptions<K extends keyof SlotMap & string> {
  name: K                       // slot 名
  key?: string                  // keyed slot 的 key（如 main 面板 id）
  id?: string                   // list slot 的条目 id（如 panellist 条目）
  order?: number                // list 排序（升序）
  label?: string | (() => string) // 列表条目标签
  locale?: string               // 声明命名空间后组件 props 获得 t
  children?: SlotChildrenMap    // 声明子 slot（声明 = 独占渲染权）
  store?: StoreDecl | ...       // 可选 store 座位
  inject?: ((scopeKey?) => object) | object  // 注入到组件 props 的 service 面
  hooks?: HooksSources
  keyedHooks?: KeyedHooksSources
  priority?: number
}
```

### 1.4 真实注册示例（来自 shell 自身）

**① conversation 占据 `main` keyed slot**（`dsh-client-ui-conversation/lib/client.js` L16823-16836）：

```js
slots.inject("main", function* () {
  yield slots.register({
    name: "main",
    key: "conversation",
    children: { "main.conversation": { kind: "single", scope: "session-maybe" } },
  }, ConversationPanel)
  ...
})
```

**② ui-sidebar-right 占据 `rightbar` + 声明子 slot**（`dsh-client-ui-sidebar-right/lib/client.js` L3705-3738）：

```js
const disposeSeat = ctx.slots.inject("rightbar", function* () {
  yield ctx.slots.register({
    name: "rightbar",
    children: { "rightbar.session": { kind: "single", scope: "session" } },
  }, RightbarRoot)
  yield ctx.slots.register({
    name: "rightbar.session",
    locale: NS,
    children: {
      "sidebar.right.pane.tab":      { kind: "keyed", scope: "session", inject: { hooks: { tabInfo } } },
      "sidebar.right.pane.tab.title":{ kind: "keyed", scope: "session", inject: { hooks: { tabInfo } } },
      "sidebar.right.tab.menu.item": { kind: "list",  scope: "session" },
    },
    store,
    inject: (sessionId) => ({ ...injected, keyedHooks: {...}, occurrence: ... }),
  }, RightbarSeat)
})
```

要点：`inject(key, callback)` 会在 **slot 被声明后**再执行 callback（等壳就位），callback 里可以 `yield` 多个 `register`；返回的 disposer 在 fiber 卸载时自动清场（HMR 安全）。

---

## 2. 独立页面：`main` 面板 + `sidebar.panellist` 入口（替代 URL 路由）

### 2.1 为什么没有 `/automation` URL

- 对 web bundle（`dsh-web-frontend/dist/assets/index-*.js`，约 556KB）grep 确认：**无 react-router、无 createBrowserHistory、无 location.pathname 路由逻辑**（只有 `hashchange`/`popstate` 出现在 DOM 事件白名单里）。
- 主列渲染：`AppFrame` 的 `MainPanel` 是 `renderSlot("main", {}, { entryKey: activePanelId ?? "conversation" })`（`dsh-client-ui-layout/lib/client.js` L114-116）。即主列显示哪个 key 的面板由 store 里的 `activePanelId` 决定，点击侧栏行 → `selectPanel(id)` → `ctx.layout.selectPanel(id)` 写入 store → 主列重渲染。
- 导航 API（`dsh-client-ui-layout/lib/types/client/service.d.ts` L24-48）：

```ts
export interface ILayout {
  selectPanel(panelId: MainPanelId | null): void   // null = 回到会话；未注册的 id 抛错
  beginNavigation(): AbortSignal
  toggleSidebar(): void
  openRightbar(track: boolean, fullscreen: boolean): void
  closeRightbar(): void
}
export type MainPanelId = Branded<'MainPanelId'>   // 用 brandString<MainPanelId>('automation') 铸造
```

### 2.2 dsh-automation 的"页面"注册蓝图（推荐做法）

客户端半区 `src/client/index.ts` 里（`ctx.slots`、`ctx.layout` 需在客户端 inject 里声明）：

```ts
import { brandString } from '@deepseek-ai/dsh-brand'
import type { MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client'

const AUTOMATION_PANEL = brandString<MainPanelId>('automation')
const AUTOMATION_LABEL = '自动任务'   // en: 'Automation'

export const inject = ['slots', 'layout']   // 客户端服务依赖（见 §7.1 说明）

export function apply(ctx: Context): void {
  ctx.effect(() => {
    // ① 主页面：占 main keyed slot
    const disposePage = ctx.slots.register({
      name: 'main',
      key: AUTOMATION_PANEL,
      // 可选：声明页内子 slot（如 4 个 Tab 的 body 由别人贡献时）
      // children: { 'automation.tab': { kind: 'keyed', scope: 'root' } },
    }, AutomationPage)   // 你的页面组件（4 个 Tab 就在这个组件里）
    // ② 侧栏入口：占 sidebar.panellist（新会话按钮正下方）
    const disposeEntry = ctx.slots.register({
      name: 'sidebar.panellist',
      id: AUTOMATION_PANEL,
      order: 100,                       // 升序排列；100 靠后但仍在新会话按钮之下
      label: AUTOMATION_LABEL,
      locale: 'automation',             // 可选：声明后组件 props 有 t
    }, AutomationPanelIcon)             // ({ size, active }) => ReactNode
    return () => { disposePage(); disposeEntry() }
  }, 'dsh-automation: page + nav entry')
}
```

组件签名：
- `AutomationPage` 收到的 props：`PropsRuntime<'main'>` + `GlobalStandardProps`（含 `usePanelInfo`，由 ui-layout 合并注入）等框架标准 props；`main` 无 owner props（`kind:'keyed', scope:'root'`，见 `dsh-client-ui-layout/lib/types/client/index.d.ts` L48-51）。
- `AutomationPanelIcon` 收到的 props：`SidebarPanelIconOwnerProps = { size: number; active: boolean }`（`dsh-client-ui-sidebar/lib/types/client/contract/slots.d.ts` L87-92）。

> 页面内 4 个 Tab：直接在 `AutomationPage` 组件里用 React state 切换即可，不需要任何 DSH API。若想让其它插件也能往 Tab 里塞内容，才需要声明子 slot（如上注释）。

### 2.3 `/plugins/dsh-automation` 的真实含义

- 客户端 bundle 的静态资源路由是 **`/plugins/<id>/client.js`**（combo 形式 `/plugins/??<id1>/client.js,<id2>/client.js&rev=<hash>`），由 `@deepseek-ai/dsh-client-modules` 注册到 webServer（`dsh-client-modules/lib/index.js` 的 `comboUrl`，L182 起）。
- `<id>` 必须是**完整 npm 包名**（`dsh-automation`），因为 `client-modules` 按 loader 条目名解析 bundle。
- 所以"或 /plugins/dsh-automation"应理解为 bundle 资源路径，不是页面路径。

### 2.4 备选：真的想要一个独立 URL 页面？

DSH 允许插件用 `ctx.webServer.register({ kind:'exact', path:'/automation', handler })` 返回**自建 HTML**（`node:http` 全权处理响应）。但那是独立于 shell 的裸页面（没有 shell 的侧栏/会话），且要自己做信任围栏与样式。**不建议**；面板化方案才是 DSH 原生形态。

---

## 3. 宿主侧 `ctx.webServer` / `ctx.webRuntime` / `ctx.web`

### 3.1 `ctx.webServer`（`@deepseek-ai/dsh-host-webserver`）

类型签名（`dsh/node_modules/@deepseek-ai/dsh-host-webserver/lib/types/index.d.ts`）：

```ts
declare module '@deepseek-ai/cordis' {
  interface Context { webServer: WebServer }
  interface Events {
    'webserver/index-inject'(table: IndexInjection[]): void   // @mode emit，每次渲染 index 时收集
  }
}

export type WebRouteKind = 'exact' | 'prefix'
export interface WebRoute {
  kind: WebRouteKind
  path: string                                 // 绝对路径，无尾斜杠
  handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>  // 全权负责响应（可 SSE）
}
export interface WebUpgradeRoute {
  path: string
  handler: (req: IncomingMessage, socket: Duplex, head: Buffer) => void | Promise<void>
}

class WebServer extends Service {
  get port(): number
  get host(): Config['host']
  register(route: WebRoute): () => void                    // 重复 (kind,path) 抛错
  registerUpgrade(route: WebUpgradeRoute): () => void      // 精确路径 WebSocket 升级；重复抛错
  registerFallback(handler: WebRoute['handler']): () => void // 兜底位，SPA dist 服务器独占；第二人注册抛错
  tapIndex(transform: (html: string) => string): () => void  // index.html 纯函数变换
  applyIndexTaps(html: string): string
  collectIndexInjections(): IndexInjection[]
  renderIndex(html: string): string
}
```

`IndexInjection`（`dsh-host-webserver/lib/types/injections.d.ts`）：`{kind:'global', name, value}`（写 globalThis）、`{kind:'script', placement:'head'|'body', text}`、`{kind:'script-src', placement, src}`、`{kind:'script-preload', src}`、`{kind:'style', text}`、`{kind:'html', placement, html}`。

**真实调用示例（WebSocket 桥，`dsh-structured-document-view/src/index.ts` L72-92）**：

```ts
const wss = new WebSocketServer({ noServer: true })
ctx.effect(() => ctx.webServer.registerUpgrade({
  path: BRIDGE_PATH,                       // '/structured-document-view/ws'
  handler: (req, socket, head) => {
    const incoming = req as IncomingMessage
    const duplex = socket as unknown as Duplex
    if (!fence(incoming)) { duplex.destroy(); return }   // 信任围栏
    const url = new URL(incoming.url ?? '', 'http://localhost')
    const sessionId = url.searchParams.get('sessionId')
    if (sessionId === null || sessionId === '') { duplex.destroy(); return }
    wss.handleUpgrade(incoming, duplex, head as Buffer, (ws) => {
      attachSocket(bridge, ws, sessionId, parseClientMessage)
    })
  },
}), 'dsh-structured-document-view: bridge WebSocket')
```

### 3.2 `ctx.webRuntime`（trustedHosts 信任围栏）

- 由 `@deepseek-ai/dsh-web-app` 提供：`ctx.provide('webRuntime', { lanAddresses, trustedHosts })`（`dsh-web-app/lib/index.js` L173-175）。
- 类型（`dsh-web-app/lib/types/index.d.ts` L37-42）：

```ts
export interface WebRuntimeValues {
  lanAddresses: string[]    // 绑定 0.0.0.0 时采样的 LAN IPv4 字面量
  trustedHosts: string[]    // LAN 字面量 + 命令行 --trusted-host 显式权威
}
```

- **信任围栏用法（范式插件复制版，`dsh-structured-document-view/src/host/trust-fence.ts`）**：

```ts
export function isTrustedApiRequest(request, trustedHosts: readonly string[]): boolean {
  const host = header(request.headers, 'host')
  if (host === undefined) return false
  const hostUrl = parseAuthority(host)
  if (hostUrl === undefined) return false
  if (!isLoopbackHostname(hostUrl.hostname) && !isTrustedAuthority(hostUrl, trustedHosts)) return false
  if (header(request.headers, 'sec-fetch-site') === 'cross-site') return false
  const origin = header(request.headers, 'origin')
  if (origin === undefined) return true
  try { return new URL(origin).hostname === hostUrl.hostname } catch { return false }
}
// isLoopbackHostname: localhost / [::1] / 127.x.x.x
// isTrustedAuthority: 无端口条目匹配任意端口，否则精确 host:port
```

在插件主体里：`const fence = (req) => isTrustedApiRequest(req, ctx.webRuntime.trustedHosts)`，然后每个 HTTP 路由 / WS upgrade 入口先过 fence（这是 DNS rebinding / 跨站防护，不是身份认证）。

### 3.3 `ctx.web`（注意：与 webServer 无关！）

`ctx.web` 是 **搜索/抓取能力 seam**（`@deepseek-ai/dsh-web`），不是 HTTP 服务器：

```ts
declare module '@deepseek-ai/cordis' { interface Context { web: WebRuntime } }

class WebRuntime extends Service {
  registerSearchProvider(provider: WebSearchProvider): () => void
  registerFetchProvider(provider: WebFetchProvider): () => void
  search(request: WebSearchRequest, signal?: AbortSignal): Promise<WebSearchResult>
  fetch(request: WebFetchRequest, signal?: AbortSignal): Promise<WebFetchResult>
}
// WebSearchRequest { query, maxResults? }
// WebSearchResult { content?, sources: readonly WebSearchSource[], truncated }
// WebFetchRequest  { url }
// WebFetchResult   { url, statusCode, body: {kind:'html'|'text', content}, truncated }
// WebError extends HarnessError（错误码开放字符串，如 WEB_PROVIDER_UNAVAILABLE）
```

若 dsh-automation 需要联网（如任务完成后抓取网页），直接用 `ctx.web.fetch/search`；不需要自己开 HTTP 客户端。

---

## 4. `ctx.tools` 注册工具（`@deepseek-ai/dsh-tools`）

### 4.1 注册与服务面

`ctx.tools` 是 `ToolRuntime`（`dsh-tools/lib/types/index.d.ts`，`declare module '@deepseek-ai/cordis' { interface Context { tools: ToolRuntime } }`）。主要方法：

```ts
class ToolRuntime extends Service {
  static Config
  register(definition: ToolDefinition): () => void      // 重复 name 抛错
  get(name: string, scope?: ScopeKey): ToolDefinition | undefined
  schemas(scope?: ScopeKey): Record<string, ToolSchema>
  restrict(filter: (definition) => boolean): () => void
  guard(guard: ToolGuard): () => void                    // 权限门
  presentAs(mode: ToolPresentationMode): () => void
  execute(exec: ToolExecution): Promise<ToolExecutionResult>
}
// 事件（waterfall）：
//   'tools/pre-execute'(exec, next): Promise<PreToolDecision>
//   'tools/around'(exec, next): Promise<ToolExecutionResult>
//   'tools/execute' / 'tools/result' / 'tools/error' ...
```

### 4.2 `defineTool` 签名（`dsh-tools/lib/types/schema.d.ts`）

```ts
export declare function defineTool<const S extends ParameterSchemaSpec, const O extends ValueSchemaSpec>(
  options: DefineToolOptions<S, O>
): ToolDefinition

interface DefineToolOptions<S, O> {
  name: string
  description: string
  parameters: S                              // 参数 schema（map 根即隐式 open object）
  output: {
    schema: O                                // 输出 schema
    render(args: InferArgs<S>, value: InferValue<O>): ContentBlock[]   // 纯文本投影（模型看到的结果）
  }
  timeoutMs?: number
  isConcurrencySafe?: boolean
  execute(args: InferArgs<S>, exec: ToolRunContext): Promise<InferValue<O>>
  finalizeContent?(args, value): ContentBlock[]          // 可选：最终内容重写
  presentCall?(args: InferArgs<S>): ToolCallView | undefined
  presentResult?(args: InferArgs<S>, result: ToolResult): ToolResultView | undefined
}
```

参数/值 schema（作者面 DSL，`dsh-tools/lib/types/schema.d.ts` L9-82）：

```ts
type ValueSchemaSpec =
  | { type: 'string';  enum?: readonly string[];  const?: string }
  | { type: 'number' | 'integer' | 'boolean'; enum?; const? }
  | { type: 'null' }
  | { type: 'array'; items?: ValueSchemaSpec }
  | { type: 'object'; properties?: ParameterSchemaSpec; additionalProperties: boolean }  // 必填！
  | { type: 'json' }                                        // 任意无损 JSON
  | { oneOf: readonly [ValueSchemaSpec, ValueSchemaSpec, ...ValueSchemaSpec[]] }
type ParameterPropertySpec = ValueSchemaSpec & { required?: true }
type ParameterSchemaSpec = { [key: string]: ParameterPropertySpec }   // 缺省即可选
```

`ToolRunContext`（`dsh-tools/lib/types/index.d.ts`）extends `ToolExecution`：

```ts
interface ToolExecution {
  callId: string
  rootCallId: string
  name: string
  arguments: JsonValue
  agent?: Agent                 // 调用方 Agent；取会话：exec.agent.session.id
  parent?: ToolCallId
  signal: AbortSignal
}
interface ToolRunContext extends ToolExecution {
  deferContext(ctx): void
  concludeTurn(): void
}
```

### 4.3 完整最小示例（照抄 `dsh-structured-document-view/src/tools/view-tools.ts` 模式）

```ts
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { ParameterPropertySpec, ToolRunContext } from '@deepseek-ai/dsh-tools'

// 信封：统一 { ok, code, message, ...data }
const baseEnvelope = {
  ok:      { type: 'boolean', required: true, description: '是否成功。' },
  code:    { type: 'string',  required: true, description: '状态 / 错误码。' },
  message: { type: 'string',  required: true, description: '人类可读说明。' },
} satisfies Record<string, ParameterPropertySpec>

function outputWith<const E extends Record<string, ParameterPropertySpec>>(extra: E) {
  return { type: 'object' as const, additionalProperties: false, properties: { ...baseEnvelope, ...extra } }
}

function sessionIdOf(exec: ToolRunContext): string | null {
  const id = (exec.agent as { session?: { id?: string } } | undefined)?.session?.id
  return typeof id === 'string' && id !== '' ? id : null
}

export function registerAutomationTools(ctx: { tools: { register(t: unknown): () => void } }): () => void {
  const disposers: Array<() => void> = []

  disposers.push(ctx.tools.register(defineTool({
    name: 'automation_run',
    description: '运行一个自动任务。适合「帮我跑一遍发布流程」。',
    parameters: {
      taskId: { type: 'string', required: true, description: '任务 id。' },
      dryRun: { type: 'boolean', description: '仅演练不执行。' },
    },
    output: {
      schema: outputWith({
        taskId:    { type: 'string', required: true },
        startedAt: { type: 'integer', required: true },
      }),
      render: (_args, value) => [{ type: 'text', text: `[${String((value as {code?:unknown}).code ?? 'OK')}] ${String((value as {message?:unknown}).message ?? '')}` }],
    },
    execute: async (args, exec) => {
      exec.signal.throwIfAborted()
      const sessionId = sessionIdOf(exec)
      if (sessionId === null) {
        return { ok: false, code: 'NO_AGENT', message: '无法确定调用方会话。', taskId: '', startedAt: 0 }
      }
      // ... 实际执行（写库 / 派发桥 / 调用 ctx.web）
      return { ok: true, code: 'OK', message: `任务 ${String((args as {taskId?:unknown}).taskId)} 已启动。`, taskId: String((args as {taskId?:unknown}).taskId ?? ''), startedAt: Date.now() }
    },
  })))

  return () => { for (const d of disposers) d() }
}
```

**错误码约定（范式插件的既定规范）**：失败**不 throw**，而是返回结构化结果 `{ ok:false, code:'<大写下划线码>', message:'...' }`，例如 `NO_AGENT` / `VIEW_UNAVAILABLE` / `INVALID_VIEW` / `BRIDGE_TIMEOUT`；`render` 只做纯文本投影（`[CODE] message`），模型永远拿到机器可读的结构化值。工具绑定 `exec.agent.session.id`，模型不传 sessionId。

---

## 5. `ctx.skills` 注册 Skill（`@deepseek-ai/dsh-skill`）

### 5.1 服务面（`dsh-skill/lib/types/index.d.ts`）

```ts
declare module '@deepseek-ai/cordis' {
  interface Context { skills: SkillRegistry }
}

// 运行时注册接受的最小对象：
export type SkillRegistration = Omit<SkillDefinition, 'invocation' | 'provider'> & {
  readonly invocation?: SkillInvocationPolicy     // { modelInvocable, userInvocable }；缺省=都允许
  readonly provider?: string                      // 缺省用 registry 自有 runtime provider
}

export interface SkillDefinition extends SkillSummary {
  readonly content: string            // Markdown 正文（去除 frontmatter 后）
  readonly path?: string
  readonly metadata?: Readonly<Record<string, unknown>>
}

class SkillRegistry extends Service {
  static Config
  register(skill: SkillRegistration): () => void            // 返回 disposer
  registerProvider(create: (ctx, config, control: SkillProviderControl) => SkillProvider): () => void
  list(options?: SkillViewOptions): Promise<readonly SkillSummary[]>
  snapshot(): SkillCatalogSnapshot
  get(name: string, options?: SkillViewOptions): Promise<SkillDefinition | undefined>
}
// 常量：BUNDLED_SKILL_RANK = 600（打包技能的标准优先级）
```

`SkillRegistration` 必需字段：`name`（kebab-case，`isSkillName()` 校验）、`description`、`content`；可选 `whenToUse`、`invocation`、`provider`、`resourceBase`、`path`、`metadata`。

### 5.2 真实示例：随包 SKILL.md 自注册（`dsh-structured-document-view/src/index.ts` L102-116 + `src/host/skill-registration.ts`）

```ts
ctx.effect(() => {
  const skills = ctx.skills
  let disposed = false
  let skillDisposer: (() => void) | undefined
  if (skills?.register !== undefined) {
    void loadBundledSkill().then((skill) => {        // 异步读文件；可失败返回 undefined
      if (disposed || skill === undefined) return
      skillDisposer = skills.register(skill)
    })
  }
  return () => { disposed = true; skillDisposer?.() }
}, 'dsh-structured-document-view: bundled skill')
```

`loadBundledSkill` 解析 `skills/<name>/SKILL.md` 的 YAML frontmatter（`name` / `description` / `whenToUse`），产出：

```ts
const registration: SkillRegistration = {
  name: parsed.name,
  description: parsed.description,
  content: parsed.content,              // 去除 --- frontmatter 之后的正文
  source: 'bundled',
  provider: 'dsh-structured-document-view',
  ...(parsed.whenToUse !== undefined ? { whenToUse: parsed.whenToUse } : {}),
}
```

注册是异步（读文件）但 disposer 同步、竞态安全。文件缺失/解析失败优雅降级为 undefined，绝不导致挂载崩溃。

---

## 6. Cordis 用法（`@deepseek-ai/cordis`，带完整 TS 源码）

DSH 用的 cordis 是 `@deepseek-ai/cordis`（4.0.2），**自带 `src/*.ts` 源码**，以下签名均来自 `cordis/src/`。

### 6.1 `ctx.provide` / `ctx.get` / `ctx.set`（`cordis/src/reflect.ts` L7-71）

```ts
interface Context {
  get<K extends string & keyof this>(name: K, strict?: boolean): undefined | this[K]   // strict 默认 true：只返回当前活跃 fiber 提供的实现
  set<K extends string & keyof this>(name: K, value: undefined | this[K]): void        // 只能由提供者覆盖；未提供则抛错
  provide<K extends string & keyof this>(name: K, value: undefined | this[K]): () => void  // 注册服务；返回 disposer；重复提供抛错
  accessor(name: string, options: { get(...): any; set?(...): void }): void
  mixin(name: string, mixins: string[] | Dict<string>): void
}
```

真实用法（`dsh-structured-document-view/src/index.ts` L56-61）：`const removeViewService = ctx.provide('structuredDocumentView', { id, getState, subscribe, dispatch })`，卸载时 `removeViewService()`。

### 6.2 `ctx.effect`（`cordis/src/fiber.ts` L9-14、L415 附近）

```ts
interface Context extends Pick<Fiber, 'effect'> {}
effect<T>(execute: Effect<T>, label?: string): void
// Effect = 返回 disposer 的函数 | Promise<disposer> | (异步)生成器逐个 yield disposer
// disposer 在 fiber 卸载时按注册逆序执行；可异步。
```

范式插件每个 effect 都带 label（如 `'dsh-structured-document-view: bridge WebSocket'`），用于诊断树；effect 内注册的 disposer（slots、webServer、tools、skills）全部在卸载时自动清理。

### 6.3 `ctx.on` / 事件（`cordis/src/events.ts` L34-117）

```ts
on<K extends keyof Events>(name: K, listener: Events[K], options?: boolean | EventOptions): () => boolean
once(...)
emit(name, ...args): void                     // 同步、不等待返回值
parallel(name, ...args): Promise<void>        // 并发 await 全部
serial(name, ...args): Promisify<...>         // 顺序 await，首个非空值截断
bail(name, ...args)                           // 首个同步 bail 值截断
waterfall(name, ...args)                      // 最后一个参数是 next 延续
// EventOptions { prepend?, global? }；boolean 是 prepend 简写
```

### 6.4 `ctx.inject` / `ctx.plugin`（`cordis/src/registry.ts` L164-186、L300-335）

```ts
inject(deps: Inject, callback: Plugin.Function<void>): Fiber & PromiseLike<Fiber>
// = ctx.plugin({ inject: deps, apply: callback, name: callback.name })
plugin<P extends Plugin>(plugin: P, ...args: Spread<GetPluginConfig<P>>): Fiber & PromiseLike<Fiber>

type Inject<M = Dict> = (keyof M)[] | { [K in keyof M]?: M[K] }   // 数组=无 intercept 配置

// 插件形态（Plugin）：函数 (ctx, config) | 类 new(ctx, config) | 对象 { apply(ctx, config) }
// Plugin.Base：{ name?, Config?, inject?, provide?, intercept? }
```

**关键机制**（registry.ts L330）：`new Fiber(this.ctx, config, Inject.resolve(plugin.inject), runtime, ...)` —— fiber 的 inject 直接读**插件对象自身的 `inject` 属性**；loader 层（`cordis-plugin-loader` L709）另把 `entry.options.inject` 合并进来。宿主半区 loader 只认 entry options（cordis.patch.yml），客户端半区 boot 直接 `registry.plugin(moduleExports, ...)` 所以**模块 `export const inject` 也会被读到**（两个范式插件客户端都靠它软依赖 `betterSidebar`）。

### 6.5 上下文是 Proxy

`ctx` 是 Proxy：**未 inject 且未提供的服务属性访问会抛 `cannot get property "xxx" without inject`**；因此要么在 `inject` 里声明，要么用 `ctx.get('xxx')` 软探测（范式插件用 `ctx.get('structuredDocument')` / `ctx.get('sidebarRight')` 做软依赖）。

---

## 7. 打包与清单：package.json `dsh` 字段 / cordis.patch.yml / tsdown

### 7.1 package.json `dsh` 字段（以 `dsh-structured-document-view/package.json` 为范式）

```jsonc
{
  "name": "dsh-automation",                 // 必须与 bundle id 一致
  "type": "module",
  "main": "./lib/index.js",                 // 宿主半区（tsc 产物）
  "types": "./lib/types/index.d.ts",
  "exports": {
    ".": { "types": "./lib/types/index.d.ts", "default": "./lib/index.js" },
    "./client": { "types": "./lib/types/client/index.d.ts", "default": "./lib/client.js" },  // ← 必需
    "./package.json": "./package.json",
    "./cordis.patch.yml": "./cordis.patch.yml"                                                   // ← 必需
  },
  "files": ["lib", "src", "skills", "docs", "cordis.patch.yml", "README.md", "CHANGELOG.md", "LICENSE"],
  "dsh": {
    "bundle": { "patch": "./cordis.patch.yml" },   // 官方 CLI 安装时据此追加进 bundle 栈
    "client": {
      "platform": "web",
      "inject": []                                  // 客户端包间/服务依赖（见下）
    }
  },
  "peerDependencies": {
    "@deepseek-ai/cordis": ">=4.0.2 <5.0.0",
    "@deepseek-ai/dsh-skill": ">=0.1.2-rc.1 <0.2.0",
    "@deepseek-ai/dsh-tools": ">=0.1.2-rc.1 <0.2.0",
    "react": "^18.2.0", "react-dom": "^18.2.0"
  }
}
```

`dsh.client` 支持字段（`dsh-client-modules/lib/index.js` `parseDshClient`，L140-154）：
- `platform: 'web'`（必须）
- `inject: string[]` —— 客户端图的**包间依赖 + 服务依赖**：shell 包用它声明依赖的其它 shell 包（如 `dsh-client-ui-layout` 注入 `["@deepseek-ai/dsh-client-locale","@deepseek-ai/dsh-client-ui-renderer","@deepseek-ai/dsh-client-ui-session","@deepseek-ai/dsh-client-ui-theme"]`），加载器先加载依赖包再加载本包，同时按服务名做 fiber 激活门控。**第三方插件可保持 `[]` 并在客户端模块里写 `export const inject = ['slots', 'layout']`（模块导出会被客户端 boot 读到）**——两个范式插件都这么做。
- `external: string[]` —— 请求的其它模块表条目（包行），参与图排序。
- `immediately: boolean` —— 立即预取 tier（boot 提前加载）。

### 7.2 cordis.patch.yml（`insert` 语法）

```yaml
# cordis.patch.yml —— 发布包的 `dsh.bundle.patch` 层
- insert:
    - id: dsh-automation            # 必须是完整 npm 包名（client-modules 按 loader 条目名解析 bundle）
      name: 'dsh-automation'        # 同上；简写会导致客户端半区静默缺席 window.__DSH_BOOT__
      # loader 模式下 entry options 才是权威 inject（cordis-plugin-loader 只读
      # entry.options.inject，不读模块导出的 export const inject）——与 src/index.ts 的 inject 保持一致
      inject: [tools, webServer, webRuntime, skills]   # 宿主半区服务依赖
      config: {}
```

安装方式：`dsh plugin --profile <name> add dsh-automation@<version>`，CLI 对照已装包调和 `dsh.profile.bundles`，把本 patch 的 `insert` 行当挂载行合并。`dsh-better-sidebar-controller` 的宿主 inject 还加了 `sessions`（`['tools','webServer','sessions','webRuntime','skills']`），说明可选服务有：`tools`、`webServer`、`webRuntime`、`skills`、`sessions`、`systemPrompt`、`shellEnv`、`loader`、`connection` 等。

### 7.3 客户端 bundle 的 tsdown 打包（banner/footer 格式）

`dsh-structured-document-view/tsdown.config.ts` 完整范式：

```ts
import { builtinModules } from 'node:module'
import type { UserConfig } from 'tsdown'

const BUNDLE_ID = 'dsh-automation'                       // = npm 包名（module-loader compose key）
const PLATFORM_EXTERNALS = ['react', 'react-dom', 'react/jsx-runtime', 'react-dom/client', 'cordis']

export default {
  entry: { client: 'src/client/index.ts' },
  outDir: 'lib',
  format: 'cjs',
  platform: 'browser',
  dts: false,
  clean: false,
  deps: {
    neverBundle: PLATFORM_EXTERNALS,   // 平台外部（shell 模块表提供）
    alwaysBundle: ['你的浏览器端真实依赖'],   // 必须内联进单一 bundle（闭包拿不到 node_modules）
    onlyBundle: ['你的浏览器端真实依赖'],
  },
  define: { 'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production') },
  outputOptions: {
    entryFileNames: 'client.js',
    banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(BUNDLE_ID)}, factory: (require) => {`,
    footer: 'return module.exports; } });',
    intro: 'var module = { exports: {} }; var exports = module.exports;',
    codeSplitting: false,              // 单一脚本
  },
} satisfies UserConfig
```

范式插件还带一个 `purityGate` 插件（resolveId 钩子）：拒绝 `node:*` 内建与 **任何 `@deepseek-ai/*` value import**（跨插件协作必须走 cordis 服务，禁止 value import；`@deepseek-ai/*` 类型 import 可用 `import type`）。

### 7.4 客户端加载链路（理解"为什么这么打包"）

1. 宿主 `dsh-client-modules` 扫描各插件 `dsh.client` 声明 → 组合 entry 图 → 以 **index 注入行** 形式写进 `index.html`：队列脚本 `window.__ModuleLoader__={mode:'queue', load(reg){...}, create(opts){...}}` + `script-src`（bootstrap 批）+ `global` 行 `window.__DSH_BOOT__ = 图`（`dsh-client-modules/lib/index.js` `bootInjections`，L387-432）。
2. bundle 经 `/plugins/??<ids>&rev=<hash>` combo 路由下发（`<id>/client.js` 单包地址也存在）。
3. 页面侧 `createClientModuleSystem` 解析 `__DSH_BOOT__`，按图 `arriveGraphRow`（先加载 `external`/`inject` 依赖包），`factory` 执行后以 `module.exports` 进模块表（`dsh-client-modules/lib/client.js` L184-336）。
4. web boot（`dsh-web-frontend/dist`）建 cordis 根 Context → `loader.create({name})` → 导入模块、`unwrapExports` → `registry.plugin(exports, config)` → fiber 依 `inject` 门控激活 → `apply(ctx)` 执行，`ctx.effect` 注册的资源随 fiber 生命周期清理（bundle `My` 类 `run()`/`runPluginBoot()`）。

### 7.5 构建脚本约定

```jsonc
"scripts": {
  "build": "npm run clean && tsc -p tsconfig.json && node -e \"require('node:fs').rmSync('lib/client',{recursive:true,force:true})\" && tsdown -c tsdown.config.ts",
  "bundle": "tsdown -c tsdown.config.ts",
  "prepack": "npm run build"
}
```

宿主半区走 `tsc`（`main: lib/index.js`）；构建时先删 `lib/client`（tsc 也会把 `src/client` 编进去）再跑 tsdown 覆盖为单一 `lib/client.js`。

---

## 8. dsh-automation 落地蓝图（照抄模板）

### 目录

```
dsh-automation/
├─ package.json          # dsh.bundle.patch + dsh.client{platform:'web', inject:[]}
├─ cordis.patch.yml      # insert 行（宿主 inject: [tools, webServer, webRuntime, skills]）
├─ tsconfig.json
├─ tsdown.config.ts      # banner/footer window.__ModuleLoader__.load
├─ src/
│  ├─ index.ts           # 宿主半区：webServer 路由/WS + tools + skills
│  ├─ context-types.ts   # vendored 交叉类型（照抄 structured-document-view/src/context-types.ts）
│  ├─ host/              # 桥服务器、trust-fence、skill-registration…
│  ├─ client/
│  │  ├─ index.ts        # export const inject + apply：注册 main 面板 + sidebar.panellist 入口
│  │  └─ AutomationPage.tsx   # 4 个 Tab 的页面组件
│  └─ shared/            # wire 协议、类型
└─ skills/automation/SKILL.md
```

### 宿主半区骨架（`src/index.ts`）

```ts
export const name = 'dsh-automation'
export const inject = ['tools', 'webServer', 'webRuntime', 'skills']

export function apply(ctx: Context): void {
  const fence = (req: IncomingMessage): boolean => isTrustedApiRequest(req, ctx.webRuntime.trustedHosts)

  // 可选：HTTP 路由（如 GET /automation/api/tasks）
  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix', path: '/automation/api',
    handler: (req, res) => { if (!fence(req)) { res.writeHead(403); res.end(); return } /* ...json... */ },
  }), 'dsh-automation: api')

  // 可选：WebSocket 桥（页面实时任务进度）
  const wss = new WebSocketServer({ noServer: true })
  ctx.effect(() => ctx.webServer.registerUpgrade({
    path: '/automation/ws', handler: (req, socket, head) => { /* fence + handleUpgrade */ },
  }), 'dsh-automation: ws')

  const toolsDisposer = registerAutomationTools(ctx)      // §4.3
  ctx.effect(() => { /* loadBundledSkill → ctx.skills.register */ }, 'dsh-automation: skill')
  ctx.effect(() => () => { toolsDisposer(); wss.close() }, 'dsh-automation: teardown')
}
```

### 客户端半区骨架（`src/client/index.ts`）——即第 2.2 节的完整代码

```ts
export const inject = ['slots', 'layout']   // 需要 ctx.layout 返回会话时用

export function apply(ctx: Context): void {
  ctx.effect(() => {
    const disposePage  = ctx.slots.register({ name: 'main', key: AUTOMATION_PANEL }, AutomationPage)
    const disposeEntry = ctx.slots.register({
      name: 'sidebar.panellist', id: AUTOMATION_PANEL,
      order: 100, label: () => ctx.locale.active === 'zh-CN' ? '自动任务' : 'Automation',
    }, AutomationIcon)
    return () => { disposePage(); disposeEntry() }
  }, 'dsh-automation: page + nav')
}
```

---

## 附：关键文件路径索引

| 主题 | 路径 |
|---|---|
| 布局 slot 表（sidebar/main/rightbar/shell.overlay） | `dsh\node_modules\@deepseek-ai\dsh-client-ui-layout\lib\types\client\index.d.ts` |
| 布局服务（selectPanel 等） | `dsh\node_modules\@deepseek-ai\dsh-client-ui-layout\lib\types\client\service.d.ts` |
| 侧栏 6 孔 contract | `dsh\node_modules\@deepseek-ai\dsh-client-ui-sidebar\lib\types\client\contract\slots.d.ts` |
| 侧栏编译实现（新会话按钮/panelList 顺序） | `dsh\node_modules\@deepseek-ai\dsh-client-ui-sidebar\lib\client.js`（L139-304） |
| `ctx.slots` SlotRegistry | `dsh\node_modules\@deepseek-ai\dsh-client-ui-renderer\lib\types\client\registry.d.ts` |
| slot 注册核心类型 | `F:\irving-dsh-plugins\dsh-better-sidebar-controller\node_modules\.pnpm\node_modules\@deepseek-ai\dsh-client-ui-slots\lib\types\index.d.ts` |
| 真实 keyed 注册示例（main/conversation） | `dsh\node_modules\@deepseek-ai\dsh-client-ui-conversation\lib\client.js`（L16823） |
| 真实多 slot 注册示例（rightbar 插件） | `dsh\node_modules\@deepseek-ai\dsh-client-ui-sidebar-right\lib\client.js`（L3705-3762） |
| `ctx.webServer` | `dsh\node_modules\@deepseek-ai\dsh-host-webserver\lib\types\index.d.ts`（+ injections.d.ts） |
| `ctx.webRuntime` 提供处 | `dsh\node_modules\@deepseek-ai\dsh-web-app\lib\index.js`（L173） |
| `ctx.web` 搜索/抓取 seam | `dsh\node_modules\@deepseek-ai\dsh-web\lib\types\index.d.ts` + `types.d.ts` |
| `ctx.tools` + defineTool | `dsh\node_modules\@deepseek-ai\dsh-tools\lib\types\index.d.ts` + `schema.d.ts` |
| `ctx.skills` + SkillRegistration | `dsh\node_modules\@deepseek-ai\dsh-skill\lib\types\index.d.ts` |
| cordis 源码（provide/get/effect/on/inject） | `dsh\node_modules\@deepseek-ai\cordis\src\{reflect,fiber,events,registry,context}.ts` |
| cordis-plugin-loader（entry.options.inject） | `dsh\node_modules\@deepseek-ai\cordis-plugin-loader\lib\index.js`（L709） |
| 客户端模块系统/__DSH_BOOT__/combo 路由 | `dsh\node_modules\@deepseek-ai\dsh-client-modules\lib\{index,client}.js` |
| 范式插件宿主入口 | `F:\irving-dsh-plugins\dsh-structured-document-view\src\index.ts` |
| 范式插件工具注册 | `F:\irving-dsh-plugins\dsh-structured-document-view\src\tools\view-tools.ts` |
| 范式插件 skill 注册 | `F:\irving-dsh-plugins\dsh-structured-document-view\src\host\skill-registration.ts` |
| 范式插件信任围栏 | `F:\irving-dsh-plugins\dsh-structured-document-view\src\host\trust-fence.ts` |
| 范式插件客户端入口 | `F:\irving-dsh-plugins\dsh-structured-document-view\src\client\index.ts` |
| 范式插件打包 | `F:\irving-dsh-plugins\dsh-structured-document-view\tsdown.config.ts` / `cordis.patch.yml` / `package.json` |
| 第二个范式（含 sessions inject、WS 桥） | `F:\irving-dsh-plugins\dsh-better-sidebar-controller\src\{index.ts, host\tools.ts, host\bridge-server.ts}` |
