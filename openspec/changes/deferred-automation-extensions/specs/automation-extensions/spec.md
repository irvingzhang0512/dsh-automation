## ADDED Requirements

### Requirement: R-TRIGGERS 事件与条件触发候选

若被选定批准，系统 SHALL 在时间触发之外支持原始需求§28选定的条件或事件来源（例如文件变化）；每次触发可追溯且有去重/重放规则。

#### Scenario: 重复事件

- **WHEN** 未来适配器重复投递同一事件
- **THEN** 按确认身份规则最多产生对应一次计划运行，记录来源；条件未满足不启动。


### Requirement: R-ACTIONS 插件动作和流程候选

若被选定批准，系统 SHALL 支持原始需求§28/§31的Plugin Action/Workflow/Tool Action中选定类型，通过公开契约执行，不自动扩大为旧Agent名称创建Session。

#### Scenario: 插件能力不可用

- **WHEN** 未来动作未注册或版本不匹配
- **THEN** 明确失败并保留诊断，不替换为命令/LLM或未知操作；取消/超时按确认契约传播。


### Requirement: R-NOTIFY 执行结果通知候选

若被选定批准，系统 SHALL 根据显式规则通知成功、失败或长耗时运行，区分执行与投递结果，保留用户选择渠道/收件范围。

#### Scenario: 运行和通知都失败

- **WHEN** 任务失败且通知渠道不可用
- **THEN** 历史保留原始失败，通知失败单独记录；不将任务改成功或换收件人。


### Requirement: R-LOGSTREAM 实时日志候选

若被选定批准，系统 SHALL 提供原始需求§28的实时日志更新，保持输出上限和访问边界；传输协议由后续确认版决定。

#### Scenario: 日志订阅断线恢复

- **WHEN** 用户查看持续运行日志后断线再恢复
- **THEN** 按确认游标重读且不重复拼接，终态以持久run为准，断线不隐式重跑任务。


### Requirement: R-OCCURRENCE 单次未来计划调整候选

若被选定批准，系统 SHALL 支持原始需求§14取消今晚一次或仅改明天一次时间并保留周期规则；当前cancel_run不能等同编辑全部未来occurrence。

#### Scenario: 取消未物化的下一次

- **WHEN** 周期任务尚未生成run，用户指定跳过未来一个时刻
- **THEN** 按确认例外模型准确指向该次，后续周期保持；操作前明确日期/时区及范围。


### Requirement: R-FILTERS 任务列表与历史筛选补全候选

系统 SHALL 在决定实现原始需求§5–10额外搜索/排序/筛选前核对现有all/enabled/disabled及task/status/limit覆盖差异，未覆盖项不得因迁移宣称可用。

#### Scenario: 更丰富组合筛选

- **WHEN** 用户希望按名称/描述/动作或历史维度组合筛选
- **THEN** 先形成字段/分页/排序验收并确认，现有基础过滤按主规格继续。
