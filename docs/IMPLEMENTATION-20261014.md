# 官方自动化增强实施契约

版本：`official-automation-20261014-v1`；用户于 2026-10-14 明确要求按同页双分区方案实施，授权范围包含以下契约的落地与隔离验收。原始需求不改写；本文件取代旧升级契约中保留一次性模型执行器的目标。

## 功能与归属

- F001–F004、F006–F008、F010：仅承载直接任务（command/script）；原 16 个 automation.* 名称和结果信封保留。新建或切换到 skill/agent_prompt 返回 USE_OFFICIAL_SCHEDULE；旧记录可读、可迁移，不能重新启用旧执行器。
- F005/F009：旧模型执行器及 agent 名选择退役。会话任务由官方 Schedule 在原会话处理，automation Skill 引导调用 schedule_*，不声明投递等于执行完成。
- F011：依赖 Desktop、schedule Bundle 和三成员 0.2.0-rc.2。直接执行时间通过官方公开函数；自研保留队列、进程、运行记录。每月日期不足仍截断到月末。
- F012：官方 Bundle 详情中通过 plugins.detail.section 展示「官方配置」「Automation 配置」；独立草稿和保存。官方分 time-context/schedule 两所有者；没有保存全部。原 automation 主面板只从详情按钮进入，不注册 sidebar.panellist。
- F013：.py/.sh/.ps1/.js/.mjs，解释器分别 python/python3、bash、pwsh、node，可覆盖；工作目录/环境变量/参数有表单。PowerShell 使用 -NoProfile -NonInteractive -File。命令的额外 args 真正传入。取消和超时等待进程退出，Windows 终止所属进程树。
- F014：启动不补跑关闭期间错过的时间；过期 once 记录 skipped（文案「已错过」）。pending 恢复，running 标 failed/结果未知、不重试；排队按任务串行、parallel 实际并行。计划触发用 trigger_id+scheduled_at 防重复；手动运行独立。
- F015：迁移预览/应用/恢复、事务记录、备份、并发令牌；直接任务保留 ID/启用状态/历史。旧模型任务暂停，选择真实目标会话，按每个启用触发器创建官方提醒并保存映射。不可等价的 Cron、月末模型规则拒绝迁移，不静默变更。

## 公共接口

现有 /api/automation 路由以 path 聚合不变，工具继续使用 snake_case 参数。TriggerConfig 增加可选 time_zone；旧缺值在预览展示系统 IANA 时区，应用后固定保存。

| path | method | 请求/响应 |
|---|---|---|
| /api/automation/settings | GET | {owners:[{owner,entryId,effective,user,base,fields,writable,revisionToken,applies}]} |
| 同上 | POST | {owner,entryId,expectedRevisionToken,operations:[{op:'set'|'unset',path,value?}]}；成功返回完整 owners 描述，UI只更新当前所有者 |
| /api/automation/migration | GET | 只读预览，返回 revisionToken、timeZone、任务/触发器问题、会话选项及既有记录 |
| 同上 | POST | {operation:'apply'|'restore',expectedRevisionToken,task_id?,session_id?,migration_id?}；先备份，记录结果；恢复检查后续写入和官方映射，冲突拒绝 |

新接口复用现有同源信任围栏。配置仅允许固定三个所有者和八字段，普通参数经 configEditor.edit 正常重载；锁内比较令牌、保留未知字段/未编辑表达式，重置清除覆盖。运行中拒绝会重载 automation 的保存。迁移操作暂停本地调度，不能在直接执行中应用。

## 持久层与兼容

SQLite 追加 automation_meta 表（JSON迁移记录/映射/规则审查），不重建旧 tasks/triggers/runs。运行日志保留。迁移备份采用 SQLite 一致性快照，配置备份保存当前原条目的原始值；失败补偿删除本轮创建的官方提醒，失败的补偿保留明确待恢复记录。

首次启动只隔离旧模型任务与不等价规则；不创建官方提醒、不搬目录。旧模型内容与原配置保留供预览。直接历史保持。旧 once 若过期且从未记录该发生时刻，创建一次 skipped 回执。

版本为 0.2.0-rc.2+automation.1；同基线比较整数 automation 修订。实际挂载包来源及宿主 installAnchor 决定兼容状态；磁盘测试 peers 不是运行兼容证据。Git交付包含构建产物，历史根环境锁不写入此新核心组合。

## 验收

覆盖直接执行无Session/LLM、五格式、参数与进程树、所有规则/时区/月末、skip/queue/parallel、重启/错过/重复触发、8字段保存读回重置/CAS/草稿隔离、真实持久数据副本与失败恢复。类型、测试、构建、carrier、原生宽窄/主题/帮助分别记录，不将静态检查冒充GUI通过。日常安装与公开推送不在授权内。

新建HTTP任务可附triggers数组，任务和首次触发器同一SQLite事务创建；任一规则非法时均不落库，避免界面产生无计划的半成品任务。任务参数表单每行一个参数，保留参数中的空格；环境变量每行NAME=值。
