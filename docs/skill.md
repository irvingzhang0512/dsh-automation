# automation Skill 说明

`skills/automation/SKILL.md` 是随 dsh-automation 打包自注册的中文 Skill，
教 LLM 如何把用户关于「定时任务」的自然语言请求解析为 `automation.*` 工具调用。

## 用途

- 用户想按时间自动运行某个 Skill / Agent / 命令 / 脚本；
- 查看、修改、暂停、删除、立即运行、取消定时任务；
- 覆盖创建任务、添加执行时间、查看待运行/运行中/历史、失败重试与并发等完整生命周期。

## 触发词

「定时任务、自动任务、定时运行、每天/每周/每小时运行、自动日报/周报、下次运行、
待运行、正在运行、任务历史、立即运行一次、取消这次运行」等自动执行场景。

## 核心概念

- **Task（任务）**：要做什么。
- **Trigger（执行时间）**：什么时候运行；一个任务可多个，可单独增删。
- **Run（运行）**：一次实际执行；取消一次 Run ≠ 删除任务。

## 解析规则（自然语言 → 工具）

1. **识别 Action**：运行 XX Skill → `skill`；让 XX Agent 做 YY → `agent_prompt`；
   执行命令 / git XX → `command`；运行 XX.py / XX.sh → `script`。
2. **识别 Trigger**：每天晚上 8 点 → `daily time=20:00`；每周五下午五点 → `weekly weekday=5 time=17:00`；
   每隔两小时 → `hourly minute=0`；明天上午九点 → `once at=ISO`；每周一三五 → `weekday weekdays=[1,3,5]`；
   每月 1 号 → `monthly day=1`；Cron 为高级模式（普通用户默认不填）。
3. **命名 Task**：用简洁中文名概括，用户提到已有任务名则沿用。

## 常见请求 → 操作

| 用户说 | 操作 |
|---|---|
| 每天晚上八点运行项目日报 | `create_task`（skill + daily 20:00） |
| 每周五下午五点生成周报 | `create_task`（skill + weekly 5 17:00） |
| 明天上午九点运行一次数据整理 | `create_task`（skill + once） |
| 每隔两个小时运行一次检查 | `create_task`（command + hourly） |
| 把项目日报改成晚上九点 | `list_tasks` → `update_trigger`（或删旧加新） |
| 暂停/恢复/删除项目日报 | `list_tasks` → `disable_task` / `enable_task` / `delete_task` |
| 再加一个上午九点的执行时间 | `list_tasks` → `add_trigger` |
| 删除下午六点这个执行时间 | `get_task` 看 trigger → `delete_trigger` |
| 今晚这次不执行，后面继续 | 找到今晚的 Run → `cancel_run`（**不要**删任务） |
| 看看现在有哪些定时任务 | `list_tasks` |
| 今天还有哪些任务要运行 | `list_upcoming_runs` |
| 现在有什么在运行 | `list_running_runs` |
| 最近哪些任务失败了 | `list_history`（status="failed"） |
| 立即运行一次项目日报 | `list_tasks` → `run_now` |

## 行为约定

- **先查询再修改**：修改/暂停/删除/运行前先 `list_tasks`（必要时 `get_task`）拿准确 id，不凭名称猜。
- **一个任务可多执行时间**：加执行时间用 `add_trigger`，不是新建任务。
- **取消一次运行 ≠ 删除任务**：`cancel_run` 取消那次 Run，绝不能 `delete_task`。
- **成功创建后汇报**：告知任务名、执行时间、下一次执行时间（`list_upcoming_runs` / `get_task`）。
- 所有操作**必须**通过工具完成，绝不直接修改存储文件。
