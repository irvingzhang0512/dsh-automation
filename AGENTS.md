# AGENTS.md

## 开发入口与文档分工

先返回根维护目录，读取 [根 AGENTS](../AGENTS.md)、[维护规范](../docs/MAINTENANCE.md) 和开发 Skill；本仓库的特殊约束仍适用。统一流程见 [文档驱动开发](../docs/DOC-DRIVEN-DEVELOPMENT.md)，当前可编辑规格见 [docs/SPEC.md](docs/SPEC.md)。

- 功能新增／修改：读取规格及其差异，先改预期和验收条件，涉及接口／配置／存储时先同步技术契约；用户确认该版文档后再改源码并验证。自然语言需求也先落入规格。
- 文档确认：将修改后的规格／相关技术契约的链接、功能编号、行为差异与验收条件交用户审阅，等待明确确认该版文档后才能改对应源码／测试实现或运行配置；确认前可读源码、查日志／已有测试、完善文档。用户已明确要求按同一版文档实现且含义未再改变时直接继续，不重复询问；仅提出需求、保存／提交文档或沉默不算确认。确认后新增语义差异先重新确认，记录确认范围与文档依据。
- Bug：按已有预期复现并直接查看源码、日志和测试，修复回归；预期未变无需改规格，遗漏／歧义补规格，产品规则变化部分按功能流程。不得改规格把 Bug 解释为正确行为。
- 原始需求保持只读历史来源；实现状态和验证结果分开记录，冲突保留证据并标待确认。README 是入口，架构／配置／接口文档维护技术契约。
- 纯文档任务检查编号、状态、链接与源码／测试引用，记录未执行的验证；无需运行下面的代码测试／构建或重装。代码改动仍遵循本仓库验证要求。
- 纯文档变更不提高包版本，独立中文 Angular docs 提交，保持当前实际分支；根仓库同步完整提交锁。安装快照由脚本检查，未变保留，不自动推送。


本文件是 **dsh-automation** 项目的智能体协作约定（Agent 工作指引），
面向在此仓库中开发、评审、维护代码的 AI Agent 与人类协作者。

## 项目概览

DSH（DeepSeek Harness）定时自动任务插件。按需求规格
`dsh-automation-requirements.md`（第一版 MVP）实现：

- **核心对象模型**：Task（做什么）、Trigger（何时运行，一个 Task 可多个）、Run（一次实际执行）；
- **后台调度服务**：Trigger Engine / Task Queue / Worker / Run Manager / Retry Manager / Storage，
  与 `dsh web` 生命周期解耦，Web 重启不得中断已计划任务、正在运行的长期任务与任务历史；
- **Action 四类**：Skill / Agent Prompt / Command / Script；
- **并发策略**：skip（默认）/ queue / parallel；
- **失败重试** 与 **超时**；
- **存储**：SQLite（Node 内置 `node:sqlite`，无需原生依赖），数据目录 `~/.dsh/automation/`；
- **Tool**：16 个 `automation.*` 工具，供 LLM / Skill 统一通过工具管理任务，禁止直改存储；
- **Skill**：自动化中文 Skill（教 LLM 解析自然语言请求并调用 automation 工具）；
- **Web**：左上“新会话”下方“自动任务”入口 + `/automation` 主页面（任务 / 待运行 / 运行中 / 历史 四 Tab + 新建任务 Drawer + 任务详情）。

## 仓库与分支

- 仓库：`https://github.com/irvingzhang0512/dsh-automation.git`（远程待推送后补充）
- 默认分支：`main`

## 目录结构

```
src/
  index.ts         宿主入口：服务注册、工具注册、skill 注册、API 挂载
  context-types.ts 宿主 Context 类型
  shared/          共享类型与纯函数（Task/Trigger/Run、时间计算、wire 协议）
  core/            Trigger Engine、Queue、Worker、Run Manager、Retry、Service
  storage/         SQLite 存储实现
  actions/         Skill / Agent Prompt / Command / Script 四类执行器
  tools/           automation.* 工具实现
  server/          /api/automation 路由
  client/          Web 客户端（页面、四 Tab、Drawer、详情）
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

约定：`lib/`、`node_modules/` 不提交。

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
- LLM / Skill 不得直接修改任务存储文件，所有操作统一通过 `automation.*` 工具；
- Task 与 Run 严格区分：取消某一次 Run 不等于删除整个 Task；
- “取消本次运行”不能影响后续周期性任务。
