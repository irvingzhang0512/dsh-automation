import { describe, it, expect } from 'vitest'
import { SlotCore } from '@deepseek-ai/dsh-client-ui-slots'
import { createTaskNavigation } from '../src/client/task-navigation.ts'
import { registerIntegratedTasks } from '../src/client/integrated-registration.ts'
describe('task page navigation', () => {
  it('defaults to official, direct creation publishes form intent only and preserves requests across switches', () => {
    const nav = createTaskNavigation(), changes: unknown[] = []
    const stop = nav.subscribe(() => changes.push(nav.getSnapshot()))
    expect(nav.getSnapshot()).toEqual({ kind: 'session', createRequest: 0 })
    nav.select('direct'); expect(nav.getSnapshot().createRequest).toBe(0)
    nav.create(); expect(nav.getSnapshot()).toEqual({ kind: 'direct', createRequest: 1 })
    nav.select('session'); nav.select('direct'); expect(nav.getSnapshot().createRequest).toBe(1)
    stop(); nav.create(); expect(changes).toHaveLength(4)
  })
  it('cancelled draft/busy guard rejects switching and another create, and stale cleanup cannot remove the live guard', () => {
    const nav = createTaskNavigation(); nav.create()
    let allow = false
    const stale = nav.registerLeaveGuard(() => true)
    const active = nav.registerLeaveGuard(() => allow); stale()
    const before = nav.getSnapshot()
    expect(nav.select('session')).toBe(false); expect(nav.create()).toBe(false); expect(nav.getSnapshot()).toBe(before)
    allow = true; expect(nav.select('session')).toBe(true)
    active(); nav.create(); expect(nav.getSnapshot().createRequest).toBe(2)
  })
  it('consumes form intents once so remount cannot reopen an old drawer, and stale acknowledgement cannot clear a new request', () => {
    const nav = createTaskNavigation(); nav.create(); nav.consumeCreate(1)
    expect(nav.getSnapshot().createRequest).toBe(0)
    nav.select('session'); nav.select('direct'); expect(nav.getSnapshot().createRequest).toBe(0)
    nav.create(); nav.consumeCreate(1); expect(nav.getSnapshot().createRequest).toBe(2)
    nav.consumeCreate(2); expect(nav.getSnapshot().createRequest).toBe(0)
  })
})
describe('public slot integration lifecycle', () => {
  function fixture() {
    const core: any = new SlotCore(), effects: (() => void)[] = []
    core.register({ name: 'root', children: { main: { kind: 'keyed', scope: 'root' } } }, () => null)
    const ctx = { slots: { inject: (_: string, setup: () => () => void) => { effects.push(setup()) }, entries: (key: string) => core.entries(key), subscribe: (key: string, cb: () => void) => core.subscribe(key, cb), register: (spec: any, component: any) => core.register(spec, component) } }
    const original = () => 'official', face = () => ({ onNewTask: () => 'session', hooks: { catalog: {} } })
    const official = () => core.register({ name: 'main', key: 'schedules', locale: 'schedule.manager', inject: face, registrant: '@deepseek-ai/dsh-client-ui-schedule' }, original)
    return { core, ctx, effects, original, face, official }
  }
  it('shadows only main, retains official callbacks, and unload restores the original winner', async () => {
    const f = fixture(); f.official(); await Promise.resolve()
    registerIntegratedTasks(f.ctx, (entry, props) => ({ entry, props }))
    const winner = f.core.entriesOfSlot('main')[0]
    expect(winner.inject).toBe(f.face); expect(winner.locale).toBe('schedule.manager')
    const props = { useCatalog: 'bound' }; expect(winner.component(props).props).toBe(props)
    expect(winner.component(props).entry.component).toBe(f.original)
    expect(f.core.entries('main')).toHaveLength(2)
    f.effects.forEach(stop => stop()); expect(f.core.entriesOfSlot('main')[0].component).toBe(f.original)
  })
  it('waits for official registration, releases stale injection on reload, and never duplicates itself', async () => {
    const f = fixture(); registerIntegratedTasks(f.ctx, () => 'integrated')
    expect(f.core.entries('main')).toHaveLength(0)
    const remove = f.official(); await Promise.resolve(); await Promise.resolve()
    expect(f.core.entries('main')).toHaveLength(2)
    remove(); await Promise.resolve(); await Promise.resolve(); expect(f.core.entries('main')).toHaveLength(0)
    f.official(); await Promise.resolve(); await Promise.resolve(); expect(f.core.entries('main')).toHaveLength(2)
    f.effects.forEach(stop => stop())
  })
})
