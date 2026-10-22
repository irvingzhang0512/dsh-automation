# dsh-automation 文档迁移索引

迁移版：2026-10-22-v1。迁移全部18个F编号进入6个主能力；原需求未落地的扩展集中在1个候选change，旧模型执行与独立daemon示例保留明确历史去向。

## 唯一活动来源与保留边界

- 当前行为唯一规格源是本库 openspec/specs；未确认/未实现业务仅在 openspec/changes，不能提前合入主规格或归档。
- 原始需求、旧 docs/SPEC.md 与历史方案/验收证据保留原字节并冻结，不再双写。本索引优先于旧文件内“当前可编辑SPEC”等历史路由措辞。
- 技术/配置/工具/使用说明本轮保持字节不变；规格中的“冻结来源”指迁移时所读取版本，绝非永久禁止维护。后续已确认功能实施时仍同步实际技术说明，但不能与OpenSpec成为第二份独立产品真源。
- README/AGENTS只调整入口与维护路由；业务/项目/examples/运行skills、源码、测试、配置、包版本、锁和产物均不改。根跨平台个人工作区方案不在本库重复定义。
- 原文未给出完整设计的愿望仅建候选change；本轮文档授权不是业务批准。用户确认具体文档版的门禁保留，artifacts ready/validate/任务勾选不等于批准、实现或验收。

## 主规格目录

| Capability | 作用 |
|---|---|
| [automation-conversation-migration](specs/automation-conversation-migration/spec.md) | 旧模型任务迁移到官方原对话自动任务；保留预览、显式映射、备份、补偿与受保护恢复。  |
| [automation-delivery](specs/automation-delivery/spec.md) | 保持当前精确宿主组合、完整修订号及独立交付，不将旧版本草案重新作为安装目标。  |
| [automation-direct-execution](specs/automation-direct-execution/spec.md) | 直接管理与执行命令/脚本任务，使用持久化调度、并发和恢复规则。  |
| [automation-history-storage](specs/automation-history-storage/spec.md) | 保留任务、触发器、运行历史、日志和迁移元数据的持久化及一致备份。  |
| [automation-settings](specs/automation-settings/spec.md) | 按真实配置所有者编辑八个字段，保留逐区保存、冲突、重载和草稿安全。  |
| [automation-tools-ui](specs/automation-tools-ui/spec.md) | 通过稳定工具、HTTP接口和官方同页入口管理任务，保留页面状态与工具名称迁移边界。  |

## 全部既有文档分类

盘点依据为git ls-files全清单，共125个跟踪文件；包括所有md/mdx/txt/rst及对其余扩展名的检查，并非只搜索SPEC。当前有19份上述文本文档；没有另藏的requirements.txt。许可证、Git属性等非需求文本不转换为产品规则。下表逐一记录原文件，个人资料与运行文件保持原职责。

