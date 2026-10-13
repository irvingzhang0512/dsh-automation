import type { AutomationStore, AutomationId, Run, RunStatus, Task, Trigger, TriggerInput, CreateTaskInput } from '../shared/types.ts';
/** 兼容别名：第一版数据目录 `~/.dsh/automation`（保留导出，测试/迁移用）。 */
export declare function legacyAutomationHome(env?: NodeJS.ProcessEnv, home?: string): string;
/**
 * 解析 DSH 统一数据目录（对齐 dsh-agenda 的 resolveDataDir 规范）：
 *   override（配置 dataDir）→ $DSH_DATA_DIR/automation → $DSH_HOME/data/automation。
 */
export declare function resolveAutomationDataDir(env?: NodeJS.ProcessEnv, home?: string, override?: string): string;
/** 生成稳定 id（task_ / trigger_ / run_ 前缀 + 时间戳 + 随机）。 */
export declare function makeId(prefix: 'task' | 'trigger' | 'run'): AutomationId;
/** 存储选项。 */
export interface SqliteStoreOptions {
    /** 数据目录（缺省按 DSH 规范自动解析）。 */
    homeDir?: string;
    /** SQLite 备份保留份数（默认 10；0 关闭备份）。 */
    keepBackups?: number;
    /** 是否跳过旧路径迁移（测试用）。 */
    skipLegacyMigration?: boolean;
}
/** SQLite 实现的 AutomationStore。 */
export declare class SqliteAutomationStore implements AutomationStore {
    readonly homeDir: string;
    readonly dbPath: string;
    readonly logsDir: string;
    readonly backupDir: string;
    private readonly db;
    private readonly keepBackups;
    constructor(options?: SqliteStoreOptions);
    /** 关闭数据库（服务卸载时调用）。 */
    close(): void;
    /** 立即做一致性备份；强制迁移快照独立前缀，不参与常规轮转。 */
    backupNow(force?: boolean): string | undefined;
    /** 清理最旧的备份，只保留 keepBackups 份。 */
    private rotateBackups;
    private migrate;
    getMeta<T = unknown>(key: string): T | undefined;
    setMeta(key: string, value: unknown): void;
    transaction<T>(operation: () => T): T;
    hasOccurrence(triggerId: string, scheduledAt: string): boolean;
    unfinishedRuns(): Run[];
    fingerprint(): string;
    restoreSnapshot(file: string): void;
    listTasks(): Task[];
    getTask(id: string): Task | undefined;
    createTask(input: CreateTaskInput): Task;
    updateTask(id: string, patch: Partial<CreateTaskInput>): Task | undefined;
    deleteTask(id: string): boolean;
    listTriggers(taskId?: string): Trigger[];
    getTrigger(id: string): Trigger | undefined;
    addTrigger(taskId: string, input: TriggerInput): Trigger | undefined;
    updateTrigger(id: string, patch: Partial<TriggerInput>): Trigger | undefined;
    deleteTrigger(id: string): boolean;
    listRuns(filter?: {
        taskId?: string;
        status?: RunStatus;
        limit?: number;
    }): Run[];
    getRun(id: string): Run | undefined;
    createRun(run: Run): Run;
    updateRun(id: string, patch: Partial<Run>): Run | undefined;
    appendRunLog(runId: string, line: string): void;
    readRunLog(runId: string): string[];
}
/** 供测试用的临时存储（不干扰真实数据）。 */
export declare function createMemoryStore(): {
    store: AutomationStore;
    dbPath: string;
};
/**
 * 旧路径（~/.dsh/automation）→ 新路径（DSH 规范）一次性迁移。
 * 幂等：目标已存在（含空 db 文件）或旧路径不存在则跳过；成功后不删除旧目录。
 * @returns 是否发生了迁移。
 */
export declare function migrateLegacyData(legacyDir: string, targetDir: string): boolean;
/** 供宿主/工具读取备份目录与最近备份（状态展示用）。 */
export declare function latestBackupPath(store: {
    backupDir: string;
}): string | undefined;
