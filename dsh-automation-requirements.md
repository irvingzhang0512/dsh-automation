# dsh-automation 需求规格说明书

## 1. 项目概述

### 1.1 项目名称
**dsh-automation**

### 1.2 项目定位
`dsh-automation` 是面向 DeepSeek Harness（DSH）的自动化任务插件，用于统一管理“按时间自动执行”的任务。

插件不仅负责定时触发，还需要覆盖任务创建、任务查看、任务执行、运行状态、历史记录、日志、取消运行等完整生命周期，并允许 LLM / Skill 通过工具直接创建和管理任务。

### 1.3 核心目标

1. 支持用户通过 DSH Web 页面创建、查看、修改、删除和启停定时任务。
2. 支持通过 LLM / Skill 使用 Tool 创建和管理定时任务。
3. 支持查看：
   - 所有任务定义
   - 即将运行的任务
   - 正在运行的任务
   - 已完成任务及运行历史
4. 支持任务立即执行、取消执行、失败重试等基本运行控制。
5. 定时任务执行能力与 `dsh web` 生命周期解耦，Web 重启不能影响后台调度和长期运行任务。
6. 为后续“条件触发、事件触发、跨插件自动化”等能力预留扩展空间。

---

# 2. 设计原则

## 2.1 Scheduler 只负责任务调度，不实现具体业务

`dsh-automation` 负责：

- 什么时候运行
- 运行什么
- 当前运行到什么状态
- 是否成功
- 历史执行情况

具体业务由 DSH 中已有能力完成，例如：

- Skill
- Agent
- Command
- Script
- Tool
- Plugin Action

整体结构：

```text
用户 / LLM / Skill
        │
        ▼
dsh-automation Tool / API
        │
        ▼
Automation Service
        │
        ├── Trigger
        ├── Queue
        ├── Runner
        └── Run History
                │
                ▼
       Skill / Agent / Script / Command
```

## 2.2 Web 与后台执行解耦

禁止由浏览器页面或 `dsh web` 进程直接承载定时任务生命周期。

目标结构：

```text
dsh web
   │
   │ 管理 / 查询
   ▼
dsh-automation service
   │
   ├── Trigger Engine
   ├── Task Queue
   └── Worker
```

即使：

```text
dsh web restart
```

也不得中断：

- 已计划任务
- 正在执行的长期任务
- 任务历史
- 后续触发计划

---

# 3. DSH Web 入口

## 3.1 入口位置

在 DSH Web 左上区域，“新会话”按钮下方增加固定入口：

```text
┌─────────────────────────┐
│ deepseek HARNESS        │
│                         │
│      ＋ 新会话          │
│                         │
│      ◷ 自动任务         │
│                         │
└─────────────────────────┘
```

入口名称建议：

**自动任务**

英文可使用：

**Automation**

点击后进入 `dsh-automation` 主页面。

## 3.2 页面路由

建议：

```text
/automation
```

如果 DSH Plugin 路由要求统一命名空间，也可以：

```text
/plugins/dsh-automation
```

优先保证用户看到的是全局能力，而不是“插件设置页”。

---

# 4. 核心对象模型

系统至少区分以下三个核心对象：

```text
Task
Trigger
Run
```

---

## 4.1 Task：任务定义

Task 表示：

> 要做什么。

例如：

```text
每日项目总结
```

示例：

```yaml
id: task_001
name: 每日项目总结
description: 每天生成项目进展总结
enabled: true

action:
  type: skill
  skill: project-daily-summary

context:
  cwd: /workspace/project

created_by: llm
created_at: 2026-09-22T20:00:00
updated_at: 2026-09-22T20:00:00
```

---

## 4.2 Trigger：触发规则

Trigger 表示：

> 什么时候运行。

一个 Task 可以拥有一个或多个 Trigger。

例如：

```yaml
task_id: task_001

triggers:
  - id: trigger_001
    type: daily
    time: "09:00"

  - id: trigger_002
    type: daily
    time: "18:00"
```

因此用户可以：

```text
每天上午 9 点和下午 6 点执行一次
```

也可以：

```text
删除下午 6 点这个执行时间
```

而不用删除整个 Task。

### 第一版支持的 Trigger

```text
Once
Hourly
Daily
Weekday
Weekly
Monthly
Cron
```

普通用户默认不需要直接填写 Cron。

Cron 作为高级模式提供。

---

## 4.3 Run：一次具体运行

Run 表示：

> 某一次实际执行。

例如：

```yaml
id: run_20260922_001
task_id: task_001
trigger_id: trigger_002

scheduled_at: 2026-09-22T18:00:00
started_at: 2026-09-22T18:00:03
finished_at: 2026-09-22T18:00:35

status: success

output: ...
error: null
```

Task 和 Run 必须严格区分。

例如：

