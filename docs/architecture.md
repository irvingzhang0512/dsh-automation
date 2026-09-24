# dsh-automation 架构与设计

> 定时任务插件（用户入口名「定时任务」，内部标识 `dsh-automation` / `automation`）。
> 本文档与当前实现逐字一致；若与代码有出入，以代码为准并修正本文档。

## 1. 定位与原则

- **Scheduler 只负责调度，不实现业务**：具体业务（Skill / Agent / Command / Script）由 DSH 已有能力完成。
- **与 `dsh web` 生命周期解耦**：调度服务由宿主进程承载，Web 重启不影响后台调度、运行中任务与历史。
- **LLM / Skill 不得直改存储**：所有任务操作统一经 16 个 `automation.*` 工具。

## 2. 整体分层

```
client（浏览器 UI）──/api/automation REST──┐
Agent 工具（tools/automation-tools.ts）────┤→ AutomationService（core/）→ AutomationStore（storage/）→ SQLite
automation skill（NL→工具映射，不碰文件）──┘
```

- 所有入口（UI / 工具 / skill）共用同一个 `AutomationService` 业务层。
- `src/shared/`（领域类型 + 纯时间函数）零运行时依赖、只含 JSON 可序列化结构。

## 3. 目录结构

```
src/
  index.ts          宿主入口：settings 接入、服务启动、工具/API/WS/skill 挂载
  context-types.ts  宿主 Context 类型（vendored 结构镜像）
  host/
    config.ts       schemastery 配置 schema（dataDir/defaultTimeoutSeconds/tickMs/keepBackups）
    skill-registration.ts  SKILL.md frontmatter 解析与打包注册
  shared/           Task/Trigger/Run 类型、时间计算、AutomationStore 接口
  core/
    service.ts      AutomationService（调度 tick、并发、重试、运行控制、CRUD）
    queue.ts        TaskQueue（pending 队列，按 scheduled_at 排序）
    worker.ts       AutomationWorker（执行器抽象）
    run-manager.ts  RunManager（运行中超时/取消）
  storage/
    sqlite.ts       SqliteAutomationStore（node:sqlite + 迁移 + 备份）
  actions/
    process.ts      Command / Script 执行器（child_process）
    agent.ts        Skill / Agent Prompt 执行器（dsh-agent runtime）
  tools/
    automation-tools.ts  16 个 automation.* 工具
  server/
    api.ts          /api/automation REST 路由
  client/
    index.ts        客户端入口（slots 注册、SVG 图标）
    AutomationPage.tsx  主面板（四 Tab + Drawer + 详情）
    style.ts        注入样式（DSH 主题变量 + 侧栏卡片化覆盖）
    api.ts          浏览器 fetch 客户端
skills/automation/SKILL.md   自动化中文 Skill
```

## 4. 核心对象模型（需求 §4）

- **Task（任务）**：要做什么（名称、Action、并发策略、重试、超时）。
- **Trigger（执行时间）**：什么时候运行；一个 Task 可挂多个 Trigger，可单独增删。
  类型：`once` / `hourly` / `daily` / `weekday` / `weekly` / `monthly` / `cron`（5 字段）。
- **Run（运行）**：一次实际执行；状态机 `pending → running → success / failed / cancelled / timeout`（另有 `skipped`）。
  取消一次 Run ≠ 删除 Task。

## 5. 调度与执行（需求 §17/§19/§20/§21）

- **tick**：每 `tickMs`（默认 1000ms）触发到期 Trigger 创建 Run 入队，再串行消费队列。
- **并发策略**：`skip`（默认，同任务运行中则本次 skipped）/ `queue`（排队）/ `parallel`（并行）。
- **超时**：任务 `timeout_seconds` 或系统默认（`defaultTimeoutSeconds`，默认 1800s）。
- **失败重试**：任务 `retry` 配置（`enabled` / `max_attempts` / `delay_seconds`），延迟后重新入队。
- **执行器**：`command`/`script` 内置 child_process；`skill`/`agent_prompt` 依赖宿主 dsh-agent runtime（缺失时报结构化错误，不影响其他类型）。

## 6. 持久化（需求 §22/§23）

