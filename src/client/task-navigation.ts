export type TaskKind = 'session' | 'direct'
export interface TaskNavigationSnapshot { kind: TaskKind; createRequest: number }
/** 客户端内存导航；请求只打开表单，绝不执行任务。 */
export function createTaskNavigation() {
  let snapshot: TaskNavigationSnapshot = { kind: 'session', createRequest: 0 }
  let guard: (() => boolean) | undefined
  let serial = 0
  const listeners = new Set<() => void>()
  const publish = (next: TaskNavigationSnapshot) => { snapshot = next; listeners.forEach(listener => listener()) }
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
    registerLeaveGuard(next: () => boolean) { guard = next; return () => { if (guard === next) guard = undefined } },
    consumeCreate(request: number) {
      if (request && snapshot.createRequest === request) publish({ ...snapshot, createRequest: 0 })
    },
    select(kind: TaskKind): boolean {
      if (snapshot.kind === kind) return true
      if (guard && !guard()) return false
      publish({ ...snapshot, kind }); return true
    },
    create(): boolean {
      if (guard && !guard()) return false
      publish({ kind: 'direct', createRequest: ++serial }); return true
    },
  }
}
export type TaskNavigation = ReturnType<typeof createTaskNavigation>
