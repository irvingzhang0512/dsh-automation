# Design

文档版：v1（2026-11-04）。实现状态：待实现；具体文档确认：待确认。

## Context

范围和现行依据见 [proposal](proposal.md)。本设计仅记录目标差异；实施与验证独立登记。

## Goals / Non-Goals

保持既有能力，交付可核验的新宿主组合；不包含新业务功能、恢复 Web 或发布 npm／Release／市场投稿。

## Decisions

### 领域实现契约

Schedule.create 改为 create({title,prompt,timing,target:{kind:"session",sessionId}})，timing 使用 at/daily/weekly/cron 等 tagged union；保留原 hourly、weekday、weekly、cron 时间语义和 monthly>28 阻断。省略 target 会变成 new_once，因此旧迁移必须显式传原会话。删除使用 edit({id,action:"delete",expectedUpdatedAt}) 并检查 not-found/conflict 返回。旧 SQLite migration-records 的扁平 expected 采用版本化内存投影，对比规范化目标、规则、状态、投递及修改时间；不得忽略真实用户修改，不清空旧恢复记录。仅删除本次创建且未修改／未投递任务，部分失败逐项保留恢复记录。

settings.ts 与 preset-time-settings.ts 的展示读取 fiber.effectiveConfig 并核验生命周期；原始覆盖通过 configEditor 读取及编辑。官方日程的新投递目标在集成页正确展示，旧迁移入口仍默认原会话；直接任务不引入 Session／模型执行器。

### 固定运行环境

本插件完整版本 0.2.2-rc.1+rev.1，宿主 0.2.2-rc.1；按目标 Desktop 实包锁定官方 SDK，Cordis／Schemastery／Loader 采用实包精确版本。完整字符串、源码 SHA、运行资源散列共同核验，保留原 patch 条目、客户端身份及业务接口。工具主要使用 register，原生调用实测后才登记可用，不无依据重写工具框架。

### 配置、存储和恢复

原始覆盖通过 configEditor.configuration()/edit() 读写，生效值读取 effectiveConfig 并检查生命周期；默认／表达式／继承值不整份写入覆盖层。取消不写入，CAS 冲突拒绝，未挂载所有者明确反馈。旧有效字段及完整引用保留，确有失效字段须证明并定向处理；没有迁移需求则保持原文件。备份和安装事务由维护入口负责，日常旧资料只读核验，隔离副本执行业务写入。官方 schedule v2 与新会话事件不可据此承诺旧宿主可读；恢复须核验配套数据，后续业务有变化则保护双方内容并停止自动降级。

## Risks / Trade-offs

精确声明不能代替实际接口、配置或运行验证；依赖不兼容、来源漂移或无法无损恢复时保留原环境并报告具体阻碍。

## Migration Plan

取得本版具体确认后按 [tasks](tasks.md) 实施，技术说明随实现同步；旧证据不改写为新组合通过。