```text
Task：
每天 18:00 生成日报

Run：
9 月 22 日 18:00
9 月 23 日 18:00
9 月 24 日 18:00
```

取消某一次 Run，不等于删除整个 Task。

---

# 5. 主页面设计

点击左上角“自动任务”后进入主页面。

顶部建议使用四个 Tab：

```text
自动任务

[ 任务 ]   [ 待运行 ]   [ 运行中 ]   [ 历史 ]

                                  ＋ 添加任务
```

---

# 6. 「任务」页面

用于查看和管理全部 Task。

建议每个任务卡片展示：

```text
每日项目总结                         Enabled

每天 18:00

Skill · project-daily-summary

下一次运行：
今天 18:00

[立即运行]   [编辑]   [···]
```

### 支持操作

- 新建任务
- 编辑任务
- 删除任务
- 启用任务
- 暂停任务
- 立即运行
- 查看任务详情
- 添加 Trigger
- 删除 Trigger

### 筛选

第一版建议：

```text
全部
已启用
已暂停
```

后续可增加：

- Skill
- Agent
- Script
- Command
- 创建来源
- 标签

---

# 7. 「待运行」页面

用于回答：

> 接下来 DSH 准备做什么？

建议按时间排序。

示例：

```text
待运行

今天

18:00
每日项目总结
Skill · project-daily-summary

20:00
代码仓库备份
Command · backup.sh


明天

08:30
生成今日计划
Agent · PM Agent

09:00
项目状态检查
Skill · project-check
```

### 支持操作

- 查看 Task
- 查看本次 Run
- 取消本次运行
- 修改本次运行时间（可选，第二阶段）
- 立即执行

注意：

“取消本次运行”不能影响后续周期性任务。

---

# 8. 「运行中」页面

显示当前正在执行的 Run。

示例：

```text
● 数据分析任务

开始时间     22:10
已运行       01:23:41
任务类型     Agent
状态         Running

[查看日志]   [取消任务]
```

### 支持操作

- 查看实时状态
- 查看执行日志
- 查看输出
- 取消运行

### 长任务要求

系统必须支持：

- 几分钟
- 几十分钟
- 数小时

的长期任务。

Web 页面关闭或 `dsh web` 重启不能导致任务被终止。

---

# 9. 「历史」页面

用于查看已经完成的 Run。

建议展示：

| 时间 | 任务 | 状态 | 耗时 | 操作 |
|---|---|---|---|---|
| 09-22 18:00 | 每日项目总结 | 成功 | 32s | 查看 |
| 09-21 18:00 | 每日项目总结 | 成功 | 41s | 查看 |
| 09-20 18:00 | 每日项目总结 | 失败 | 12s | 查看错误 |

支持状态：

```text
pending
running
success
failed
cancelled
skipped
timeout
```

### 历史详情

显示：

```text
任务名称

计划执行时间
实际开始时间
结束时间
耗时

执行参数

输出

日志

错误信息
```

---

# 10. 新建任务界面

建议采用右侧 Drawer，而不是跳转独立页面。

示例：

```text
┌─────────────────────────────────┐
│ 新建自动任务                ×   │
│                                 │
│ 名称                            │
│ [ 每日项目总结                ] │
│                                 │
│ 执行时间                        │
│ [ 每天 ] [ 18:00 ]              │
│                                 │
│ ＋ 添加执行时间                 │
│                                 │
│ 执行动作                        │
│ [ Skill                   ▼ ]   │
│                                 │
│ Skill                           │
│ [ project-daily-summary   ▼ ]   │
│                                 │
│ 工作目录                        │
│ [ /workspace/project       ]    │
│                                 │
│           [取消] [创建任务]     │
└─────────────────────────────────┘
```

---

# 11. Action 类型

第一版建议支持四类：

## 11.1 Skill

```text
运行 DSH Skill
```

示例：

```yaml
action:
  type: skill
  skill: project-daily-summary
```

这是第一版最重要的 Action。

---

## 11.2 Agent Prompt

指定 Agent，并发送 Prompt。

例如：

```yaml
action:
  type: agent_prompt
  agent: project-manager
  prompt: |
    总结今天项目进展，
    输出明日重点事项。
```

---

## 11.3 Command

运行 Shell / CLI 命令。

例如：

```yaml
action:
  type: command
  command: git pull
```

---

## 11.4 Script

执行本地脚本。

例如：

```yaml
action:
  type: script
  path: scripts/backup.py
```

支持：

```text
.py
.sh
```

后续根据系统平台扩展。

---

# 12. Tool 设计

`dsh-automation` 必须向 DSH 注册 Tool。

LLM / Skill 不应该直接修改任务存储文件。

所有操作统一通过 Tool 完成。

第一版建议提供：

