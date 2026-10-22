# AGENTS.md

2026-10-17已确认宿主升级契约与配置归属的历史来源见[本次升级](docs/DSH-UPGRADE-20261017.md)；当前规则已迁入[OpenSpec索引](openspec/MIGRATION.md)，原功能语义保持。

## 开发入口与文档分工

先返回根维护目录，读取 [根 AGENTS](../AGENTS.md)、[维护规范](../docs/MAINTENANCE.md) 和开发 Skill；本仓库的特殊约束仍适用。统一流程见 [文档驱动开发](../docs/DOC-DRIVEN-DEVELOPMENT.md)，当前行为与待定需求按 [OpenSpec迁移索引](openspec/MIGRATION.md) 定位：主规格为 openspec/specs，新增/升级方案为 openspec/changes。统一约定见 [根OpenSpec说明](../docs/OPENSPEC.md)。

- 功能新增／修改：按迁移索引读取所属能力，在OpenSpec change中维护proposal、增量specs、design、tasks及review；先明确预期、验收及接口／配置／存储契约，用户确认该版文档后再改源码并验证。自然语言需求也先落入变更；已实现且验证后的行为才同步主规格并归档。
- 文档确认：将修改后的规格／相关技术契约的链接、功能编号、行为差异与验收条件交用户审阅，等待明确确认该版文档后才能改对应源码／测试实现或运行配置；确认前可读源码、查日志／已有测试、完善文档。用户已明确要求按同一版文档实现且含义未再改变时直接继续，不重复询问；仅提出需求、保存／提交文档或沉默不算确认。确认后新增语义差异先重新确认，记录确认范围与文档依据。
- Bug：按已有预期复现并直接查看源码、日志和测试，修复回归；预期未变无需改规格，遗漏／歧义补规格，产品规则变化部分按功能流程。不得改规格把 Bug 解释为正确行为。
- 原始需求、旧docs/SPEC.md与历史方案／证据保持只读，旧F编号只由迁移索引映射，不再双写。OpenSpec是唯一活动产品规格；README是入口，架构／配置／接口／使用文档本轮字节不改，后续已确认实现仍同步实际技术说明，不成为第二份产品真源。实现与验证分开记录，冲突保留证据并标待确认。
- OpenSpec artifacts ready、validate通过及任务勾选均不等于用户批准、功能实现或运行验证。原待确认需求仍在changes，不当作当前可用命令。配置变化继续覆盖旧持久值、失效字段、完整引用、备份、CAS和回滚；个人项目资料不因需求整理而改写。
- 纯文档任务检查OpenSpec严格结构、旧编号映射、文档分类、状态、链接与源码／测试引用，记录未执行的验证；无需运行下面的代码测试／构建或重装。代码改动仍遵循本仓库验证要求。
- 纯文档变更不提高包版本，独立中文 Angular docs 提交，保持当前实际分支；根仓库同步完整提交锁。安装快照由脚本检查，未变保留，不自动推送。


本文件是 **dsh-automation** 项目的智能体协作约定（Agent 工作指引），
面向在此仓库中开发、评审、维护代码的 AI Agent 与人类协作者。

## 项目概览

历史版本0.2.1-rc.2+automation.1的来源为 [同页任务契约](docs/INTEGRATED-TASK-PAGE-20261014.md)、[实施契约](docs/IMPLEMENTATION-20261014.md) 与 [冻结SPEC](docs/SPEC.md)；其后F018统一为+rev.N，当前功能、契约及验收场景按 [OpenSpec迁移索引](openspec/MIGRATION.md) 定位。

- 官方Schedule负责原会话提示词／Skill；自研仅直接命令／五种脚本，无Session／模型执行器。
- 官方Bundle详情双分区配置，time-context／schedule／automation三个保存所有者；不注册重复侧栏。
- 官方侧栏schedules同页会话／直接任务；公开优先级复用官方Component／inject／locale，卸载恢复。新建意图消费后清除，草稿与保存中有切换保护；不修改官方DOM。
- SQLite、持久队列、超时／取消／重试、skip／queue／parallel、明确时区与迁移恢复。
- 16工具使用automation_前缀，旧点号名称退役；API保留。每版精确Bundle基线＋automation整数修订，禁止通用SemVer忽略build修订。
- Git提交携带lib/完整运行产物；测试仅隔离Desktop，默认禁用副本任务。

## 仓库与分支

- 仓库：`https://github.com/irvingzhang0512/dsh-automation.git`（本版未推送）
- 默认分支：`main`

## 目录结构

```
src/
  index.ts         宿主入口：服务注册、工具注册、skill 注册、API 挂载
  context-types.ts 宿主 Context 类型
  shared/          共享类型与纯函数（Task/Trigger/Run、时间计算、wire 协议）
  core/            Trigger Engine、Queue、Worker、Run Manager、Retry、Service
  storage/         SQLite 存储实现
  actions/         Command / Script直接执行器
  tools/           automation_* 工具实现
  server/          /api/automation 路由
  client/          Desktop客户端（官方详情配置、直接任务页面）
skills/            automation 中文 Skill（SKILL.md）
docs/              架构与设计文档
tests/             Vitest 测试
```

## 常用命令

```bash
npm run typecheck   # 类型检查
npm test            # Vitest 单元测试
npm run build       # 构建 lib/ 产物（tsc + tsdown 客户端 bundle）
```

约定：`lib/`提交运行产物；`node_modules/`不提交。

## Git 提交规范（Conventional Commits）

所有提交遵循 [Angular 提交规范](https://github.com/angular/angular/blob/main/CONTRIBUTING.md#commit)。

```
<type>(<scope>): <subject>
```

- `type` 与 `subject` 必填，`scope` 与 `body` 可选；
- `subject` 用祈使句、小写开头、不超过 72 字符、结尾不加句号。

| type      | 用途                                      |
|-----------|-------------------------------------------|
| `feat`    | 新功能                                    |
| `fix`     | 缺陷修复                                  |
| `docs`    | 仅文档变更                                |
| `refactor`| 重构                                      |
| `test`    | 新增或修改测试                            |
| `build`   | 构建系统或依赖变更                        |
| `chore`   | 杂项（初始化、工具、配置等）              |

示例：

```
feat(core): 实现 Trigger Engine 与每日触发计算

chore: 初始化 git 仓库并提交首个版本
```

其他约定：代码提交前运行 `npm run typecheck` 与 `npm test` 确认通过；一次提交只做一件事。

## 设计约束

- Scheduler 只负责“什么时候运行 / 运行什么 / 运行到什么状态 / 是否成功 / 历史”，
  具体业务（Skill / Agent / Command / Script / Tool / Plugin Action）由 DSH 已有能力完成；
- 禁止由浏览器页面或 `dsh web` 进程直接承载定时任务生命周期；
- LLM / Skill 不得直接修改任务存储文件，所有操作统一通过 `automation_*` 工具；
- Task 与 Run 严格区分：取消某一次 Run 不等于删除整个 Task；
- “取消本次运行”不能影响后续周期性任务。
