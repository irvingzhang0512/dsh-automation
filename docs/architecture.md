# dsh-automation 当前技术契约

2026-10-17宿主升级契约与配置归属以[本次升级](DSH-UPGRADE-20261017.md)为准；原功能语义保持。

批准版 official-automation-20261014-v1 与 automation-integrated-page-20261014-v2，当前实现0.2.1-rc.2+automation.1。行为与验收以 [同页任务契约](INTEGRATED-TASK-PAGE-20261014.md)、[实施契约](IMPLEMENTATION-20261014.md)及 [规格](SPEC.md)为准。历史升级提案见 [旧升级文档](DSH-UPGRADE-20261011.md)，不作为本版目标。

## 归属与入口

官方Schedule拥有会话提醒、原会话投递与投递记录。automation不调用模型、不创建Session。官方详情plugins.detail.section承载双分区设置；main槽的schedules组合官方原组件／inject／locale与直接页面，用公开优先级保留原注册。唯一侧栏由官方提供；详情按钮selectPanel('schedules')并选择直接任务，旧automation面板重定向。新建请求为一次性内存意图，消费后清除，重入页面不重开旧表单。监听、优先级注册、草稿保护均随客户端卸载清理，卸载恢复官方原页面。

客户端／16工具 → AutomationService → 队列／Worker → ChildProcessExecutor → SQLite。设置桥与迁移桥复用/api/automation路径聚合及同源围栏；原生dsh-app://app仅在回环传输上允许，宿主认证仍独立负责身份。

工具名称按 `automation-tool-names-20261014-v1` 使用 `automation_<操作名>`，名称契约见[工具](tools.md)。旧点号名称退役且不注册别名；任务数据不以工具名关联，无数据库迁移。宿主原始会话日志不改写，不增加Provider拦截或绕过冻结请求的兼容层。

## 官方依赖

实际profile Bundle列表、configEditor.configuration条目、Loader父tree baseUrl、pluginPackages与installAnchor共同检查来源。目标dsh-web-app、dsh-schedule、dsh-time-context、dsh-client-ui-schedule和Desktop必须精确0.2.1-rc.2。time-context在三个预设内部；不存在唯一全局Loader条目不代表缺包。

shared/time.ts使用公开createAtSchedule、createDailySchedule、createWeeklySchedule、createCronSchedule；monthly直接规则用Temporal按时区截断月末后交绝对时间助手。旧解析器仅用于历史规则诊断，不作为新调度算法。官方Cron与旧日期／星期AND语义不可直接互换。

## 配置

八字段见 [字段表](CONFIG-UI.md)。只接受三个固定所有者和字段白名单。configEditor锁内校验entryId、配置指纹、实际条目和schema；保留未知字段与未编辑表达式，unset删除覆盖。普通参数按原生重载流程生效；schedule重载会影响依赖它的automation，因此也拒绝直接运行期间保存。时间感知保存不阻止直接运行。每个所有者草稿、令牌、错误独立；收到其他区快照不覆盖未保存草稿。

## 生命周期和执行

启动恢复pending，运行中标结果未知；周期从当前时间计算未来下一次，过期once只记一次skipped。trigger_id+scheduled_at防重复入队。queue按任务串行，parallel实际并行，skip记跳过。重试到期时间持久化；取消删除重试等待。服务暂停／卸载等待所属执行退出再关闭数据库。Windows取消所属PID进程树，POSIX取消所属进程组。

脚本格式白名单固定五种，解释器覆盖不绕过格式限制；参数数组传入spawn，cwd/env在宿主执行。命令默认不经Shell；显式shell:true按系统Shell解释命令和参数。stdout/stderr各限制200000字符；运行日志、输出、错误、退出码保持可查。

## 持久层与迁移

保留tasks、triggers、runs、run_logs，追加automation_meta保存重试到期、规则审查、迁移记录与官方映射。默认目录沿用DSH_DATA_DIR／DSH_HOME；改变dataDir不搬数据。SQLite VACUUM INTO生成一致性备份，迁移强制备份即使keepBackups=0。

首次启动备份后暂停旧模型／不等价规则，不创建官方任务。迁移带完整业务指纹与配置指纹：预览→锁／暂停调度→备份→官方每触发器创建→保存映射→恢复调度。失败补偿；残留或中断记录标恢复待处理，避免自动重复投递。恢复检查全部历史（不限1000条）、配置及官方记录未被编辑／投递，冲突拒绝。配置本身迁移不更改所有者、不复制官方字段；恢复前验证配置指纹，原配置备份用于故障排查。

## 来源

[宿主](../src/index.ts)、[设置桥](../src/host/settings.ts)、[迁移桥](../src/host/migration.ts)、[调度](../src/core/service.ts)、[时间](../src/shared/time.ts)、[进程](../src/actions/process.ts)、[存储](../src/storage/sqlite.ts)、[客户端](../src/client/index.ts)、[验收](VERIFICATION-0.2.0-rc.2+automation.1.md)。


## 2026-10-18 统一展示与套件交付契约

依据用户已确认的 office-suite-implementation-20261018-v1。Irving · 自动化增强／Irving · Automation Enhancement，包 dsh-automation 统一 0.2.1-rc.2+rev.1。展示资源通过 locale 导出提供；原条目 id、服务／工具／客户端身份、配置及存储保持。本插件保持独立安装。版本按完整字符串与固定散列核对；本节不授权原先待确认的业务扩展。
