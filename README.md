# dsh-automation

基于官方 Schedule Bundle 的直接执行增强，当前版本 **0.2.0-rc.2+automation.1**。功能规格见 [SPEC](docs/SPEC.md)，已确认方案见 [实施契约](docs/IMPLEMENTATION-20261014.md)，验证见 [本版验收](docs/VERIFICATION-0.2.0-rc.2+automation.1.md)。[原始需求](dsh-automation-requirements.md)保留为历史来源。

## 使用

会话中的提示词／Skill任务使用官方自动化工具和官方任务页面，在原会话投递。命令／脚本从「插件管理 → 官方 → 自动化任务 → 详情／配置 → 直接执行任务」进入；不新增侧栏入口。

直接执行支持 .py、.sh、.ps1、.js、.mjs、命令参数、解释器、工作目录和环境变量；不创建Session、不调用模型。参数每行一个，保留空格；环境变量每行NAME=值。解释器需已安装并可用，可指定完整路径。Windows的.sh脚本优先使用可找到的Git Bash；PowerShell默认pwsh。

支持一次、每小时、每日、指定星期、每周、每月、Cron与多触发器。每个触发器保存IANA时区；每月不足日期截断至月末。重叠可跳过、排队或并行；支持超时、失败重试、立即运行、取消本次、历史、输出和退出码。取消一次不影响后续计划。

宿主关闭时不调度；重启不补跑错过的周期，一次性过期标记已错过。尚未开始的持久队列恢复；中断运行标记结果未知且不自动重跑。

## 配置与迁移

同页「官方配置」「Automation 配置」两分区分别保存；官方内部时间感知与任务调度也是两个独立保存所有者。字段说明、默认、范围和生效时间见 [配置映射](docs/CONFIG-UI.md)。恢复继承只改草稿，保存才删除用户覆盖；冲突与失败保留草稿。运行中拒绝会重载直接服务的保存；更换数据目录不搬迁或覆盖旧数据。

数据默认位于DSH数据目录下automation/，使用SQLite。迁移先预览、选择原会话／核对规则，再应用；强制备份数据库和配置。直接任务保留ID与历史；旧模型任务停用旧路径，迁移为官方提醒。不可等价Cron或月末模型规则列为待处理；后续写入、已投递提醒等恢复冲突拒绝覆盖。

16个automation.*工具及/api/automation保留，只管理直接任务与旧记录；新建模型任务明确引导官方工具。见 [工具](docs/tools.md)与 [Skill](skills/automation/SKILL.md)。

## 安装与版本

本版精确要求Desktop、官方Schedule Bundle及三个成员均为0.2.0-rc.2；实际挂载来源不匹配时拒绝执行和迁移。自研修订比较automation.N，不能用忽略build metadata的通用SemVer判断升级。

Git安装固定完整提交或发布tag，提交携带lib/构建产物。仓库为 https://github.com/irvingzhang0512/dsh-automation ，本版尚未公开推送／发布tag；当前公开地址不能当作已可安装的本版。隔离本地固定Git安装验收与公开渠道验证分开记录。

## 开发

从维护仓库根目录进入，遵循根及本仓库AGENTS。

```sh
npm install
npm run typecheck
npm test
npm run build
```

lib/提交，node_modules/不提交；客户端从宿主模块表加载React与原生控件。先构建再运行客户端产物冒烟；真实格式测试需Python、Bash、PowerShell、Node。开发仅使用隔离Desktop，不自动替换日常或恢复Web。
