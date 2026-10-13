import type { Context } from '@deepseek-ai/cordis'
import { createElement } from 'react'
import { AutomationPage } from './AutomationPage.tsx'
import { SettingsSection } from './SettingsSection.tsx'
import { injectStyle, removeStyle } from './style.ts'
export const AUTOMATION_PANEL = 'automation'
export const inject = ['slots', 'layout']
export function apply(raw: Context): void {
  const ctx = raw as any
  injectStyle()
  ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: AUTOMATION_PANEL }, () => createElement(AutomationPage)))
  ctx.slots.inject('plugins.detail.section', () => ctx.slots.register({ name: 'plugins.detail.section', id: 'automation-settings', order: 50 }, (props: any) => props.subject?.kind === 'bundle' && props.subject.pkg.name === '@deepseek-ai/dsh-experimental-schedule-bundle' ? createElement(SettingsSection, { onOpen: () => ctx.layout.selectPanel(AUTOMATION_PANEL) }) : null))
  ctx.effect(() => () => removeStyle(), 'automation: styles')
}
export { AUTOMATION_PANEL as AUTOMATION_PANEL_ID }