| 原文件 | 分类与去向/处理 |
|---|---|
| [AGENTS.md](../AGENTS.md) | 维护规则入口；只改OpenSpec路由与流程，保留原开发/验证约定。 |
| [CHANGELOG.md](../CHANGELOG.md) | 历史交付记录，冻结保留，不能充当未记载范围验收。 |
| [README.md](../README.md) | 用户安装/任务使用入口；仅调整规格链接，现有版本、功能与安装事实保留。 |
| [docs/CONFIG-UI.md](../docs/CONFIG-UI.md) | 字段/所有者/帮助表，本轮不改；八字段及当前preset所有权进入settings A005/A006。 |
| [docs/DSH-UPGRADE-20261011.md](../docs/DSH-UPGRADE-20261011.md) | 旧升级草案已在原文标明被20261014替代，保留历史，不建伪待办或恢复旧执行器。 |
| [docs/DSH-UPGRADE-20261017.md](../docs/DSH-UPGRADE-20261017.md) | 已确认0.2.1-rc.2兼容/所有权调整与实测，覆盖旧F011版本和旧详情位置。 |
| [docs/IMPLEMENTATION-20261014.md](../docs/IMPLEMENTATION-20261014.md) | 已确认实施契约及历史阶段状态；任务/脚本/恢复、CAS、旧任务迁移分别进入direct-execution、settings、conversation-migration。 |
| [docs/INTEGRATED-TASK-PAGE-20261014.md](../docs/INTEGRATED-TASK-PAGE-20261014.md) | 已确认同页任务设计，对应tools-ui F016；非待开发方案。 |
| [docs/SPEC.md](../docs/SPEC.md) | 旧F001–F018产品基线冻结；唯一活动规格转本目录。 |
| [docs/VERIFICATION-0.2.0-rc.2+automation.1.md](../docs/VERIFICATION-0.2.0-rc.2+automation.1.md) | 历史实施验收，已过与未过范围分开保留。 |
| [docs/VERIFICATION-0.2.0-rc.2+automation.2.md](../docs/VERIFICATION-0.2.0-rc.2+automation.2.md) | 同页整合验收证据，映射F016。 |
| [docs/VERIFICATION-0.2.0-rc.2+automation.3.md](../docs/VERIFICATION-0.2.0-rc.2+automation.3.md) | 工具名称兼容验收证据，映射F007。 |
| [docs/VERIFICATION-OFFICE-20261018.md](../docs/VERIFICATION-OFFICE-20261018.md) | F017/F018名称/版本/组合验证，日常和公开安装另记。 |
| [docs/architecture.md](../docs/architecture.md) | 当前技术说明，本轮字节不改；分层/数据/调度进入direct-execution、history-storage和tools-ui。 |
| [docs/skill.md](../docs/skill.md) | 运行skill文档索引，不转换为产品Requirement，原文保留。 |
| [docs/tools.md](../docs/tools.md) | 工具参数/结果/错误码技术说明，本轮不改；16工具、改名及引用边界进入tools-ui F007/A004，后续随确认实现同步说明。 |
| [docs/web-slots-research.md](../docs/web-slots-research.md) | 历史宿主调研证据，不作为当前API或产品需求；公开槽选择已落入同页/详情规格，示例命令不视为可运行承诺。 |
| [dsh-automation-requirements.md](../dsh-automation-requirements.md) | 原始需求只读冻结；逐章节映射见下表，旧方案/候选不冒充当前实现。 |
| [skills/automation/SKILL.md](../skills/automation/SKILL.md) | 运行期任务工具指引，原字节保持；与维护开发skills分开，不在本轮改操作行为。 |

## F编号 → Requirement / Scenario 完整映射

旧验收条目在对应主规格保留，并补WHEN/THEN场景；替代的历史细节见后表。下列实现状态来自原文，不是本轮产品重新验证。

