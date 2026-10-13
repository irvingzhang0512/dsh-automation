# dsh-automation 工具清单

16 个 `automation.*` 工具，供 LLM / Skill 通过工具统一管理直接定时任务。
所有工具返回统一信封 `{ ok, code, message, ... }`；失败返回结构化错误码而非抛错。

## 工具总览

| 工具 | 说明 |
|---|---|
| `automation.create_task` | 创建定时任务 |
| `automation.update_task` | 更新任务（名称/描述/动作/并发/重试/超时） |
| `automation.delete_task` | 删除任务（含其全部执行时间与历史 Run） |
| `automation.get_task` | 任务详情（含 Trigger 与最近运行） |
| `automation.list_tasks` | 列出任务（all / enabled / disabled 筛选） |
| `automation.enable_task` | 启用任务 |
| `automation.disable_task` | 暂停任务 |
| `automation.add_trigger` | 添加执行时间 |
| `automation.update_trigger` | 更新执行时间 |
| `automation.delete_trigger` | 删除执行时间 |
| `automation.list_upcoming_runs` | 待运行 |
| `automation.list_running_runs` | 运行中 |
| `automation.list_history` | 历史（taskId / status / limit 筛选） |
| `automation.get_run` | 运行详情（含日志） |
| `automation.run_now` | 立即运行一次 |
| `automation.cancel_run` | 取消一次运行 |

## 任务相关

### automation.create_task
创建任务。参数：
- `name`（必填）：任务名称，如「每日项目日报」。
- `description`：任务描述。
- `action`（必填）：执行动作，command／script两种类型见下。新建模型任务改用官方Schedule工具。
- `context`：执行上下文（`cwd` / `env`）。
- `concurrency`：`skip`（默认）/ `queue` / `parallel`。
- `retry`：`{ enabled, max_attempts, delay_seconds }`。
- `timeout_seconds`：超时秒数（默认取系统 `defaultTimeoutSeconds`）。

输出含 `task` 对象。

### automation.update_task / delete_task / enable_task / disable_task / get_task / list_tasks
- `update_task`：`task_id` 必填，其余字段可选补丁（enabled 启停请用 enable/disable）。
- `delete_task`：`task_id` 必填；删除后任务不再运行（历史 Run 一并移除）。
- `get_task`：`task_id` 必填；输出含 `task` / `triggers` / `runs`。
- `list_tasks`：`filter` = `all` / `enabled` / `disabled`（默认 all）。

## 执行时间（Trigger）

### automation.add_trigger
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

### automation.update_trigger / delete_trigger
- `update_trigger`：`trigger_id` 必填；可改 `enabled` 或触发配置（type + 对应参数）。
- `delete_trigger`：`trigger_id` 必填；只影响该执行时间，不影响任务与其它执行时间。

## 运行相关

### automation.run_now / cancel_run
- `run_now`：`task_id` 必填；创建手动 Run 入队（不影响定时计划）。输出含 `run_id`。
- `cancel_run`：`run_id` 必填；运行中 → 请求中止；排队中 → 直接取消；已完成 → `NOT_CANCELLABLE`。
  取消某一次 Run **不等于**删除任务，不影响后续周期执行。

### automation.list_upcoming_runs / list_running_runs / list_history / get_run
- `list_upcoming_runs`：无参数；待运行列表（按计划时间升序）。
- `list_running_runs`：无参数；运行中列表。
- `list_history`：可选 `task_id` / `status`（pending/running/success/failed/cancelled/skipped/timeout）/ `limit`（默认 100）。
- `get_run`：`run_id` 必填；输出含 `run` 与 `logs`（执行日志行）。

## Action 两种直接类型

```jsonc
{ "type": "command", "command": "git", "args": ["status", "--short"], "shell": false }
{ "type": "script", "path": "scripts/daily.py", "args": ["argument with spaces"], "interpreter": "python" }
```

script支持.py/.sh/.ps1/.js/.mjs。旧skill/agent_prompt只保留读取与迁移；创建／切换／启用／运行返回USE_OFFICIAL_SCHEDULE，不创建Session。

## 配置与迁移接口

GET/POST /api/automation/settings、/api/automation/migration契约见 [实施契约](IMPLEMENTATION-20261014.md)。配置按所有者保存而非跨区原子操作；迁移必须持有当前预览令牌。原生页面复用同源围栏。

## 错误码

- `TASK_NOT_FOUND` / `TRIGGER_NOT_FOUND` / `RUN_NOT_FOUND`
- `INVALID_TRIGGER` / `INVALID_INPUT`
- `NOT_CANCELLABLE` / `USE_OFFICIAL_SCHEDULE` / `TASK_BUSY` / `SERVICE_BUSY`
- 配置与迁移：非法所有者／字段、冲突／恢复冲突返回对应结构化code；冲突保留草稿
- 信封 `code` 供 LLM 判断与用户说明。
