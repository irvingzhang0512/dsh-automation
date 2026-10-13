# dsh-automation 当前功能规格

批准版：official-automation-20261014-v1；用户于2026-10-14明确要求实施完整方案。当前包版本0.2.0-rc.2+automation.1。原始需求[只读保留](../dsh-automation-requirements.md)；旧升级提案[作为历史](DSH-UPGRADE-20261011.md)。行为与验收细节见[实施契约](IMPLEMENTATION-20261014.md)，配置技术映射见[配置表](CONFIG-UI.md)。

功能变化先修改规格与验收／相关技术契约，用户明确确认该版后开发；已确认同版不重复询问，预期不变的Bug直接修复。维护流程见[根文档规范](../../docs/DOC-DRIVEN-DEVELOPMENT.md)。

## 当前实现状态

以下条目已实现；“已实现”与“已验证”分开记录。自动测试、真实宿主、原生界面、固定Git安装的执行范围与限制分别见[本版验收](VERIFICATION-0.2.0-rc.2+automation.1.md)，不把历史证据冒充新版本验证。

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

- 预期与验收：16工具及/api/automation保留，原生同源围栏，直接页四Tab。
- 实现状态：已实现；[源码](../src/server/api.ts)。
- 自动验证入口：[用例](../tests/api.test.ts)；实际执行结果见本版验收。

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

- 预期与验收：官方详情两个分区、独立草稿／保存／错误／重置，无保存全部和重复侧栏。
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

## 配置与迁移边界

不把官方配置复制到automation；dataDir变化不搬迁旧数据。恢复继承先改草稿，保存才删除覆盖。两区保存／刷新／失败不清空另区草稿。直接任务时区迁移保留ID、启用和历史；旧模型在启动时暂停，迁移为官方提醒而非承诺模型执行完成。不可等价规则先处理，恢复拒绝覆盖后续修改。

## 交付与限制

版本基于官方Bundle加automation整数修订；Git固定SHA／tag并携带lib/。隔离验证不授权替换日常、推送、发布tag或恢复Web；根历史旧核心锁保持不变，新组合单列候选。