| 原编号/标题 | 当前去向与Requirement | 场景 | 历史状态 |
|---|---|---|---|
| F001 直接任务生命周期 | [automation-direct-execution](specs/automation-direct-execution/spec.md) / F001 | 直接创建任务并编辑；旧模型任务仅供迁移 | 原记录已实现；验证按独立证据 |
| F002 时间规则 | [automation-direct-execution](specs/automation-direct-execution/spec.md) / F002 | 多个触发器与时区；短月日期 | 原记录已实现；验证按独立证据 |
| F003 队列与运行控制 | [automation-direct-execution](specs/automation-direct-execution/spec.md) / F003 | 并发策略生效；失败重试和超时 | 原记录已实现；验证按独立证据 |
| F004 命令和脚本 | [automation-direct-execution](specs/automation-direct-execution/spec.md) / F004 | 运行本地脚本 | 原记录已实现；验证按独立证据 |
| F005 会话任务归官方 | [automation-conversation-migration](specs/automation-conversation-migration/spec.md) / F005 | 拒绝旧模型执行器 | 原记录已实现；验证按独立证据 |
| F006 SQLite与历史 | [automation-history-storage](specs/automation-history-storage/spec.md) / F006 | 读取旧运行历史；数据库备份 | 原记录已实现；验证按独立证据 |
| F007 页面工具与API | [automation-tools-ui](specs/automation-tools-ui/spec.md) / F007 | 工具名称与卸载；引用迁移不重写历史 | 原记录已实现；验证按独立证据 |
| F008 配置所有权 | [automation-settings](specs/automation-settings/spec.md) / F008 | 修改一个所有者设置 | 原记录已实现；验证按独立证据 |
| F009 旧具名Agent路径退役 | [automation-conversation-migration](specs/automation-conversation-migration/spec.md) / F009 | 实际会话映射 | 原记录已实现；验证按独立证据 |
| F010 配置生效 | [automation-settings](specs/automation-settings/spec.md) / F010 | 运行中拒绝重载设置 | 原记录已实现；验证按独立证据 |
| F011 官方基线 | [automation-delivery](specs/automation-delivery/spec.md) / F011 | 核对当前组合 | 原记录已实现；验证按独立证据 |
| F012 双分区原生界面 | [automation-settings](specs/automation-settings/spec.md) / F012 | 独立两区设置；一组保存失败 | 原记录已实现；验证按独立证据 |
| F013 参数与执行 | [automation-direct-execution](specs/automation-direct-execution/spec.md) / F013 | 逐行参数不拆空格；取消等待实际退出 | 原记录已实现；验证按独立证据 |
| F014 重启恢复 | [automation-direct-execution](specs/automation-direct-execution/spec.md) / F014 | 重启恢复区分pending和running；过期与错过周期 | 原记录已实现；验证按独立证据 |
| F015 迁移与恢复 | [automation-conversation-migration](specs/automation-conversation-migration/spec.md) / F015 | 迁移前规则冲突；迁移或恢复受并发保护 | 原记录已实现；验证按独立证据 |
| F016 同页任务入口 | [automation-tools-ui](specs/automation-tools-ui/spec.md) / F016 | 官方同页切换；卸载增强 | 原记录已实现；验证按独立证据 |
| F017 插件列表与详情的显示名称 | [automation-tools-ui](specs/automation-tools-ui/spec.md) / F017 | 插件名称可本地化 | 原记录已实现；验证按独立证据 |
| F018 统一版本与固定交付 | [automation-delivery](specs/automation-delivery/spec.md) / F018 | 完整修订与旧后缀；独立插件交付 | 原记录已实现；验证按独立证据 |

## 原始需求逐节去向（含SPEC未覆盖项）

来源：[dsh-automation-requirements.md](../dsh-automation-requirements.md)。未覆盖不等于可以删掉；被较新已确认方案替代的条目保留历史意图并注明去向，未决条目放候选变更。

