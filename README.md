# dsh-automation

DSH（DeepSeek Harness）定时自动任务插件：统一管理“按时间自动执行”的任务。

> 完整需求规格见 [dsh-automation-requirements.md](./dsh-automation-requirements.md)。

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
- **SQLite 持久化**：Node 内置 `node:sqlite`，数据目录 `~/.dsh/automation/`；
- **16 个 automation 工具**：供 LLM / Skill 通过工具统一管理任务；
- **automation Skill**：教 LLM 解析自然语言请求并调用工具；
- **Web 主页面**：左上“自动任务”入口 + `/automation` 页面（任务 / 待运行 / 运行中 / 历史 四 Tab + 新建任务 Drawer + 任务详情）。

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

```
~/.dsh/automation/
│
├── automation.db   # SQLite（tasks / triggers / runs / run_logs）
├── logs/           # 运行日志（run_xxx.log）
└── runtime/        # 运行期文件
```

## 文档

- [需求规格说明书](./dsh-automation-requirements.md)
- [架构与设计](docs/architecture.md)
- [工具清单](docs/tools.md)
- [Skill 说明](docs/skill.md)

## License

MIT
