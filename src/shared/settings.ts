export type SettingsOwner = 'time-context' | 'schedule' | 'automation'
export interface SettingField { path: string; label: string; type: 'string' | 'number'; default: string | number; min?: number; max?: number; help: string }
export const SETTINGS_FIELDS: Record<SettingsOwner, SettingField[]> = {
  'time-context': [
    { path: 'timeZone', label: '回退时区', type: 'string', default: '', help: '当前轮次没有唯一浏览器时区时使用；填写有效IANA时区，如Asia/Shanghai。默认跟随系统，空值恢复继承。不改变已有任务时区。官方条目重载后生效。' },
    { path: 'refreshIntervalMs', label: '时间读数间隔（毫秒）', type: 'number', default: 600000, min: 0, help: '模型多久收到一次时间读数，默认600000毫秒（10分钟）；0表示每个符合条件的步骤。范围0–9007199254740991的整数；调小增加上下文读数，调大更新较少，不改变提醒周期。官方条目重载后生效。' },
  ],
  schedule: [
    { path: 'deliveryHistoryDays', label: '投递记录保留天数', type: 'number', default: 30, min: 1, max: 3650, help: '每个任务默认保留30天，范围1–3650。调小保留较少历史，调大保留更久；与条数共同限制，官方条目重载后下一次追加记录时裁剪。不是执行结果。' },
    { path: 'deliveryHistoryRecords', label: '每任务投递记录条数', type: 'number', default: 200, min: 1, max: 10000, help: '每任务默认200条，范围1–10000；与天数共同裁剪，保留较新记录。调大保留更多记录，调小保留较少记录，官方条目重载后生效。' },
  ],
  automation: [
    { path: 'dataDir', label: '直接任务数据目录', type: 'string', default: '', help: '默认留空，按DSH数据目录解析。只存自研任务、运行、日志和备份；修改不自动搬迁或覆盖旧数据。服务重载后生效，执行中不能保存。' },
    { path: 'defaultTimeoutSeconds', label: '默认超时（秒）', type: 'number', default: 1800, min: 1, max: 2147483, help: '默认1800秒（30分钟），范围1–2147483整数；任务单独的超时优先。调大允许运行更久，调小更早超时。新服务、新运行采用；执行中不能保存。' },
    { path: 'tickMs', label: '调度检查间隔（毫秒）', type: 'number', default: 1000, min: 1, max: 2147483647, help: '默认1000毫秒（1秒），范围1–2147483647整数。调小检查更频繁，可能增加资源消耗；调大检查较少但可能延迟启动，不改变任务规则。服务重载后生效。' },
    { path: 'keepBackups', label: '自研备份保留份数', type: 'number', default: 10, min: 0, help: '默认10份，范围0–9007199254740991整数；0关闭常规备份。调大保留更多快照占用更多磁盘，调小更早清理旧备份。迁移仍强制备份，存储重载后生效。' },
  ],
}
export interface OwnerSettings {
  owner: SettingsOwner; entryId: string; effective: Record<string, unknown>; user: Record<string, unknown>; base: Record<string, unknown>
  fields: SettingField[]; writable: boolean; revisionToken: string; applies: string; unavailableReason?: string
}