| 原章节 | 去向与判断 |
|---|---|
| 1 项目概述 | direct-execution：直接任务定位；模型类由conversation-migration F005/F009转官方原对话。 |
| 1.1 项目名称 | direct-execution：直接任务定位；模型类由conversation-migration F005/F009转官方原对话。 |
| 1.2 项目定位 | direct-execution：直接任务定位；模型类由conversation-migration F005/F009转官方原对话。 |
| 1.3 核心目标 | direct-execution：直接任务定位；模型类由conversation-migration F005/F009转官方原对话。 |
| 2 设计原则 | direct-execution和history-storage：调度不混业务，宿主可在无页面时运行；不等于独立新daemon已实现。 |
| 2.1 Scheduler 只负责任务调度，不实现具体业务 | direct-execution和history-storage：调度不混业务，宿主可在无页面时运行；不等于独立新daemon已实现。 |
| 2.2 Web 与后台执行解耦 | direct-execution和history-storage：调度不混业务，宿主可在无页面时运行；不等于独立新daemon已实现。 |
| 3 DSH Web 入口 | tools-ui F016：旧/automation独立页面建议由官方同页标签替代；不恢复双入口。 |
| 3.1 入口位置 | tools-ui F016：旧/automation独立页面建议由官方同页标签替代；不恢复双入口。 |
| 3.2 页面路由 | tools-ui F016：旧/automation独立页面建议由官方同页标签替代；不恢复双入口。 |
| 4 核心对象模型 | direct-execution F001/F002/F003、history-storage F006：Task/Trigger/Run身份与历史。 |
| 4.1 Task：任务定义 | direct-execution F001/F002/F003、history-storage F006：Task/Trigger/Run身份与历史。 |
| 4.2 Trigger：触发规则 | direct-execution F001/F002/F003、history-storage F006：Task/Trigger/Run身份与历史。 |
| 4.3 Run：一次具体运行 | direct-execution F001/F002/F003、history-storage F006：Task/Trigger/Run身份与历史。 |
| 5 主页面设计 | tools-ui：基础任务/待运行/运行中/历史保留；更丰富筛选和UI建议在extensions / R-FILTERS待核对。 |
| 6 「任务」页面 | direct-execution F001，tools-ui A004；名称/描述/动作高级筛选建议在R-FILTERS。 |
| 7 「待运行」页面 | tools-ui待运行查询、direct-execution F014恢复；未生成run的未来单次调整在R-OCCURRENCE。 |
| 8 「运行中」页面 | direct-execution F003/F013：运行中状态与真实进程取消。 |
| 9 「历史」页面 | history-storage F006、tools-ui A004：运行历史/输出/错误；高级筛选/实时增量另候选。 |
| 10 新建任务界面 | direct-execution F001/F002/F004/F013：直接任务表单；原模型动作改官方Schedule；额外交互待R-FILTERS。 |
| 11 Action 类型 | command/script现行在F004/F013；skill/agent_prompt旧执行器已被F005明确退役，只读迁移到官方原对话。 |
| 11.1 Skill | command/script现行在F004/F013；skill/agent_prompt旧执行器已被F005明确退役，只读迁移到官方原对话。 |
| 11.2 Agent Prompt | command/script现行在F004/F013；skill/agent_prompt旧执行器已被F005明确退役，只读迁移到官方原对话。 |
| 11.3 Command | command/script现行在F004/F013；skill/agent_prompt旧执行器已被F005明确退役，只读迁移到官方原对话。 |
| 11.4 Script | command/script现行在F004/F013；skill/agent_prompt旧执行器已被F005明确退役，只读迁移到官方原对话。 |
| 12 Tool 设计 | tools-ui F007/A004：旧automation.*一对一改automation_*，不注册别名；历史调用不改写。 |
| 13 LLM / Skill 创建自动任务 | conversation-migration：模型任务由官方原对话工具；本插件工具创建直接任务，运行skill不得写DB。 |
| 14 自然语言支持场景 | 常规时间计划/立即运行由F001–F004；“今晚不跑/明天改单次”尚未物化实例的编辑进入extensions R-OCCURRENCE。 |
| 15 调度服务 | direct-execution：宿主服务tick/去重/恢复，非独立操作系统服务承诺。 |
| 16 Trigger Engine | direct-execution F002/A001：七类时间规则、时区、触发去重。 |
| 17 Task Queue | direct-execution F003/F014：队列、pending恢复与原running unknown。 |
| 18 Worker | direct-execution F004/A002：直接进程执行、输出上限、卸载收束；不恢复旧模型Worker。 |
| 19 并发策略 | direct-execution F003：skip/queue/parallel。 |
| 20 失败重试 | direct-execution F003/A001：持久重试时刻、取消不重试。 |
| 21 超时 | direct-execution F003/F013：超时与本次进程树退出。 |
| 22 数据存储 | history-storage F006/A003：SQLite任务/触发器/历史/日志/meta，备份一致。 |
| 23 本地持久化路径建议 | history-storage：DSH数据路径与dataDir改变不搬旧库；原示例非任意迁移授权。 |
| 24 服务生命周期 | 原dsh automation start/stop/restart/status及系统开机自启是历史方案，现行宿主装卸生命周期替代；若独立后台服务仍需则另确认，候选design记录。 |
| 25 Web 与后台服务通信 | tools-ui A004：HTTP与工具同服务；未来WebSocket实时推送进入extensions R-LOGSTREAM。 |
| 26 Task 详情页 | tools-ui/direct-execution/history-storage：直接详情与日志；原模型任务详情转官方，额外过滤待候选。 |
| 27 第一版 MVP 范围 | 旧MVP混合现有和退役动作；以主规格当前command/script和官方模型任务分界为准，不能重启skill/agent_prompt执行器。 |
| 28 第二阶段能力 | extensions R-TRIGGERS/R-ACTIONS/R-NOTIFY/R-LOGSTREAM：条件、事件、Plugin Action、通知、实时状态均未确认。 |
| 28.1 条件触发 | extensions R-TRIGGERS/R-ACTIONS/R-NOTIFY/R-LOGSTREAM：条件、事件、Plugin Action、通知、实时状态均未确认。 |
| 28.2 事件触发 | extensions R-TRIGGERS/R-ACTIONS/R-NOTIFY/R-LOGSTREAM：条件、事件、Plugin Action、通知、实时状态均未确认。 |
| 28.3 Plugin Action | extensions R-TRIGGERS/R-ACTIONS/R-NOTIFY/R-LOGSTREAM：条件、事件、Plugin Action、通知、实时状态均未确认。 |
| 28.4 更完整的任务通知 | extensions R-TRIGGERS/R-ACTIONS/R-NOTIFY/R-LOGSTREAM：条件、事件、Plugin Action、通知、实时状态均未确认。 |
| 28.5 WebSocket 实时状态 | extensions R-TRIGGERS/R-ACTIONS/R-NOTIFY/R-LOGSTREAM：条件、事件、Plugin Action、通知、实时状态均未确认。 |
| 29 与 dsh-agenda 的边界 | Agenda管理日程资料、Automation管理执行；未来联动未实现，本次不从同仓库推导自动互通。 |
| 30 第一版验收标准 | 原验收逐项由主规格场景保留适用部分；原Agent Session/独立daemon要求按已确认替代关系处理，实测证据独立。 |
| 31 最终定位 | 通用执行定位保留；Workflow/Tool Action/更多插件动作属于extensions候选，不是当前类型。 |

