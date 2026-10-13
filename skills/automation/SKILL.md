---
name: automation
description: 在DSH中创建会话提醒或无Session命令/脚本任务；按任务类型选择官方Schedule与automation工具。
---

# 自动化

先区分用户要模型继续工作，还是确定性执行本地程序。

## 会话与Skill任务

使用官方 schedule_create / schedule_list / schedule_update / schedule_delete，在接收后续工作指令的原会话操作。明确时间、IANA时区、标题和指令；Skill任务指令引用会话中可用的技能。原会话的上下文和工具决定能做什么；投递记录不等于执行成功。不要用automation创建skill/agent_prompt，不每次创建新会话，不把“指定Agent名”视为已实现。

## 无会话直接任务

使用 automation.create_task / automation.update_task / automation.delete_task / automation.get_task / automation.list_tasks / automation.enable_task / automation.disable_task。
动作仅command或script；支持.py/.sh/.ps1/.js/.mjs，可设置args、interpreter、context.cwd/context.env。参数为字符串列表，保留空格；解释器缺失明确失败。所有数据操作走工具，不能直改数据库。

时间用 automation.add_trigger / automation.update_trigger / automation.delete_trigger；支持once/hourly/daily/weekday/weekly/monthly/cron与明确time_zone。星期编号0周日至6周六，适配到官方周规则；每月不足日截断。新Cron使用官方Vixie规则，最小一分钟。

观察与运行用 automation.list_upcoming_runs / automation.list_running_runs / automation.list_history / automation.get_run / automation.run_now / automation.cancel_run。取消本次不删除任务或后续计划。skip跳过重叠，queue依次运行，parallel同时运行；重试仅在用户配置时使用。宿主关闭期间错过的时间不自动补跑，中断结果未知不自动重试。

## 配置与旧任务

插件管理→官方→自动化任务详情有独立「官方配置」「Automation配置」。两区各自保存、重置、草稿和错误；没有保存全部。官方区的时间感知、任务调度分别保存。直接任务管理从此页按钮进入，不新增侧栏入口。

旧模型任务从迁移入口预览，选择真实目标会话；无法等价转换的规则保持待处理，明确选择新规则后再迁移。迁移会备份，后续数据/官方提醒改动时拒绝覆盖恢复。不要声称恢复原进程、保证恰好执行一次，或把脚本输出当作外部消息发送成功。