```text
automation.create_task

automation.update_task

automation.delete_task

automation.get_task

automation.list_tasks

automation.enable_task

automation.disable_task

automation.add_trigger

automation.update_trigger

automation.delete_trigger

automation.list_upcoming_runs

automation.list_running_runs

automation.list_history

automation.get_run

automation.run_now

automation.cancel_run
```

---

# 13. LLM / Skill 创建自动任务

插件需要包含一个 Automation Skill。

用途：

> 教 LLM 如何正确理解用户关于自动任务的自然语言请求，并调用 Automation Tool。

例如用户说：

```text
每天晚上 8 点帮我运行项目日报 Skill。
```

LLM 应解析为：

```text
Task：
每日项目日报

Trigger：
每天 20:00

Action：
Skill
project-daily-report
```

然后调用：

```text
automation.create_task
```

创建完成后回复：

```text
已创建“每日项目日报”。

每天 20:00 执行。
下一次执行时间：9 月 23 日 20:00。
```

---

# 14. 自然语言支持场景

至少支持以下表达：

```text
每天晚上八点运行项目日报。

每周五下午五点生成周报。

明天上午九点运行一次数据整理。

每隔两个小时运行一次检查任务。

把项目日报改成晚上九点。

暂停项目日报。

恢复项目日报。

删除项目日报。

给项目检查再加一个上午九点的执行时间。

删除下午六点这个执行时间。

今天晚上那次不要执行，但后面继续。

看看现在有哪些自动任务。

看看今天还有哪些任务要运行。

现在有什么任务正在运行？

最近有哪些任务失败了？

立即运行一次项目日报。
```

---

# 15. 调度服务

建议内部包含：

```text
Automation Service
│
├── Trigger Engine
│
├── Task Queue
│
├── Worker
│
├── Run Manager
│
├── Retry Manager
│
└── Storage
```

---

# 16. Trigger Engine

负责：

- Trigger 时间计算
- 下一次运行时间
- 创建 Run
- 将 Run 放入 Task Queue

Trigger Engine 必须运行在后台服务中。

不得依赖浏览器页面。

---

# 17. Task Queue

负责等待执行的 Run。

Run 状态：

```text
pending
    ↓
running
    ↓
success / failed / cancelled / timeout
```

队列至少需要：

- 排队
- 获取任务
- 状态更新
- 取消任务
- 超时处理

---

# 18. Worker

Worker 负责真正执行：

```text
Skill
Agent Prompt
Command
Script
```

后续可以扩展：

```text
Tool
Plugin Action
Workflow
```

---

# 19. 并发策略

必须考虑：

> 上一次任务还没结束，下一次 Trigger 又到了。

Task 增加：

```text
concurrency
```

第一版支持：

```text
skip
queue
parallel
```

### skip

如果已有相同任务运行，则跳过本次。

建议默认：

```text
skip
```

### queue

等待上一次完成后执行。

### parallel

允许同时运行多个实例。

---

# 20. 失败重试

Task 支持：

```yaml
retry:
  enabled: true
  max_attempts: 2
  delay_seconds: 60
```

第一版可以提供：

```text
不重试
重试 1 次
重试 2 次
重试 3 次
```

---

# 21. 超时

Task 可配置：

```yaml
timeout_seconds: 1800
```

默认值可由系统统一配置。

超时状态：

```text
timeout
```

---

# 22. 数据存储

建议第一版采用 SQLite。

原因：

- 本地存储
- 无需外部数据库服务
- 查询 Run 历史方便
- 支持事务
- 支持并发访问
- 后续扩展成本低

建议数据表：

```text
tasks

triggers

runs

run_logs
```

如果希望最初版本尽量轻量，也可以将日志存成独立文件：

```text
~/.dsh/automation/logs/
```

SQLite 保存索引和状态。

---

# 23. 本地持久化路径建议

建议：

```text
~/.dsh/automation/
```

例如：

```text
~/.dsh/automation/
│
├── automation.db
│
├── logs/
│   ├── run_xxx.log
│   └── ...
│
└── runtime/
    └── ...
```

如果 DSH 已有统一数据目录规范，应优先遵循 DSH 的目录约定。

---

# 24. 服务生命周期

建议 DSH 最终形成：

```text
dsh daemon
│
├── automation service
├── task worker
├── agent runtime
└── ...
```

如果当前 DSH 尚无 daemon，也可以第一阶段提供：

```text
dsh automation start

dsh automation stop

dsh automation restart

dsh automation status
```

服务需要支持：

- 开机自动启动
- 后台运行
- 异常退出恢复
- 不依赖 `dsh web`

---

# 25. Web 与后台服务通信

建议 Web 只通过 API 管理 Automation Service。

例如：