## 历史替代、遗漏与不确定点

- F011旧Desktop/Bundle/三个成员0.2.0-rc.2已由20261017批准方案替代；当前来源为dsh-web-app及schedule/time-context/client-ui-schedule真实版本。F012旧详情位置同步迁至自研详情，两个独立配置区语义不变。
- 当前time-context映射三个官方preset，旧settings.register/scope热更新和旧独立Schedule Bundle仅保留历史，不能用作新实现依据。
- 八字段保留；refreshIntervalMs=0表示每个符合条件步骤注入时间读数，不是关闭功能。dataDir保存不搬库；keepBackups=0仍强制保留迁移备份。
- 原Skill/Agent Prompt执行器由已确认F005退役，按真实既有Session显式迁移，不能为“覆盖原始需求”恢复旧创建Session行为。
- cancel_run只取消已有run；原未来单次计划口语例子未有完整occurrence规则，已明确候选去向。高级筛选/通知/实时WS亦不冒充已实现。
- 原需求和web-slots调研中的目录/路由/守护命令是历史建议或调研；当前实际公开接口按后续确认契约。

## 确认、实现与验证证据

- official-automation-20261014-v1、同页整合与automation-tool-names-20261014-v1各有旧明确确认及验收文件；它们保留为历史批准/证据，不因迁移要求重复批准已实现规则。
- 20261017升级记录明确用户批准与155项测试等当时范围；20261018名称/统一+rev来自office-suite-implementation-20261018-v1。是否日常/公网通过仍依各独立记录，不能从工具加载推导真实外发。
- 未实施候选change任务均不勾选；实现/验证分开，原待验项保持。

本轮仅做OpenSpec严格校验、完整F编号/文档分类/链接与受保护文件哈希核对，结果由根迁移报告记录。未运行产品测试、构建、真人设备、云端调用或安装；没有提交/推送，也不提高兼容标记。旧验收中的待办不会被文档结构校验自动消除。
