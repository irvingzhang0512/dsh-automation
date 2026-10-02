# dsh-automation 当前功能规格

基线日期：2026-10-03；包版本：0.2.2；核对的源码提交：`72096d76103ec03fc0acfa24b651a65ce6f99ad2`。此提交是首次整理前的实现基线，后续文档提交不提高包版本。

本规格可编辑，功能任务先改预期与验收再实现；Bug 按已有预期直接定位源码。流程见 [根文档驱动开发规范](../../docs/DOC-DRIVEN-DEVELOPMENT.md)。原始需求保持只读，技术文档保留现有名称。

依据与技术入口：[../dsh-automation-requirements.md](../dsh-automation-requirements.md)、[architecture.md](architecture.md)、[tools.md](tools.md)。

实现状态与验证状态分别记录。“已实现”表示有当前源码依据，不表示本次已通过运行测试。下面的测试链接是核对过的现有验证入口；2026-10-03 本次只静态核对源码、测试与文档，没有运行产品测试、构建、GUI 或外部服务验证。具体遗漏见条目与末尾待办。

## F001 任务与运行生命周期

- 实现状态：已实现。
- 场景与预期：Task 保存任务配置，Run 记录一次执行；支持创建、更新、删除、启用／暂停任务、手动立即运行、取消运行及查询历史。
- 边界与异常：取消一个 Run 不删除 Task，不取消后续周期；暂停影响新调度，已运行执行需单独取消。
- 验收条件：同一任务可有多个历史 Run；取消一次后下一触发仍可调度；非法任务输入拒绝。
- 实现依据：[../src/core/service.ts](../src/core/service.ts)、[../src/core/run-manager.ts](../src/core/run-manager.ts)、[../src/shared/types.ts](../src/shared/types.ts)。
- 验证记录：2026-10-03 静态核对；已有测试入口：[../tests/service.test.ts](../tests/service.test.ts)（覆盖范围以用例为准，本次未执行）。

## F002 时间触发与多触发器

- 实现状态：已实现。
- 场景与预期：一个任务可配置多个触发器；支持一次、每小时、每日、工作日、每周、每月及五字段 cron，计算下次触发时间。
- 边界与异常：依据宿主本地时间计算；月末不足日按实现截断；非法 cron 拒绝，不宣称支持秒字段或任意时区。
- 验收条件：锚点时间计算得到预期下一次；触发器更新后按新规则调度；非法表达式不入库。
- 实现依据：[../src/shared/time.ts](../src/shared/time.ts)、[../src/core/service.ts](../src/core/service.ts)。
- 验证记录：2026-10-03 静态核对；已有测试入口：[../tests/time.test.ts](../tests/time.test.ts)、[../tests/service.test.ts](../tests/service.test.ts)（覆盖范围以用例为准，本次未执行）。

## F003 队列、并发与失败处理

- 实现状态：已实现。
- 场景与预期：调度入队后按时间执行，支持 skip／queue／parallel 重叠策略、超时、取消和配置重试。
- 边界与异常：执行器按 Run 持有取消信号；宿主服务停止需清理定时器和运行资源，恢复逻辑处理上次遗留运行，不承诺重启后原进程继续。
- 验收条件：各重叠策略符合队列测试；超时／取消有结束状态；失败重试不超过任务上限。
- 实现依据：[../src/core/queue.ts](../src/core/queue.ts)、[../src/core/worker.ts](../src/core/worker.ts)、[../src/core/run-manager.ts](../src/core/run-manager.ts)、[../src/core/service.ts](../src/core/service.ts)。
- 验证记录：2026-10-03 静态核对；已有测试入口：[../tests/queue-worker.test.ts](../tests/queue-worker.test.ts)、[../tests/service.test.ts](../tests/service.test.ts)（覆盖范围以用例为准，本次未执行）。

## F004 命令与脚本执行

- 实现状态：已实现。
- 场景与预期：command 通过子进程执行命令，script 按脚本类型选择解释器，支持工作目录、参数、输出记录与终止。
- 边界与异常：shell 语义由 Action 配置决定；解释器缺失或进程失败报告到 Run；插件不把浏览器作为任务执行器。
- 验收条件：测试命令输出可查询；非零退出码标记失败；取消／超时终止子进程。
- 实现依据：[../src/actions/process.ts](../src/actions/process.ts)。
- 验证记录：2026-10-03 静态核对；已有测试入口：[../tests/process.test.ts](../tests/process.test.ts)（覆盖范围以用例为准，本次未执行）。

## F005 Skill 与提示词执行

- 实现状态：已实现。
- 场景与预期：skill 加载宿主或捆绑技能内容并附加指令；agent_prompt 使用提示词。每次 Run 创建一次性会话，等待空闲并读取输出，最终释放。
- 边界与异常：缺少宿主 agents 服务时报告执行器不可用；Action 中指定 Agent 名的语义见待确认 F009，不能宣称已按该名称选择 Agent。
- 验收条件：加载存在的 Skill 后构成提示词；无运行时服务时返回明确失败；会话结束／取消释放资源。
- 实现依据：[../src/actions/agent.ts](../src/actions/agent.ts)、[../src/index.ts](../src/index.ts)。
- 验证记录：2026-10-03 静态核对；无对应专项自动测试，需补宿主／页面或真实环境验证。

## F006 历史、日志与存储