```text
GET    /api/automation/tasks

POST   /api/automation/tasks

GET    /api/automation/tasks/:id

PATCH  /api/automation/tasks/:id

DELETE /api/automation/tasks/:id

POST   /api/automation/tasks/:id/run

GET    /api/automation/runs

GET    /api/automation/runs/:id

POST   /api/automation/runs/:id/cancel
```

具体接口名称按 DSH 现有规范调整。

---

# 26. Task 详情页

建议结构：

```text
← 每日项目总结

每日项目总结                         [启用 ●]

每天 18:00
下一次运行：今天 18:00

────────────────────────────────

执行内容

类型      Skill
Skill     project-daily-summary
工作目录  ~/workspace/project

────────────────────────────────

执行时间

每天 18:00                         [编辑] [删除]

＋ 添加执行时间

────────────────────────────────

最近运行

今天 18:00       等待中
昨天 18:00       ✓ 成功     32 秒
09-20 18:00      ✕ 失败     查看错误

────────────────────────────────

[立即运行]   [编辑任务]   [删除任务]
```

---

# 27. 第一版 MVP 范围

## 必须完成

### Web

- 左上“新会话”下面增加“自动任务”入口
- 自动任务主页面
- 任务 Tab
- 待运行 Tab
- 运行中 Tab
- 历史 Tab
- 新建任务
- 修改任务
- 删除任务
- 启用 / 暂停任务
- 查看任务详情
- 查看 Run 详情
- 立即运行
- 取消运行

### Trigger

- Once
- Daily
- Weekly
- Cron

如果开发成本可控，再加入：

- Hourly
- Weekday
- Monthly

### Action

- Skill
- Agent Prompt
- Command
- Script

### Tool

- 创建任务
- 修改任务
- 删除任务
- 查询任务
- 查询待运行
- 查询运行中
- 查询历史
- 立即运行
- 取消运行

### 后台

- 独立 Automation Service
- Trigger Engine
- Queue
- Worker
- Run 状态管理
- SQLite 持久化
- 日志
- 基础失败重试
- 超时
- 并发策略

---

# 28. 第二阶段能力

后续可以扩展：

## 28.1 条件触发

例如：

```text
当 GitHub 有新的 Issue 时运行
```

## 28.2 事件触发

例如：

```text
当某文件变化时执行
```

## 28.3 Plugin Action

允许其他 DSH Plugin 注册 Action：

```text
project.generate_report

agenda.create_event

notification.send

git.backup
```

## 28.4 更完整的任务通知

例如：

```text
运行成功后通知

运行失败后通知

运行超过 N 分钟后通知
```

## 28.5 WebSocket 实时状态

运行中页面实时更新：

```text
pending → running → success
```

同时实时显示日志。

---

# 29. 与 dsh-agenda 的边界

`dsh-automation` 与 `dsh-agenda` 不应合并。

建议职责：

```text
dsh-agenda
    │
    ├── 人的日程
    ├── 待办
    ├── 日历
    └── 提醒需求

dsh-automation
    │
    ├── 自动执行任务
    ├── 时间触发
    ├── 后台运行
    └── Run 管理
```

例如：

```text
明天上午 9 点开会
```

属于：

```text
dsh-agenda
```

而：

```text
明天上午 8:30 自动整理会议材料
```

属于：

```text
dsh-automation
```

未来 Agenda 可以调用 Automation 来实现自动提醒或自动准备工作，但二者保持独立。

---

# 30. 第一版验收标准

满足以下条件即可认为第一版可用：

1. 用户可以从 DSH Web 左上方进入“自动任务”页面。
2. 可以通过 Web 创建一个每天固定时间运行的 Skill。
3. 可以通过自然语言让 LLM 创建同样的任务。
4. Web 页面与 LLM 创建的任务使用同一套后端数据。
5. 可以看到该任务的下一次运行时间。
6. 可以看到所有即将运行的任务。
7. 可以看到当前正在运行的任务。
8. 可以查看已经完成的任务历史。
9. 可以查看成功输出和失败日志。
10. 可以立即手动执行任务。
11. 可以取消正在运行的任务。
12. 可以取消某一次未来 Run，而不删除整个周期 Task。
13. 可以给一个 Task 添加多个 Trigger。
14. 可以单独删除其中一个 Trigger。
15. `dsh web` 重启后任务仍然存在。
16. `dsh web` 重启不能影响已经运行中的后台任务。
17. Automation Service 重启后可以恢复持久化任务。
18. 一个失败任务不会导致整个调度服务退出。

---

# 31. 最终定位

`dsh-automation` 第一阶段是：

> DSH 的定时自动任务中心。

后续可以逐渐演进为：

> DSH 的统一自动化运行基础设施。

最终可能支持：

```text
时间触发
条件触发
事件触发
        │
        ▼
Automation
        │
        ▼
Skill / Agent / Tool / Script / Plugin
```

这样可以成为 DSH 中所有后台自动化能力的统一底座。
