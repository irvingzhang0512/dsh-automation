# automation-direct-execution

## Purpose

直接管理与执行命令/脚本任务，使用持久化调度、并发和恢复规则。 本文是迁移后的活动规格；旧文档仅为冻结来源。迁移不新增功能、不等于重新完成运行验收。

## Requirements

### Requirement: F001 直接任务生命周期

系统 SHALL 满足本条既有行为与验收约束。来源：冻结的 [SPEC F001](../../../docs/SPEC.md)；确认、历史实现与验证依据见 [迁移索引](../../MIGRATION.md)。

- 预期与验收：创建、编辑、删除、启停、立即运行与取消一次；旧模型只读迁移。

#### Scenario: 直接创建任务并编辑

- **WHEN** 用户创建命令或脚本任务后修改名称、触发规则或启停状态
- **THEN** 按同一任务模型保存并读回；立即运行产生独立run，可取消该次而不删除未来规则。

#### Scenario: 旧模型任务仅供迁移

- **WHEN** 读取旧 skill 或 agent_prompt 任务
- **THEN** 保留历史与迁移入口，不作为可直接启用的新任务类型。


### Requirement: F002 时间规则

系统 SHALL 满足本条既有行为与验收约束。来源：冻结的 [SPEC F002](../../../docs/SPEC.md)；确认、历史实现与验证依据见 [迁移索引](../../MIGRATION.md)。

- 预期与验收：once/hourly/daily/weekday/weekly/monthly/cron、多触发器与IANA时区；月末截断。

#### Scenario: 多个触发器与时区

- **WHEN** 任务包含daily与weekly两个触发器并使用有效IANA时区
- **THEN** 每个触发器按任务所选时区计算执行时刻，保留独立触发器身份与对应run；非法时区拒绝。

#### Scenario: 短月日期

- **WHEN** 每月31日规则进入二月后再进入三月
- **THEN** 二月按既有月末截断，三月恢复31日，不累积漂移；once/hourly/daily/weekday/weekly/monthly/cron均保持既有规则。


### Requirement: F003 队列与运行控制

系统 SHALL 满足本条既有行为与验收约束。来源：冻结的 [SPEC F003](../../../docs/SPEC.md)；确认、历史实现与验证依据见 [迁移索引](../../MIGRATION.md)。

- 预期与验收：skip/queue/parallel、超时与失败重试；取消一次不影响后续。

#### Scenario: 并发策略生效

- **WHEN** 同一任务前次执行尚未结束时再次到达触发时刻
- **THEN** 分别按skip、queue或parallel处理，不把取消某次run解释为停用后续计划。

#### Scenario: 失败重试和超时

- **WHEN** 执行超时或失败且任务有重试策略
- **THEN** 记录失败/超时结果并按策略安排重试；显式取消不产生重试，等待中的重试可取消。


### Requirement: F004 命令和脚本

系统 SHALL 满足本条既有行为与验收约束。来源：冻结的 [SPEC F004](../../../docs/SPEC.md)；确认、历史实现与验证依据见 [迁移索引](../../MIGRATION.md)。

- 预期与验收：五格式、参数、解释器、cwd/env；不创建Session／调用模型。

#### Scenario: 运行本地脚本

- **WHEN** 选择支持的脚本文件并给出含空格的参数、工作目录与环境变量
- **THEN** 使用匹配解释器，保持参数边界、cwd和env；整个执行路径不创建Session、不调用LLM。


### Requirement: F013 参数与执行

系统 SHALL 满足本条既有行为与验收约束。来源：冻结的 [SPEC F013](../../../docs/SPEC.md)；确认、历史实现与验证依据见 [迁移索引](../../MIGRATION.md)。

- 预期与验收：参数每行一个保留空格、五格式支持；取消等待所属进程树退出。

#### Scenario: 逐行参数不拆空格

- **WHEN** 参数输入的一行内容为“项目 文件.txt”
- **THEN** 该整行作为单个参数传给解释器，不按空格再切分。

#### Scenario: 取消等待实际退出

- **WHEN** 取消仍有子进程的直接执行run
- **THEN** 只终止本run拥有的进程树，等待退出后才完成取消；不将已发送kill当成已停止。


### Requirement: F014 重启恢复

系统 SHALL 满足本条既有行为与验收约束。来源：冻结的 [SPEC F014](../../../docs/SPEC.md)；确认、历史实现与验证依据见 [迁移索引](../../MIGRATION.md)。

- 预期与验收：pending恢复，running结果未知且不重跑，周期不补跑，过期once只记一次已错过。

#### Scenario: 重启恢复区分pending和running

- **WHEN** 宿主退出后持久化记录分别为pending与running，再启动调度器
- **THEN** pending按既有恢复策略接续；原running标unknown且不自动重跑，避免重复外部副作用。

#### Scenario: 过期与错过周期

- **WHEN** 停机期间错过若干循环时刻且有已过期once
- **THEN** 循环不补跑；once恰记录一次skipped，重复启动不反复生成。


### Requirement: A001 任务与初始触发器原子创建

系统 SHALL 在同一事务中创建任务及全部初始触发器；任何一个触发器无效均拒绝整次创建。触发运行以 trigger_id 与 scheduled_at 去重；retry的到期时刻持久化，取消删除待重试状态。来源：[冻结实施契约](../../../docs/IMPLEMENTATION-20261014.md)、[架构](../../../docs/architecture.md)。

#### Scenario: 第二个触发器非法

- **WHEN** 同次创建提供两个触发器，其中一个Cron无效
- **THEN** 不留下任务或第一个孤立触发器；返回校验失败。

#### Scenario: 重放同一时刻

- **WHEN** 调度轮询或重启重复看到同一个trigger_id与scheduled_at
- **THEN** 不生成第二个有效run。


### Requirement: A002 解释器与运行资源边界

系统 SHALL 支持 .py/.sh/.ps1/.js/.mjs，分别使用指定或既定python/python3、bash、pwsh、node；PowerShell使用-NoProfile -NonInteractive -File。默认shell=false并显式传参数数组；shell=true仅按任务显式设置。stdout和stderr分别最多保留200000字符。暂停/卸载等待拥有的运行进程退出后再关闭数据库。来源：[冻结实施契约](../../../docs/IMPLEMENTATION-20261014.md)。

#### Scenario: 长输出与停机

- **WHEN** 脚本持续输出超过每流上限，随后插件卸载
- **THEN** 分别截断保留stdout/stderr而不无限占用；停机完成前收束自身进程与持久化状态。
