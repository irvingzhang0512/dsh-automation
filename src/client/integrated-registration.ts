export const OFFICIAL_TASK_PANEL = 'schedules'
/** 只使用公开注册表；保留原组件／注入／locale，卸载后原条目仍在。 */
export function registerIntegratedTasks(ctx: any, render: (entry: any, props: any) => any): void {
  ctx.slots.inject('main', () => {
    let current: any, dispose: (() => void) | undefined
    const synchronize = () => {
      const entries = ctx.slots.entries('main').filter((entry: any) => entry.options.key === OFFICIAL_TASK_PANEL && entry.locale === 'schedule.manager' && entry.registrant !== 'dsh-automation:integrated')
      const next = entries.length === 1 ? entries[0] : undefined
      if (current === next) return
      dispose?.(); dispose = undefined; current = next
      if (!next) return
      dispose = ctx.slots.register({ name: 'main', key: OFFICIAL_TASK_PANEL, priority: -100, registrant: 'dsh-automation:integrated', locale: next.locale, inject: next.inject }, (props: any) => render(next, props))
    }
    const unsubscribe = ctx.slots.subscribe('main', synchronize)
    synchronize()
    return () => { unsubscribe(); dispose?.(); current = undefined }
  })
}
