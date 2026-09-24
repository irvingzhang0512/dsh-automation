/**
 * dsh-automation —— 客户端半区（浏览器）。
 *
 * 职责（需求 §3）：
 * 1. 在 DSH Web 左上区域“新会话”按钮正下方注册固定入口“定时任务”
 *    （sidebar.panellist list slot；点击 → selectPanel('automation')）；
 * 2. 在 `main` keyed slot 注册 `automation` 主面板（任务 / 待运行 / 运行中 /
 *    历史 四 Tab + 新建任务 Drawer + 任务详情 / Run 详情）。
 *
 * 交互数据经宿主 /api/automation REST API 获取（webServer 路由）。
 * 侧栏条目卡片化对齐「新会话」（style.ts 注入样式）。
 */
import type { Context } from '@deepseek-ai/cordis'
import { createElement } from 'react'
import { AutomationPage } from './AutomationPage.tsx'
import { injectStyle, removeStyle } from './style.ts'

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

/** 侧栏图标：时钟 + 箭头线框（◷），stroke 跟随条目颜色，激活用品牌色。 */
function AutomationGlyph(props: { size?: number; active?: boolean }): ReturnType<typeof createElement> {
  const size = props.size ?? 18
  const stroke = props.active === true ? 'var(--dsw-alias-brand-primary, #2f6fed)' : 'currentColor'
  return createElement(
    'svg',
    {
      width: size,
      height: size,
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke,
      strokeWidth: 1.7,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      'aria-label': '定时任务',
    },
    createElement('circle', { cx: 12, cy: 13, r: 8 }),
    createElement('path', { d: 'M12 9.5V13l2.5 2' }),
    createElement('path', { d: 'M12 3.5v2M4.5 7l1.4 1.4M19.5 7l-1.4 1.4' }),
  )
}

/** 客户端插件主体。 */
export function apply(rawCtx: Context): void {
  const ctx = rawCtx as AutomationClientContext
  injectStyle()

  ctx.slots.inject('main', () => ctx.slots.register(
    { name: 'main', key: AUTOMATION_PANEL, order: AUTOMATION_ORDER },
    () => createElement(AutomationPage),
  ))

  ctx.slots.inject('sidebar.panellist', () => ctx.slots.register(
    { name: 'sidebar.panellist', id: AUTOMATION_PANEL, order: AUTOMATION_ORDER, label: '定时任务' },
    (props: { size?: number; active?: boolean }) => createElement(AutomationGlyph, props),
  ))

  ctx.effect(() => () => {
    removeStyle()
  }, 'dsh-automation: style cleanup')
}

export { AUTOMATION_PANEL as AUTOMATION_PANEL_ID }
