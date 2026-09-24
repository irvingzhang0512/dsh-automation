# dsh-automation

DSH（DeepSeek Harness）定时任务插件：统一管理“按时间自动执行”的任务。

> 完整需求规格见 [dsh-automation-requirements.md](./dsh-automation-requirements.md)。

## 快速开始

安装后，在 DSH Web 左侧「新会话」下方会出现 **「定时任务」** 入口。创建第一个定时任务有两种方式：

**① 表单创建**：进入「定时任务」页面 → 「任务」Tab → 点右上「+ 新建任务」→ 填名称、执行动作（Skill / Agent / 命令 / 脚本）、执行时间（如每天 09:00）→ 保存。

**② 自然语言创建**：直接对助手说，例如——

> 每天晚上 8 点运行项目日报 Skill。
> 每周五下午五点生成周报。

助手会自动调用 `automation.create_task` 等工具帮你创建。

任务创建后，可在「待运行」Tab 查看下一次执行时间、「运行中」查看实时执行、「历史」查看结果与日志。

**数据存在哪**：`~/.dsh/data/automation/`（SQLite + 日志 + 备份，见下「数据目录」）。
**配置在哪改**：DSH 设置页 → 「定时任务」设置卡（见下「配置」）。

## 功能

- **任务生命周期**：创建 / 查看 / 修改 / 删除 / 启用 / 暂停 / 立即运行定时任务；
- **多 Trigger**：一个 Task 可挂多个触发规则（Once / Hourly / Daily / Weekday / Weekly / Monthly / Cron），
  可单独增删其中一个 Trigger；
- **四类 Action**：Skill、Agent Prompt、Command、Script；
- **运行控制**：待运行（Upcoming）、运行中（Running）、历史（History）三个视图，
  支持取消某一次 Run、失败重试、超时；
- **并发策略**：skip（默认）/ queue / parallel；
- **后台调度**：Trigger Engine + Task Queue + Worker + Run Manager + Retry Manager，
  与 `dsh web` 生命周期解耦，Web 重启不影响后台调度与长期任务；
- **SQLite 持久化**：Node 内置 `node:sqlite`，数据目录遵循 DSH 统一规范 `~/.dsh/data/automation/`；
- **配置项**：数据目录、默认超时、调度轮询间隔、备份保留份数，可在 DSH 设置页修改，实时生效；
- **16 个 automation 工具**：供 LLM / Skill 通过工具统一管理任务；
- **automation Skill**：教 LLM 解析自然语言请求并调用工具；
- **Web 主页面**：左上“定时任务”入口（与“新会话”“日程”同款卡片样式）+ `/automation` 页面（任务 / 待运行 / 运行中 / 历史 四 Tab + 新建任务 Drawer + 任务详情）。

## 安装

```bash
dsh plugin --profile <name> add dsh-automation@<version>
```

## 开发

```bash
npm install
npm run typecheck
npm test
npm run build
```

## 数据目录

遵循 DSH 统一数据目录规范（需求 §23）：`$DSH_DATA_DIR` → `~/.dsh/data/automation/`（`$DSH_HOME` 可覆盖）。
第一版使用的 `~/.dsh/automation/` 会在首次启动时自动迁移到新路径（旧目录保留，不自动删除）。

```
~/.dsh/data/automation/
│
├── automation.db   # SQLite（tasks / triggers / runs / run_logs；WAL 模式）
├── logs/           # 运行日志（run_xxx.log）
├── backup/         # SQLite 备份（automation.<时间戳>.db，保留 keepBackups 份）
└── runtime/        # 运行期文件
```

## 配置

配置项在 DSH 设置页「定时任务」设置卡中修改（保存到 `~/.dsh/settings.yaml`，实时生效）：

| 字段 | 说明 | 默认 |
|---|---|---|
| `dataDir` | 数据目录覆盖；留空按 DSH 规范自动解析 | 空 |
| `defaultTimeoutSeconds` | 任务未单独配置超时时的默认值 | 1800 |
| `tickMs` | 调度轮询间隔（毫秒）；修改后需重启 DSH 生效 | 1000 |
| `keepBackups` | SQLite 备份保留份数（0 关闭备份） | 10 |

## 文档

- [需求规格说明书](./dsh-automation-requirements.md)
- [架构与设计](docs/architecture.md)
- [工具清单](docs/tools.md)
- [Skill 说明](docs/skill.md)

## License

MIT
