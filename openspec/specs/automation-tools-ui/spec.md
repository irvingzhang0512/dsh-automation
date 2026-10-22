# automation-tools-ui

## Purpose

通过稳定工具、HTTP接口和官方同页入口管理任务，保留页面状态与工具名称迁移边界。 本文是迁移后的活动规格；旧文档仅为冻结来源。迁移不新增功能、不等于重新完成运行验收。

## Requirements

### Requirement: F007 页面工具与API

系统 SHALL 满足本条既有行为与验收约束。来源：冻结的 [SPEC F007](../../../docs/SPEC.md)；确认、历史实现与验证依据见 [迁移索引](../../MIGRATION.md)。

- 预期与验收：16个操作及/api/automation保留，工具仅注册 `automation_<操作名>`；名称唯一、长度不超过64且匹配 `^[a-zA-Z0-9_-]+$`，卸载释放全部注册。参数、结果信封与服务操作不变；原生同源围栏、直接页四Tab及同页入口沿用。
- 兼容边界：旧点号名称退役、不注册别名；任务／触发器／运行历史不以工具名关联，无数据库迁移。检查当前持久工具过滤／明确名称引用并逐项列明迁移；未知／无关字段保留。会话日志不改写，仅失败记录的旧会话验证新轮次；含旧工具调用的会话通过新会话或官方压缩后过渡，不承诺直接续聊兼容。

#### Scenario: 工具名称与卸载

- **WHEN** 宿主加载16个automation_工具或卸载插件
- **THEN** 名称符合限定正则和64字符限制且唯一；卸载注销全部，不保留旧点号名别名。

#### Scenario: 引用迁移不重写历史

- **WHEN** 已有过滤配置包含确认的旧工具名、无关名和未知表达式
- **THEN** 只迁移明确引用关系，保留未知项与会话历史；旧工具对话不承诺无缝继续。


### Requirement: F016 同页任务入口

系统 SHALL 满足本条既有行为与验收约束。来源：冻结的 [SPEC F016](../../../docs/SPEC.md)；确认、历史实现与验证依据见 [迁移索引](../../MIGRATION.md)。

- 预期与验收：唯一官方侧栏入口，同页会话／直接切换、顶部新建直接任务与常驻区别说明；复用官方组件／注入，切换保留状态、草稿放弃提示、卸载恢复官方页面，无 Session／模型直接执行。

#### Scenario: 官方同页切换

- **WHEN** 用户从官方自动任务侧栏打开页面并在会话/直接执行标签间切换
- **THEN** 只有一个入口，复用官方组件/注入与locale；直接执行的新建入口明确用途，草稿和状态保留，弃稿先确认。

#### Scenario: 卸载增强

- **WHEN** 增强插件停止或卸载
- **THEN** 恢复官方任务页与原功能，不留下重复入口或失效注入。


### Requirement: F017 插件列表与详情的显示名称

系统 SHALL 满足本条既有行为与验收约束。来源：冻结的 [SPEC F017](../../../docs/SPEC.md)；确认、历史实现与验证依据见 [迁移索引](../../MIGRATION.md)。

插件 SHALL 通过分发locale提供规定的中英文名称及简介，保持包名和运行身份不变；布局和旧功能回归按下列精确断言验收。

#### Scenario: 插件名称可本地化

- **WHEN** 宿主从固定产物加载locale
- **THEN** 中文显示Irving · 自动化增强，英文显示Irving · Automation Enhancement；包身份、服务及工具名称保持。
- **AND** 场景与预期：中文显示「Irving · 自动化增强」，英文显示「Irving · Automation Enhancement」；保留完整包名 dsh-automation 与全部运行标识。
- **AND** 中文简介：为 DSH 内置自动化增加命令与脚本任务，支持定时执行、失败重试、超时及并发控制。
- **AND** 英文简介：Extend DSH built-in automation with command and script tasks, scheduled execution, failure retries, timeouts, and concurrency control.
- **AND** 技术契约：导出 locale/en.json 与 locale/zh.json 的 meta.title／meta.description；exports["./locale/*.json"] 指向对应资源，files 分发 locale，package.description 使用中文简介兜底。客户端设置／详情标题同步；功能导航不强制改名。
- **AND** 验收：目标宿主从固定 tgz 解析两语言名称／简介，原生列表、详情、成员行一致；无新增布局溢出，原工具／配置／存储保持。新套件成员在隔离验证后交付日常。

### Requirement: A004 公共接口保持服务语义

系统 SHALL 保持16项 automation_ 工具与 /api/automation 对同一服务的参数、结果和错误语义；旧automation.*名称仅作为历史迁移输入。具体工具参数、结果和错误码在下方附录逐项保留，来源为[迁移时工具契约](../../../docs/tools.md)；未来语义修改先在本能力增量规格列明，再同步工具说明。任务页面不是另一套调度器。

#### Scenario: 同一操作的工具与页面结果

- **WHEN** 分别从工具和HTTP页面读取同一task/run
- **THEN** 返回同一持久记录与执行状态；错误通过既定错误结构表达，不只在UI伪造成功。

## 工具参数与结果附录

