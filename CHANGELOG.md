# 0.2.1-rc.2+automation.1 — 2026-10-17

## 0.2.1-rc.3+rev.1（2026-10-25）

- 精确宿主与 Schedule／time-context／web-app 门禁改为 rc3；缺包、重复来源和错误基线仍拒绝执行，保留原任务、时区和配置所有者。
- 目标 SDK 下代码检查通过（155 项测试）；完整资源随固定提交提供，原生／日常／试用证据另行登记，见 [升级记录](docs/DSH-RC3-20261025.md)。

## 0.2.1-rc.2+rev.1（2026-10-18）

- 按已确认方案统一中英文显示名称、简介、完整修订版本及分发元信息；办公成员支持套件接管，保留原运行身份和业务数据。
- 当前实现及验证状态见 docs/SPEC.md 与本版独立验收记录；未公开发布。

- 旧实验 Schedule Bundle 已退役，来源改查 dsh-web-app 和 schedule／time-context／client-ui-schedule 的真实版本。详情附着自研插件；时间上下文由三个官方预设持有。两字段经官方 configEditor 分别保存，保留其他插件和未知字段；各预设值不一致时只读，冲突拒绝，部分失败尝试安全恢复。任务存储、16 工具与执行语义保持。
- 类型／构建及155项测试通过，实际范围见[升级验收](docs/DSH-UPGRADE-20261017.md)。

# Changelog

## 0.2.0-rc.2+automation.3（2026-10-14）

- 修复OpenCode Go DeepSeek V4.1拒绝点号工具名的400：16个工具统一使用automation_前缀，保留原操作、参数和结果信封；旧点号名称退役，不注册别名。
- 同步工具契约、捆绑Skill和名称引用；任务／触发器／运行数据、HTTP API、原会话日志保持，不增加数据库迁移。
- 新增真实ToolRuntime注册、全部16项操作、错误信封及卸载回归；本版验证与隔离交付边界见[验收](docs/VERIFICATION-0.2.0-rc.2+automation.3.md)，日常安装另行安排。

## 0.2.0-rc.2+automation.2（2026-10-14）

- 侧栏“自动化任务”同页切换会话／直接任务，顶部新建直接任务与常驻区别说明；旧详情入口进入同页。
- 通过公开页面优先级复用官方组件、目录与回调，卸载恢复官方页面；不修改官方包或增加侧栏。
- 类型切换保留搜索／详情与直接标签状态；草稿取消／放弃提示、保存中保护；一次性新建请求不在重新进入页面时重放。
- API、16工具、8配置与持久层不变，沿用0.2.0-rc.2官方基线，无业务迁移。验收与日常安装事实分别记录。

## 0.2.0-rc.2+automation.1（2026-10-14）

- 官方Schedule承载原会话任务；直接命令／五种脚本独立执行，无Session或模型调用。
- 官方Bundle详情提供官方／Automation双分区，三个独立保存所有者、八字段中文帮助、草稿隔离、继承重置与冲突保护。
- 增加明确时区、修复命令参数和真正并行；重启不补周期、恢复pending、中断结果未知、过期once记录已错过。
- 旧模型暂停并预览迁移；强制备份、规则审查、原会话选择／映射、失败补偿与恢复冲突保护。
- 精确绑定官方基线，自研修订独立比较；Git携带完整lib产物。验收与日常／公开渠道边界见[记录](docs/VERIFICATION-0.2.0-rc.2+automation.1.md)。

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
