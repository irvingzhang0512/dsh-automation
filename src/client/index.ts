/**
 * dsh-automation —— 客户端半区（浏览器）。
 *
 * 职责（需求 §3）：
 * 1. 在 DSH Web 左上区域“新会话”按钮正下方注册固定入口“自动任务”
 *    （sidebar.panellist list slot；点击 → selectPanel('automation')）；
 * 2. 在 `main` keyed slot 注册 `automation` 主面板（任务 / 待运行 / 运行中 /
 *    历史 四 Tab + 新建任务 Drawer + 任务详情 / Run 详情）。
 *
 * 交互数据经宿主 /api/automation REST API 获取（webServer 路由）；可选
 * /automation/ws 状态推送（第一版为轮询 + 5s 状态心跳，不做强依赖）。
 */
import type { Context } from '@deepseek-ai/cordis'
import { createElement } from 'react'
import { AutomationPage } from './AutomationPage.tsx'

/**
 * 面板 id（main keyed slot 的 key + panellist 条目 id）。
 * 客户端 bundle purity gate 禁止 @deepseek-ai value import，且
 * dsh-client-ui-layout/client 类型不在本地 node_modules（宿主提供），
 * 故本地定义与 shell 的 MainPanelId（Branded<'MainPanelId'>）同构的
 * branded 类型并铸造。
 */
declare const AUTOMATION_PANEL_BRAND: unique symbol
export type MainPanelId = string & { readonly [AUTOMATION_PANEL_BRAND]: 'MainPanelId' }
export const AUTOMATION_PANEL = 'automation' as unknown as MainPanelId
/** 侧栏入口顺序（100：位于全局面板区，新会话按钮正下方）。 */
const AUTOMATION_ORDER = 100

/** 客户端服务依赖：slots（注册）与 layout（导航回会话等）。 */
export const inject = ['slots', 'layout']

/** 客户端看到的 Context（slots/layout 为宿主客户端 runtime 注入）。 */
export interface AutomationClientContext extends Context {
  slots: {
    register(options: Record<string, unknown>, component: unknown): () => void
    inject(key: string, callback: unknown): () => void
  }
  layout: {
    selectPanel(panelId: MainPanelId | null): void
    beginNavigation(): AbortSignal
    toggleSidebar(): void
  }
  locale?: { active?: string }
}

/** 客户端插件主体。 */
export function apply(rawCtx: Context): void {
  const ctx = rawCtx as AutomationClientContext
  ctx.effect(() => {
    const slots = ctx.slots as {
      register(options: Record<string, unknown>, component: unknown): () => void
    }

    // ① 主面板：占 main keyed slot（4 个 Tab 都在这个组件里）。
    const disposePage = slots.register(
      {
        name: 'main',
        key: AUTOMATION_PANEL,
      },
      AutomationPage,
    )

    // ② 侧栏入口：占 sidebar.panellist（新会话按钮正下方）。
    const disposeEntry = slots.register(
      {
        name: 'sidebar.panellist',
        id: AUTOMATION_PANEL,
        order: AUTOMATION_ORDER,
        label: '自动任务',
      },
      // 图标组件：({ size, active }) => ReactNode
      (props: { size?: number; active?: boolean }) =>
        createElement(
          'span',
          {
            style: { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 },
            title: '自动任务',
          },
          createElement('span', { style: { fontSize: props.size ?? 16, lineHeight: 1 } }, '◷'),
          createElement('span', null, '自动任务'),
        ),
    )

    return () => {
      try {
        disposePage()
      } catch {
        // 忽略退订异常。
      }
      try {
        disposeEntry()
      } catch {
        // 忽略退订异常。
      }
    }
  }, 'dsh-automation: page + nav entry')
}

export { AUTOMATION_PANEL as AUTOMATION_PANEL_ID }
