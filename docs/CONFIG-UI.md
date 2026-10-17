# 官方与 Automation 配置

0.2.1-rc.2起入口为自研Automation详情。time-context逻辑所有者映射到包含时间工具的官方三个预设，保存经configEditor逐项写入；预设值不同则只读，冲突拒绝，部分失败安全回退。预设重载后新会话采用，已有会话保持原快照。schedule／automation与原字段、默认、存储不变。详见[升级记录](DSH-UPGRADE-20261017.md)。

契约版本 official-automation-20261014-v1；用户确认入口为官方 Bundle 详情页中的两个独立分区。

automation.2 沿用全部配置字段与保存归属；仅将任务入口整合到侧栏“自动化任务”同页。任务级参数从顶部“新建直接任务”表单填写，详情旧入口也跳转该页直接标签。

| 所有者/分区 | 字段 | 默认 | 中文说明/控件 | 生效 |
|---|---|---|---|---|
| time-context/官方 | timeZone | 系统时区 | 回退时区；空值重置继承；IANA文本。不改变已有任务时区 | 官方条目重载后 |
| time-context/官方 | refreshIntervalMs | 600000 | 时间读数间隔（毫秒）；0每个符合条件步骤注入，较小会增加上下文读数 | 官方条目重载后 |
| schedule/官方 | deliveryHistoryDays | 30 | 每任务投递记录天数，1–3650；较小保留更少历史 | 重载后下一次追加裁剪 |
| schedule/官方 | deliveryHistoryRecords | 200 | 每任务投递条数，1–10000；与天数限额共同裁剪 | 重载后下一次追加裁剪 |
| automation/Automation | dataDir | 空 | 自研数据目录，空按DSH规范；修改不搬迁旧数据 | 自研服务重载后 |
| automation/Automation | defaultTimeoutSeconds | 1800 | 直接任务默认超时（秒），1–2147483整数；较大允许任务运行更久 | 新服务/新运行 |
| automation/Automation | tickMs | 1000 | 直接任务调度检查间隔（毫秒），1–2147483647整数；较小检查更频繁，不改变时间规则 | 自研服务重载后 |
| automation/Automation | keepBackups | 10 | 自研SQLite备份份数，非负整数；0关闭常规备份，迁移仍强制备份 | 存储重载后 |

每项中文帮助覆盖用途、默认、单位/范围、生效。工具提示支持键盘和点击。每个所有者独立草稿、保存、恢复继承、放弃和错误，不提供保存全部；刷新运行状态不重置草稿。

旧四个 automation 配置全部保留且只属 automation；不沿用旧 settings.register/scope 热更新叙述。官方配置不复制进 automation，未知字段/表达式保存时保留。任务级配置（参数列表、解释器、工作目录、环境变量、时区、重叠策略、重试、超时）均有表单。

数字上限避免Node定时器溢出导致超时／检查错误。迁移快照使用独立migration前缀，不参与keepBackups常规轮转；恢复结束后也不会自动删备份。
