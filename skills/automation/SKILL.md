---
name: automation
description: 管理 DeepSeek Harness 的定时自动任务。当用户想按时间自动运行某个 Skill / Agent / 命令 / 脚本，或查看、修改、暂停、删除、立即运行、取消定时任务时使用。涵盖创建任务、添加执行时间、查看待运行/运行中/历史、失败重试与并发等完整任务生命周期。
whenToUse: 用户提到"定时任务、自动任务、定时运行、每天/每周/每小时运行、自动日报/周报、下次运行、待运行、正在运行、任务历史、立即运行一次、取消这次运行"等自动执行场景时使用。
---

# DSH 自动任务（dsh-automation）

本 Skill 教会你（LLM）如何理解用户关于"按时间自动执行任务"的自然语言请求，
并正确调用 dsh-automation 插件的工具。所有操作**必须**通过工具完成，
绝不直接修改存储文件。

## 核心概念

- **Task（任务）**：要做什么。例：`每日项目总结`。
- **Trigger（执行时间）**：什么时候运行。一个任务可以有**多个**执行时间，
  可以单独添加 / 删除其中一个，不影响任务本身。
- **Run（运行）**：某一次实际执行。取消某一次 Run **不等于**删除任务，
  也不会影响后续周期执行。

## 支持的执行动作（Action）

| 类型 | 说明 | 关键参数 |
|---|---|---|
| `skill` | 运行一个 DSH Skill | `skill`（技能名）、可选 `prompt` |
| `agent_prompt` | 给指定 Agent 发 Prompt | `agent`、`prompt` |
| `command` | 运行 Shell / CLI 命令 | `command`（如 `git pull`） |
| `script` | 执行本地脚本（.py / .sh） | `path`、可选 `args` / `interpreter` |

## 支持的执行时间（Trigger）

| 类型 | 参数 |
|---|---|
| `once` | `at`（ISO 时刻，如 `2026-09-23T09:00:00`） |
| `hourly` | `minute`（每小时第几分钟，默认 0） |
| `daily` | `time`（如 `18:00`） |
| `weekday` | `weekdays`（[0=周日 … 6=周六]）、`time` |
| `weekly` | `weekday`（0=周日 … 6=周六）、`time` |
| `monthly` | `day`（1-31）、`time` |
| `cron` | `expr`（标准 5 字段，如 `0 18 * * *`） |

普通用户默认不需要直接填 Cron；Cron 是高级模式。

## 工具清单

- `automation.create_task`：创建任务
- `automation.update_task`：修改任务
- `automation.delete_task`：删除任务
- `automation.get_task`：查看单个任务详情（含执行时间与最近运行）
- `automation.list_tasks`：列出所有任务（可按 全部/已启用/已暂停 筛选）
- `automation.enable_task` / `automation.disable_task`：启用 / 暂停任务
- `automation.add_trigger`：添加执行时间
- `automation.update_trigger`：修改执行时间
- `automation.delete_trigger`：删除执行时间
- `automation.list_upcoming_runs`：查看待运行
- `automation.list_running_runs`：查看运行中
- `automation.list_history`：查看历史（可按任务 / 状态筛选）
- `automation.get_run`：查看一次运行详情（含日志）
- `automation.run_now`：立即运行一次
- `automation.cancel_run`：取消一次运行

## 解析规则

把用户的自然语言拆成 Task + Trigger + Action 三部分：

1. **识别 Action**：找到"运行/执行"的对象。
   - "运行 XX Skill / 技能" → `skill`（skill=XX）
   - "让 XX Agent 做 YY" → `agent_prompt`（agent=XX, prompt=YY）
   - "执行命令 XX / git XX" → `command`（command=XX）
   - "运行脚本 XX.py / XX.sh" → `script`（path=XX）
2. **识别 Trigger**：找到时间表达。
   - "每天晚上 8 点 / 18:00" → `daily` time="20:00"
   - "每周五下午五点" → `weekly` weekday=5 time="17:00"
   - "每隔两个小时" → `hourly` minute=0
   - "明天上午九点" → `once` at=明天 09:00 的 ISO
   - "每周一、三、五上午" → `weekday` weekdays=[1,3,5] time="09:00"
   - "每月 1 号" → `monthly` day=1 time=...
3. **命名 Task**：用一个简洁中文名概括（如"每日项目日报"），
   若用户提到已有任务名则沿用。

## 常见请求 → 操作映射

| 用户说 | 操作 |
|---|---|
| 每天晚上八点运行项目日报 | `automation.create_task`（skill + daily 20:00） |
| 每周五下午五点生成周报 | `automation.create_task`（skill + weekly 5 17:00） |
| 明天上午九点运行一次数据整理 | `automation.create_task`（skill + once） |
| 每隔两个小时运行一次检查任务 | `automation.create_task`（command + hourly） |
| 把项目日报改成晚上九点 | 先 `list_tasks` 找到任务 → `update_trigger`（或删除旧 trigger 再加新的） |
| 暂停项目日报 | `list_tasks` → `disable_task` |
| 恢复项目日报 | `list_tasks` → `enable_task` |
| 删除项目日报 | `list_tasks` → `delete_task` |
| 给项目检查再加一个上午九点的执行时间 | `list_tasks` → `add_trigger` |
| 删除下午六点这个执行时间 | `get_task` 看 trigger → `delete_trigger` |
| 今天晚上那次不要执行，但后面继续 | 找到今晚的 Run → `cancel_run`（**不要**删任务） |
| 看看现在有哪些自动任务 | `list_tasks` |
| 看看今天还有哪些任务要运行 | `list_upcoming_runs` |
| 现在有什么任务正在运行 | `list_running_runs` |
| 最近有哪些任务失败了 | `list_history`（status="failed"） |
| 立即运行一次项目日报 | `list_tasks` → `run_now` |

## 行为约定

- **先查询再修改**：修改 / 暂停 / 删除 / 运行任务前，先用 `list_tasks`
  （必要时 `get_task`）拿到准确的 task_id / trigger_id，不要凭名称猜 id。
- **一个任务可多执行时间**：用户说"再加一个上午九点的执行时间"，
  用 `add_trigger`，而不是新建任务。
- **取消一次运行 ≠ 删除任务**：用户说"今晚这次不执行，后面继续"，
  用 `cancel_run` 取消那次 Run，**绝不能** `delete_task`。
- **成功创建后汇报**：创建后告诉用户任务名、执行时间、下一次执行时间
  （用 `list_upcoming_runs` 或 `get_task` 确认下一次运行时间）。

## 创建任务示例对话

用户："每天晚上 8 点帮我运行项目日报 Skill。"

1. `automation.create_task`：
   - name=`每日项目日报`
   - action=`{ type: "skill", skill: "project-daily-report" }`
   - 执行时间：`automation.add_trigger` → `{ type: "daily", time: "20:00" }`
2. 回复："已创建“每日项目日报”。每天 20:00 执行。下一次执行时间：今天 20:00。"