- 实现状态：已实现。
- 场景与预期：SQLite 保存任务、触发器和运行，日志可查询；使用 WAL、备份和旧目录迁移逻辑。
- 边界与异常：旧目录仅在新库不存在时复制，保留旧资料；持久化历史不代表正在执行的会话能跨宿主重启。
- 验收条件：旧结构迁移可读；任务／触发器关联一致；运行日志与状态可查。
- 实现依据：[../src/storage/sqlite.ts](../src/storage/sqlite.ts)、[../src/core/service.ts](../src/core/service.ts)。
- 验证记录：2026-10-03 静态核对；已有测试入口：[../tests/storage.test.ts](../tests/storage.test.ts)、[../tests/storage-migrate.test.ts](../tests/storage-migrate.test.ts)（覆盖范围以用例为准，本次未执行）。

## F007 页面、工具与信任边界

- 实现状态：已实现。
- 场景与预期：Web 页面管理任务、触发器、立即运行与历史；16 个 automation 工具与 /api/automation、WebSocket 使用同一服务。
- 边界与异常：HTTP 路由按 path 聚合，拒绝不可信跨站写请求；浏览器关闭不拥有调度生命周期，调度仍依赖宿主服务存活。
- 验收条件：页面操作与工具读取一致；16 个工具可注册；API 拒绝不可信调用；真实宿主调度需专项回归。
- 实现依据：[../src/tools/automation-tools.ts](../src/tools/automation-tools.ts)、[../src/server/api.ts](../src/server/api.ts)、[../src/client/AutomationPage.tsx](../src/client/AutomationPage.tsx)、[../src/shared/request-trust.ts](../src/shared/request-trust.ts)。
- 验证记录：2026-10-03 静态核对；已有测试入口：[../tests/api.test.ts](../tests/api.test.ts)、[../tests/request-trust.test.ts](../tests/request-trust.test.ts)（覆盖范围以用例为准，本次未执行）。

## F008 设置与数据目录

- 实现状态：已实现。
- 场景与预期：注册 automation 设置并解析隔离环境数据目录；服务构造时读取默认超时和调度周期，存储构造时读取备份策略。
- 边界与异常：这些实例参数当前初始化后不再读取 configProvider；按现行架构的启动快照契约处理，详见 F010，不能把设置保存成功当作已运行实例生效。
- 验收条件：数据目录解析符合配置测试；初始化使用所选参数；保存设置后重新挂载服务／存储才采用新实例参数。
- 实现依据：[../src/host/config.ts](../src/host/config.ts)、[../src/index.ts](../src/index.ts)、[../src/core/service.ts](../src/core/service.ts)。
- 验证记录：2026-10-03 静态核对；已有测试入口：[../tests/config.test.ts](../tests/config.test.ts)、[../tests/service.test.ts](../tests/service.test.ts)（覆盖范围以用例为准，本次未执行）。

## F009 指定 Agent 名的执行语义

- 实现状态：待确认。
- 场景与差异：界面／类型提供 agent 字段，但当前执行器只使用 prompt 创建一次性会话，没有把 action.agent 传入选择过程。
- 边界与异常：待确认要绑定命名 Agent，还是取消该字段；确认后按功能变更或 Bug 修复处理。
- 验收条件：指定两个不同 Agent 时应有可观察的选择差异；当前不将此项标为已实现。
- 冲突依据：[../src/shared/types.ts](../src/shared/types.ts)、[../src/actions/agent.ts](../src/actions/agent.ts)、[../src/client/AutomationPage.tsx](../src/client/AutomationPage.tsx)。
- 验证记录：2026-10-03 静态差异登记；未修运行代码，不声称已通过此项验收。

## F010 配置生效边界

- 实现状态：已实现。
- 场景与预期：设置保存即时落盘，服务／存储参数在启动时快照；现行架构“已知限制”明确 tickMs 与 defaultTimeoutSeconds 修改需重启，不能承诺正在运行的实例热更新。
- 边界与异常：applies: live 在本插件只保证设置保存，不代表实例重建；数据目录与备份策略同样在存储创建时读取。若未来要求热更新，先按功能变化确定对正在运行和新 Run 的分别影响。
- 验收条件：保存设置不修改已运行实例的超时／调度周期；重新挂载后采用新参数；README 与已确认技术契约一致。
- 实现依据：[../src/index.ts](../src/index.ts)、[../src/core/service.ts](../src/core/service.ts)、[../src/core/run-manager.ts](../src/core/run-manager.ts)；现行契约见 [architecture.md](architecture.md) 的“已知限制”。
- 验证记录：2026-10-03 源码与已有明确技术契约静态核对；尚无设置变化／重挂载专项回归，本次未运行宿主测试。

## 差异与验证待办

- “Web 重启不影响任务”限定为浏览器生命周期；停止承载 Scheduler 的宿主会停止服务。
- README 泛称配置实时生效与架构启动快照契约不一致；以架构中明确的现行决定和实例构造源码澄清 F010。本次没有改变配置应用行为，也没有把它当作已实现热更新。
- agent_prompt／Skill 的真实宿主调用与所有调度模式的长期运行本次未验证。

## 规格变更记录

- 2026-10-03：首次从现行文档、实现和现有测试建立功能基线；仅修改维护文档，未变更 API、存储或运行逻辑。
