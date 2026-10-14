export type TaskKind = 'session' | 'direct';
export interface TaskNavigationSnapshot {
    kind: TaskKind;
    createRequest: number;
}
/** 客户端内存导航；请求只打开表单，绝不执行任务。 */
export declare function createTaskNavigation(): {
    getSnapshot: () => TaskNavigationSnapshot;
    subscribe(listener: () => void): () => void;
    registerLeaveGuard(next: () => boolean): () => void;
    consumeCreate(request: number): void;
    select(kind: TaskKind): boolean;
    create(): boolean;
};
export type TaskNavigation = ReturnType<typeof createTaskNavigation>;
