import { createElement as h, useRef, useSyncExternalStore } from 'react'
import type { ComponentType } from 'react'
import { AutomationPage } from './AutomationPage.tsx'
import type { AutomationPageProps } from './AutomationPage.tsx'
import type { TaskNavigation } from './task-navigation.ts'
export function IntegratedTaskPage({ navigation, official, officialProps }: { navigation: TaskNavigation; official: ComponentType<any>; officialProps: any }) {
  const state = useSyncExternalStore(navigation.subscribe, navigation.getSnapshot)
  const directVisited = useRef(state.kind === 'direct')
  // 一经访问保持挂载；隐藏不卸载官方筛选／详情或直接标签状态。
  if (state.kind === 'direct') directVisited.current = true
  const showDirect = directVisited.current
  return h('section', { className: 'da-integrated', 'data-automation-integrated': true, 'aria-label': '自动化任务' },
    h('div', { className: 'da-integrated-top' },
      h('div', { className: 'da-integrated-actions' },
        h('div', { role: 'group', 'aria-label': '任务类型', className: 'da-kind-switch' },
          h('button', { type: 'button', 'aria-pressed': state.kind === 'session', onClick: () => navigation.select('session') }, '会话任务'),
          h('button', { type: 'button', 'aria-pressed': state.kind === 'direct', onClick: () => navigation.select('direct') }, '直接任务')),
        h('button', { type: 'button', className: 'da-new-direct', onClick: () => navigation.create() }, '＋ 新建直接任务')),
      h('div', { className: 'da-task-explanation', 'data-task-explanation': true },
        h('p', null, h('strong', null, '会话任务：'), '到时间后让模型在原会话处理指令，可使用 Skill，适合总结和分析。'),
        h('p', null, h('strong', null, '直接任务：'), '到时间后运行本机命令或脚本，不创建会话、不调用模型，适合确定性工作。'),
        h('p', { className: 'da-task-note' }, '两类任务都需要 DSH 保持运行；直接执行不代表立即执行。脚本先保存为本地文件，再填写路径。'))),
    h('div', { className: 'da-task-body', hidden: state.kind !== 'session', 'data-task-kind': 'session' }, h(official, officialProps)),
    showDirect && h('div', { className: 'da-task-body', hidden: state.kind !== 'direct', 'data-task-kind': 'direct' },
      h<AutomationPageProps>(AutomationPage, { embedded: true, createRequest: state.createRequest, onCreateConsumed: navigation.consumeCreate, registerLeaveGuard: navigation.registerLeaveGuard })))
}