- **存储**：`node:sqlite`（`DatabaseSync`，Node ≥22.5），WAL 模式 + `synchronous=NORMAL`。
- **数据目录**（遵循 DSH 统一规范）：

  ```
  $DSH_DATA_DIR/automation/    （环境变量优先）
  $DSH_HOME/data/automation/   （默认 ~/.dsh/data/automation/）
  ```

  ```
  automation.db     # tasks / triggers / runs / run_logs
  logs/             # 运行日志（run_xxx.log 文本副本）
  backup/           # SQLite 备份（automation.<ts>.db，保留 keepBackups 份）
  ```

- **旧路径迁移**：第一版用 `~/.dsh/automation/`；首次启动检测旧路径存在则一次性复制到新路径（幂等，不删除旧目录）。
- **备份**：启动时 + `backupNow()` 一致性备份（`wal_checkpoint(TRUNCATE)` 后复制），`keepBackups` 份轮转（默认 10，0 关闭）。

## 7. 配置（需求 §配置）

经 DSH 设置系统注册（`ctx.settings.register('dsh-automation', schema, { applies: 'live' })`），设置页自动渲染「定时任务」设置卡，保存到 `<DSH_HOME>/settings.yaml`。

| 字段 | 说明 | 默认 |
|---|---|---|
| `dataDir` | 数据目录覆盖；留空按 DSH 规范解析 | 空 |
| `defaultTimeoutSeconds` | 任务默认超时秒数 | 1800 |
| `tickMs` | 调度轮询间隔（ms）；修改后需重启生效 | 1000 |
| `keepBackups` | SQLite 备份保留份数 | 10 |

settings 服务缺失时回退 `DEFAULT_CONFIG`（插件照常工作）。

## 8. HTTP API（server/api.ts）

统一前缀 `/api/automation`，响应信封 `{ ok, code, message, ... }`。
**路由按 path 聚合注册**（宿主 exact 路由按 path 唯一，不区分 method；未声明 method 返回 405 + Allow）。

| 方法 | 路径 | 说明 |
|---|---|---|
| GET / POST | `/api/automation/tasks` | 列出 / 创建任务 |
| GET / PATCH / DELETE | `/api/automation/tasks/:id` | 详情 / 更新 / 删除 |
| POST | `/api/automation/tasks/:id/run` | 立即运行 |
| GET | `/api/automation/triggers` | 列出全部执行时间 |
| POST | `/api/automation/tasks/:id/triggers` | 添加执行时间 |
| PATCH / DELETE | `/api/automation/triggers/:id` | 更新 / 删除执行时间 |
| GET | `/api/automation/upcoming` | 待运行 |
| GET | `/api/automation/running` | 运行中 |
| GET | `/api/automation/history` | 历史（支持 taskId/status/limit 筛选） |
| GET | `/api/automation/runs` | 运行列表 |
| GET | `/api/automation/runs/:id` | 运行详情（含日志） |
| POST | `/api/automation/runs/:id/cancel` | 取消运行 |
| GET | `/api/automation/status` | 服务状态（含数据目录 homeDir） |

信任栅栏：非 loopback / 非同源请求拒绝（403）。

## 9. Web 客户端（需求 §3）

- **入口**：左侧「新会话」下方「定时任务」卡片条目（`sidebar.panellist`，id=`automation`），点击进入主面板（`main` keyed slot，key=`automation`）。
- **主面板**：四 Tab「任务 / 待运行 / 运行中 / 历史」+ 新建/编辑 Drawer + 任务详情 + Run 详情。
- **样式**：`style.ts` 注入单个 `<style>`，颜色取 DSH 主题变量（`--dsw-alias-*` 带兜底）；侧栏条目卡片化对齐「新会话」，含折叠 rail 态与激活态。
- **数据**：经 `/api/automation` REST 获取；`/automation/ws` 状态心跳（可选增强）。

## 10. 工具（tools/automation-tools.ts）

16 个 `automation.*` 工具（详见 `docs/tools.md`），统一信封 + 文本投影。

## 11. Skill（skills/automation/SKILL.md）

中文 Skill：教 LLM 解析自然语言 → 调用工具（详见 `docs/skill.md`）；随包自注册（frontmatter 解析，缺失优雅降级）。

## 12. 已知简化（V1 边界）

- `tickMs` / `defaultTimeoutSeconds` 变更在服务启动时快照，运行时修改需重启生效（`applies: live` 仅保证设置即时落盘与下次启动生效）。
- `command` 无 shell 时按空白分词；`script` 仅支持 `.py` / `.sh`。
- 旧数据目录迁移只复制不删除（保留回退）。
