import type { Context } from '@deepseek-ai/cordis'
import { createElement, useEffect } from 'react'
import { IntegratedTaskPage } from './IntegratedTaskPage.tsx'
import { createTaskNavigation } from './task-navigation.ts'
import { registerIntegratedTasks, OFFICIAL_TASK_PANEL } from './integrated-registration.ts'
import { SettingsSection } from './SettingsSection.tsx'
import { injectStyle, removeStyle } from './style.ts'
export const AUTOMATION_PANEL = 'automation'
export const inject = ['slots', 'layout']
export function apply(raw: Context): void {
  const ctx = raw as any
  injectStyle()
  const navigation = createTaskNavigation()
  const openDirect = () => { if (navigation.select('direct')) ctx.layout.selectPanel(OFFICIAL_TASK_PANEL) }
  registerIntegratedTasks(ctx, (entry, props) => createElement(IntegratedTaskPage, { navigation, official: entry.component, officialProps: props }))
  function LegacyDirectPanel() { useEffect(openDirect, []); return null }
  ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: AUTOMATION_PANEL }, LegacyDirectPanel))
  ctx.slots.inject('plugins.detail.section', () => ctx.slots.register({ name: 'plugins.detail.section', id: 'automation-settings', order: 50 }, (props: any) => props.subject?.kind === 'bundle' && props.subject.pkg.name === '@deepseek-ai/dsh-experimental-schedule-bundle' ? createElement(SettingsSection, { onOpen: openDirect }) : null))
  ctx.effect(() => () => removeStyle(), 'automation: styles')
}
export { AUTOMATION_PANEL as AUTOMATION_PANEL_ID }
