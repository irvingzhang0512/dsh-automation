# dsh-automation 当前功能规格

2026-10-17宿主升级契约与配置归属以[本次升级](DSH-UPGRADE-20261017.md)为准；原功能语义保持。

批准版：official-automation-20261014-v1、automation-integrated-page-20261014-v2 与 automation-tool-names-20261014-v1；用户于2026-10-14明确要求实施同版方案。当前包版本0.2.1-rc.2+automation.1。原始需求[只读保留](../dsh-automation-requirements.md)；旧升级提案[作为历史](DSH-UPGRADE-20261011.md)。执行细节见[实施契约](IMPLEMENTATION-20261014.md)，工具名称以[工具契约](tools.md)为准，配置技术映射见[配置表](CONFIG-UI.md)。

2026-10-14 同页任务整合获明确实施批准，契约 `automation-integrated-page-20261014-v2`；当前差异见[同页任务契约](INTEGRATED-TASK-PAGE-20261014.md)，实际验证见[本版验收](VERIFICATION-0.2.0-rc.2+automation.2.md)。

功能变化先修改规格与验收／相关技术契约，用户明确确认该版后开发；已确认同版不重复询问，预期不变的Bug直接修复。维护流程见[根文档规范](../../docs/DOC-DRIVEN-DEVELOPMENT.md)。

2026-10-14 用户明确要求实施「自动化工具名称兼容修复」计划，确认 `automation-tool-names-20261014-v1`：保留16个操作，将 `automation.<操作名>` 改为 `automation_<操作名>`，旧名退役、不注册别名；参数／结果／执行语义、HTTP API及业务数据不变。目标版本 `0.2.0-rc.2+automation.3`，仅交付隔离验证版，日常安装另行安排。对应工具契约见[工具清单](tools.md)。本段逐项承接用户确认的同版计划，不新增语义差异。

## 当前实现状态

以下条目已实现；“已实现”与“已验证”分开记录。自动测试、真实宿主、原生界面、固定Git安装的执行范围与限制分别见[本版验收](VERIFICATION-0.2.0-rc.2+automation.2.md)与[旧版执行验收](VERIFICATION-0.2.0-rc.2+automation.1.md)，不把历史证据冒充新版本验证。

## F001 直接任务生命周期

- 预期与验收：创建、编辑、删除、启停、立即运行与取消一次；旧模型只读迁移。
- 实现状态：已实现；[源码](../src/core/service.ts)。
- 自动验证入口：[用例](../tests/service.test.ts)；实际执行结果见本版验收。

## F002 时间规则

- 预期与验收：once/hourly/daily/weekday/weekly/monthly/cron、多触发器与IANA时区；月末截断。
- 实现状态：已实现；[源码](../src/shared/time.ts)。
- 自动验证入口：[用例](../tests/time.test.ts)；实际执行结果见本版验收。

## F003 队列与运行控制

- 预期与验收：skip/queue/parallel、超时与失败重试；取消一次不影响后续。
- 实现状态：已实现；[源码](../src/core/service.ts)。
- 自动验证入口：[用例](../tests/enhancement.test.ts)；实际执行结果见本版验收。

## F004 命令和脚本

- 预期与验收：五格式、参数、解释器、cwd/env；不创建Session／调用模型。
- 实现状态：已实现；[源码](../src/actions/process.ts)。
- 自动验证入口：[用例](../tests/process.test.ts)；实际执行结果见本版验收。

## F005 会话任务归官方

- 预期与验收：skill/agent_prompt旧执行器移除，新建拒绝并引导官方原会话。
- 实现状态：已实现；[源码](../skills/automation/SKILL.md)。
- 自动验证入口：[用例](../tests/service.test.ts)；实际执行结果见本版验收。

## F006 SQLite与历史

- 预期与验收：保留旧表与运行ID、输出／错误／退出码，追加元数据与一致性备份。
- 实现状态：已实现；[源码](../src/storage/sqlite.ts)。
- 自动验证入口：[用例](../tests/storage.test.ts)；实际执行结果见本版验收。

## F007 页面工具与API

