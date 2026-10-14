# Automation 0.2.0-rc.2+automation.3 验收

2026-10-14；用户明确要求实施已确认的 `automation-tool-names-20261014-v1`。基线为automation.2，16个名称改为automation_前缀；原参数／结果信封／执行语义、HTTP API和存储格式保持。历史验收[automation.2](VERIFICATION-0.2.0-rc.2+automation.2.md)与[automation.1](VERIFICATION-0.2.0-rc.2+automation.1.md)保留，不代替本轮验证。

## 离线验证

- typecheck、build通过；14文件148项测试通过，无skip。新4项使用真实0.2.0-rc.2 ToolRuntime和内存SQLite，覆盖16个合法唯一名称／64字符上限、旧名不能分发、Skill／契约一致、全部16项服务操作、对象关联、结果信封、结构化错误及卸载释放。
- 源码变更限定工具名及相关描述、包修订；参数schema、输出schema和执行器保持。完整lib产物重建并提交。

## 配置与历史

- 当前日常根／desktop的三份有效配置只读扫描未发现旧工具名或automation.*过滤引用，无配置迁移项；私有报告`.local/reports/automation-tools-20261014/config-reference-scan.json`记录散列与扫描结果，不包含配置正文或凭据。
- 日常仍automation.1，不安装、重启或修改日常配置。原会话日志不改写；旧名称显式退役，含旧工具调用的会话不承诺直接续聊。

## 隔离验证与交付

- 独立fixture `.local/desktop-automation-tools-020`，使用实际Desktop安装包0.2.0-rc.2、官方Schedule Bundle及同版真实peers；仅在此目录加载待验源码副本。
- 实际API返回兼容匹配：Desktop、官方Bundle及三成员均0.2.0-rc.2，自研完整版本automation.3。正常configEditor重载时观察到工具数量16→0→16，恢复原fixture配置后仍16；旧点号工具为0，无残留注册或重复名。
- 经实际宿主llm.stream、未修改的dsh-opencode-go 0.1.22和当前Go账号，发送全部16个新工具；DeepSeek V4.1返回automation_list_tasks，真实ToolRuntime分发成功，结果回送后正常stop与完整中文回复。两次请求均HTTP 200，工具查询为空列表；真实用量／上游请求编号见私有model-roundtrip.json。仅允许该只读工具执行，不创建或运行任务。
- 截图对应原会话确认仅有两次INVALID_REQUEST、没有已完成旧工具调用。只读解析原日志，在内存中重建7条旧消息，追加只读验证指令并使用当前新工具，经同一真实宿主再次完成模型→automation_list_tasks→结果回送→中文回复。原日志前后SHA-256相同；不复制日常会话或凭据到fixture，不在日常原会话发送，不声称已验证日常UI续聊。
- 私有证据在根`.local/reports/automation-tools-20261014/`：host-summary.json、host-lifecycle.json、model-roundtrip.json、failed-history-roundtrip.json。仅保存字段白名单／结果摘要，不保存提示词或Key；凭据只在诊断进程内读取并用于当前Go端点。首次验证脚本的动态导入／依赖路径／清理函数错误均未计通过，修复后重启隔离fixture并完整复验。
- 固定Git安装另验，当前来源为明确标记的开发副本，不将源码副本视为已安装的固定Git产物。日常仍automation.1；公开来源和完整组合保持未验。
- 不修改第三方Provider源码，不自动推送或公开发布；候选兼容标记保持verified=false，整套组合／公开GitHub来源仍待验。
