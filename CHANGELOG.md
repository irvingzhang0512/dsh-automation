# Changelog

## 2026-10-03 补齐需求文档确认（不变更包版本）

- 功能任务先改规格与相关技术契约，用户明确确认该版文档后再开发；未确认不改对应源码／测试实现或运行配置，已确认同一版不重复询问。
- 新增语义差异重新确认；预期不变的 Bug 可直接修复。本次只修改维护文档。

## 2026-10-03 文档基线（不变更包版本）

- 新增 [当前功能规格](docs/SPEC.md)，建立功能与 Bug 两条开发入口，记录实现依据、现有验证入口和待办。
- 本次只修改维护文档，不变更公开 API、数据格式或运行逻辑；静态核对不代替产品测试及 GUI 兼容验证。


## 0.2.2

- **修复信任围栏**：REST API 与 WebSocket 桥的围栏改为与宿主 /api 网关一致的语义
  （新增 `src/shared/request-trust.ts`，移植范式插件 dsh-structured-document-view）：
  Host 必须为回环或匹配 `trustedHosts`；`sec-fetch-site: cross-site` 拒绝；带 `Origin`
  时须与 Host 同主机。旧实现只做 `trustedHosts.includes(origin)`，默认 loopback 部署下
  `trustedHosts` 为空，浏览器所有带 Origin 的 POST（立即运行 / 新建 / 编辑 / 删除）全部
  403「来源不被信任」。host 侧改动，需重启 DSH 生效。

## 0.2.1

- **改名**：用户可见入口与页面标题「自动任务」→「定时任务」（侧边栏入口、页面标题、SKILL 描述、README 同步；内部标识 `automation` / `dsh-automation` 不变）。
- **创建引导**：主页面「任务」Tab 空态说明两种创建方式（表单 / 自然语言），新建 Drawer 标题改为「新建定时任务」。
- **数据目录可见**：主页面头部状态条显示当前数据目录（`/api/automation/status` 新增 `homeDir`）。
- **文档补齐**：新增 `docs/architecture.md` / `docs/tools.md` / `docs/skill.md`（README 链接不再悬空）；README 增加「快速开始」。

## 0.2.0

- **配置项**：接入 DSH 设置系统（`ctx.settings` + schemastery schema），设置页出现「自动任务」设置卡；
  支持 `dataDir` / `defaultTimeoutSeconds` / `tickMs` / `keepBackups`，实时生效（tickMs 修改后需重启）。
- **持久化规范**：数据目录迁移到 DSH 统一规范 `~/.dsh/data/automation/`（`$DSH_DATA_DIR` → `$DSH_HOME/data/automation`）；
  首次启动自动迁移旧 `~/.dsh/automation/` 数据（幂等，旧目录保留）。
- **SQLite 备份**：启动时 + 周期性一致性备份（wal_checkpoint 后复制到 `backup/`），保留 `keepBackups` 份。
- **侧边栏入口对齐**：「自动任务」条目卡片化对齐「新会话」「日程」（纯 SVG 图标、宽栏卡片、
  折叠 rail 态还原、激活品牌色内描边），样式全部取自 DSH 主题变量。

## 0.1.0

- 初始化 dsh-automation 插件项目：
  - 核心对象模型（Task / Trigger / Run）
  - 后台调度服务骨架（Trigger Engine / Queue / Worker / Run Manager / Retry）
  - SQLite 存储（node:sqlite）
  - 16 个 automation 工具
  - automation skill
  - Web 客户端（自动任务入口 + /automation 主页面）
  - 需求规格文档 dsh-automation-requirements.md