- 预期与验收：16个操作及/api/automation保留，工具仅注册 `automation_<操作名>`；名称唯一、长度不超过64且匹配 `^[a-zA-Z0-9_-]+$`，卸载释放全部注册。参数、结果信封与服务操作不变；原生同源围栏、直接页四Tab及同页入口沿用。
- 兼容边界：旧点号名称退役、不注册别名；任务／触发器／运行历史不以工具名关联，无数据库迁移。检查当前持久工具过滤／明确名称引用并逐项列明迁移；未知／无关字段保留。会话日志不改写，仅失败记录的旧会话验证新轮次；含旧工具调用的会话通过新会话或官方压缩后过渡，不承诺直接续聊兼容。
- 实现状态：已实现；[工具源码](../src/tools/automation-tools.ts)、[API源码](../src/server/api.ts)。
- 自动验证入口：[工具用例](../tests/tools.test.ts)、[API用例](../tests/api.test.ts)；实际注册、调用、卸载与隔离Desktop携带全部新工具调用DeepSeek V4.1、执行 `automation_list_tasks` 后完整回复的结果见[本版验收](VERIFICATION-0.2.0-rc.2+automation.3.md)，不复用此前仅HTTP 200的诊断作为通过依据。

## F008 配置所有权

- 预期与验收：八字段精确回写三个原所有者，保留未知字段／未改表达式。
- 实现状态：已实现；[源码](../src/host/settings.ts)。
- 自动验证入口：[用例](../tests/enhancement.test.ts)；实际执行结果见本版验收。

## F009 旧具名Agent路径退役

- 预期与验收：不按旧agent名称新建会话；迁移必须显式选择可用原会话。
- 实现状态：已实现；[源码](../src/host/migration.ts)。
- 自动验证入口：[用例](../tests/enhancement.test.ts)；实际执行结果见本版验收。

## F010 配置生效

- 预期与验收：普通参数正常重载；直接运行期间拒绝automation及schedule保存。
- 实现状态：已实现；[源码](../src/index.ts)。
- 自动验证入口：[用例](../tests/enhancement.test.ts)；实际执行结果见本版验收。

## F011 官方基线

- 预期与验收：Desktop＋Bundle＋三成员精确0.2.0-rc.2；版本自研修订比较。
- 实现状态：已实现；[源码](../src/host/compatibility.ts)。
- 自动验证入口：[用例](../tests/enhancement.test.ts)；实际执行结果见本版验收。

## F012 双分区原生界面

- 预期与验收：官方详情两个分区、独立草稿／保存／错误／重置，无保存全部和重复侧栏；详情直接任务按钮打开同页直接任务。
- 实现状态：已实现；[源码](../src/client/SettingsSection.tsx)。
- 自动验证入口：[用例](../tests/client-bundle.test.ts)；实际执行结果见本版验收。

## F013 参数与执行

- 预期与验收：参数每行一个保留空格、五格式支持；取消等待所属进程树退出。
- 实现状态：已实现；[源码](../src/actions/process.ts)。
- 自动验证入口：[用例](../tests/enhancement.test.ts)；实际执行结果见本版验收。

## F014 重启恢复

- 预期与验收：pending恢复，running结果未知且不重跑，周期不补跑，过期once只记一次已错过。
- 实现状态：已实现；[源码](../src/core/service.ts)。
- 自动验证入口：[用例](../tests/enhancement.test.ts)；实际执行结果见本版验收。

## F015 迁移与恢复

- 预期与验收：只读预览、备份、冲突、防不等价规则、原会话映射、失败补偿／恢复。
- 实现状态：已实现；[源码](../src/host/migration.ts)。
- 自动验证入口：[用例](../tests/enhancement.test.ts)；实际执行结果见本版验收。

## F016 同页任务入口

- 预期与验收：唯一官方侧栏入口，同页会话／直接切换、顶部新建直接任务与常驻区别说明；复用官方组件／注入，切换保留状态、草稿放弃提示、卸载恢复官方页面，无 Session／模型直接执行。
- 实现状态：已实现；[技术契约](INTEGRATED-TASK-PAGE-20261014.md)，[源码](../src/client/IntegratedTaskPage.tsx)，[自动验证](../tests/integrated-page.test.ts)。

## 配置与迁移边界（沿用）

不把官方配置复制到automation；dataDir变化不搬迁旧数据。恢复继承先改草稿，保存才删除覆盖。两区保存／刷新／失败不清空另区草稿。直接任务时区迁移保留ID、启用和历史；旧模型在启动时暂停，迁移为官方提醒而非承诺模型执行完成。不可等价规则先处理，恢复拒绝覆盖后续修改。

## 交付与限制

版本基于官方Bundle加automation整数修订；Git固定SHA／tag并携带lib/。本次另获用户明确授权更新日常试装；公开推送／发布tag／恢复Web不在范围。根历史旧核心锁保持不变，新组合单列候选。