本附录属于A004，保留迁移时16工具的精确参数和结果；工具说明本轮不动，后续只按已确认OpenSpec变更同步。

### 工具总览

| 工具 | 说明 |
|---|---|
| `automation_create_task` | 创建定时任务 |
| `automation_update_task` | 更新任务（名称/描述/动作/并发/重试/超时） |
| `automation_delete_task` | 删除任务（含其全部执行时间与历史 Run） |
| `automation_get_task` | 任务详情（含 Trigger 与最近运行） |
| `automation_list_tasks` | 列出任务（all / enabled / disabled 筛选） |
| `automation_enable_task` | 启用任务 |
| `automation_disable_task` | 暂停任务 |
| `automation_add_trigger` | 添加执行时间 |
| `automation_update_trigger` | 更新执行时间 |
| `automation_delete_trigger` | 删除执行时间 |
| `automation_list_upcoming_runs` | 待运行 |
| `automation_list_running_runs` | 运行中 |
| `automation_list_history` | 历史（taskId / status / limit 筛选） |
| `automation_get_run` | 运行详情（含日志） |
| `automation_run_now` | 立即运行一次 |
| `automation_cancel_run` | 取消一次运行 |

### 任务相关

#### automation_create_task
创建任务。参数：
- `name`（必填）：任务名称，如「每日项目日报」。
- `description`：任务描述。
- `action`（必填）：执行动作，command／script两种类型见下。新建模型任务改用官方Schedule工具。
- `context`：执行上下文（`cwd` / `env`）。
- `concurrency`：`skip`（默认）/ `queue` / `parallel`。
- `retry`：`{ enabled, max_attempts, delay_seconds }`。
- `timeout_seconds`：超时秒数（默认取系统 `defaultTimeoutSeconds`）。

输出含 `task` 对象。

#### automation_update_task / delete_task / enable_task / disable_task / get_task / list_tasks
- `update_task`：`task_id` 必填，其余字段可选补丁（enabled 启停请用 enable/disable）。
- `delete_task`：`task_id` 必填；删除后任务不再运行（历史 Run 一并移除）。
- `get_task`：`task_id` 必填；输出含 `task` / `triggers` / `runs`。
- `list_tasks`：`filter` = `all` / `enabled` / `disabled`（默认 all）。

### 执行时间（Trigger）

#### automation_add_trigger
`task_id` 必填 + 触发配置（按 `type` 取相应参数）：

| type | 参数 |
|---|---|
| `once` | `at`（ISO 时刻，如 `2026-09-23T09:00:00`） |
| `hourly` | `minute`（每小时第几分钟，默认 0） |
| `daily` | `time`（如 `18:00`） |
| `weekday` | `weekdays`（[0=周日 … 6=周六]）、`time` |
| `weekly` | `weekday`（0=周日 … 6=周六）、`time` |
| `monthly` | `day`（1-31）、`time` |
| `cron` | `expr`（5 字段，如 `0 18 * * *`） |

所有类型可带time_zone（IANA时区）；缺值新建时固定宿主系统时区。每月日期不足截断至月末。一个任务可添加多个执行时间，可单独删除其中一个。

#### automation_update_trigger / delete_trigger
- `update_trigger`：`trigger_id` 必填；可改 `enabled` 或触发配置（type + 对应参数）。
- `delete_trigger`：`trigger_id` 必填；只影响该执行时间，不影响任务与其它执行时间。

### 运行相关

#### automation_run_now / cancel_run
- `run_now`：`task_id` 必填；创建手动 Run 入队（不影响定时计划）。输出含 `run_id`。
- `cancel_run`：`run_id` 必填；运行中 → 请求中止；排队中 → 直接取消；已完成 → `NOT_CANCELLABLE`。
  取消某一次 Run **不等于**删除任务，不影响后续周期执行。

#### automation_list_upcoming_runs / list_running_runs / list_history / get_run
- `list_upcoming_runs`：无参数；待运行列表（按计划时间升序）。
- `list_running_runs`：无参数；运行中列表。
- `list_history`：可选 `task_id` / `status`（pending/running/success/failed/cancelled/skipped/timeout）/ `limit`（默认 100）。
- `get_run`：`run_id` 必填；输出含 `run` 与 `logs`（执行日志行）。

### Action 两种直接类型

```jsonc
{ "type": "command", "command": "git", "args": ["status", "--short"], "shell": false }
{ "type": "script", "path": "scripts/daily.py", "args": ["argument with spaces"], "interpreter": "python" }
```

script支持.py/.sh/.ps1/.js/.mjs。旧skill/agent_prompt只保留读取与迁移；创建／切换／启用／运行返回USE_OFFICIAL_SCHEDULE，不创建Session。


### 错误码

- `TASK_NOT_FOUND` / `TRIGGER_NOT_FOUND` / `RUN_NOT_FOUND`
- `INVALID_TRIGGER` / `INVALID_INPUT`
- `NOT_CANCELLABLE` / `USE_OFFICIAL_SCHEDULE` / `TASK_BUSY` / `SERVICE_BUSY`
- 配置与迁移：非法所有者／字段、冲突／恢复冲突返回对应结构化code；冲突保留草稿
- 信封 `code` 供 LLM 判断与用户说明。
