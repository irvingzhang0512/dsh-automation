import { it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { createContext, runInContext } from 'node:vm'
it('built client composes official task panel without registering another sidebar', () => {
  let entry: any
  const styles: any[] = []
  const sandbox: any = { window: { __ModuleLoader__: { load: (value: any) => entry = value } }, console, Intl, setInterval, clearInterval, setTimeout, clearTimeout }
  sandbox.document = { createElement: () => ({ setAttribute() {}, textContent: '' }), head: { appendChild: (style: any) => styles.push(style), querySelectorAll: () => [] } }
  runInContext(readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8'), createContext(sandbox))
  expect(entry.id).toBe('dsh-automation')
  const react = { createElement: (type: any, props: any, ...children: any[]) => ({ type, props, children }), useState: (value: any) => [typeof value === 'function' ? value() : value, () => {}], useEffect() {}, useRef: (value: any) => ({ current: value }), useSyncExternalStore: (_subscribe: any, read: any) => read() }
  const primitives = { Button: 'button', Tooltip: 'tooltip', SegmentedTabs: 'tabs' }
  const client = entry.factory((name: string) => name === 'react' ? react : primitives)
  const inject = () => ({ hooks: { catalog: {} }, onNewTask() {} })
  const official = { options: { key: 'schedules' }, locale: 'schedule.manager', inject, component: () => 'official', registrant: '@deepseek-ai/dsh-client-ui-schedule' }
  const slots: any[] = []
  const panels: string[] = []
  client.apply({ slots: { inject: (_name: string, fn: () => void) => fn(), entries: () => [official], subscribe: () => () => {}, register: (spec: any, component: any) => { slots.push({ spec, component }); return () => {} } }, layout: { selectPanel: (id: string) => panels.push(id) }, effect: (fn: any) => fn() })
  expect(slots.map(item => item.spec.name)).toEqual(['main', 'main', 'plugins.detail.section'])
  expect(slots[0].spec.key).toBe('schedules'); expect(slots[0].spec.priority).toBeLessThan(0)
  expect(slots[0].spec.inject).toBe(inject); expect(slots[0].spec.locale).toBe('schedule.manager')
  const bound = { useCatalog() {}, onNewTask() {}, t() {} }
  const integrated = slots[0].component(bound)
  expect(integrated.props.official).toBe(official.component); expect(integrated.props.officialProps).toBe(bound)
  const tree = integrated.type(integrated.props)
  expect(tree.props['data-automation-integrated']).toBe(true)
  const detail = slots[2].component({ subject: { kind: 'bundle', pkg: { name: '@deepseek-ai/dsh-experimental-schedule-bundle' } } })
  detail.props.onOpen(); expect(panels).toEqual(['schedules'])
  react.useEffect = (setup: any) => setup()
  expect(slots[1].component()).toBeNull(); expect(panels).toEqual(['schedules', 'schedules'])
  expect(slots[2].component({ subject: { kind: 'bundle', pkg: { name: 'other' } } })).toBeNull()
  expect(styles).toHaveLength(1)
})
