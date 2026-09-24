# Changelog

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
