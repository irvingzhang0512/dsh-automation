# Automation 0.2.0-rc.2+automation.1验收

日期2026-10-14；批准范围见[实施契约](IMPLEMENTATION-20261014.md)。只使用隔离Desktop0.2.0-rc.2，未修改日常安装或恢复Web，未公开推送／发布tag。

## 自动与真实执行

- 类型检查、构建通过；12测试文件、139测试全部通过，0跳过。包括客户端产物冒烟、16工具／API、进程与五格式、时区／月末、三种重叠策略、恢复／防重复、迁移与部分失败、完整历史指纹、八字段合法／非法／冲突／重置及草稿隔离。
- Python／Git Bash／pwsh／Node实际执行.py/.sh/.ps1/.js/.mjs，带空格路径与参数成功；命令额外参数与env传入。Windows缺Python解释器／不支持格式明确失败；取消实际所属子进程树并等待输出管道关闭。
- 根renderer工具6测试通过；prepare可指定Schedule Bundle，链接真实Temporal依赖和精确peers。

## Carrier

从真实Desktop安装包启动目标profile，实际Loader／pluginPackages来源、installAnchor与四个官方包均为0.2.0-rc.2；自研.1匹配。8字段实际HTTP保存／读回／恢复继承、逐项非法值和CAS拒绝、忙碌保存拒绝与CSRF拒绝通过。直接Node运行成功前后Session数量不变。真实Schedule服务对禁用旧模型副本的两个2099年触发器创建提醒、关联已有会话、恢复删除映射通过；未投递／未调用模型。直接数据副本另行验证，不把提醒投递当作模型任务完成。

## 原生界面

- 官方Bundle详情8字段／8中文帮助、两分区／三个所有者、原入口保留且无自研重复侧栏。8字段逐项非默认保存、后端读回、重置删除覆盖通过。官方schedule保存不丢time-context／automation草稿；外部CAS冲突保留本区与另区草稿。
- 原生任务编辑保留一个带空格参数、关闭重试，副本任务仍禁用。中文规则／动作迁移预览可读。
- 可见主窗口浅／深主题、1280／600宽viewport检查无横向溢出，已逐张查看像素；使用官方data-ds-dark-theme样式属性临时切换，不改变日常主题。帮助点击和原生Tab键聚焦显示通过。viewport模拟不代表真实设备缩放。
- 初始主renderer虽已启动，但欢迎窗口显示在前；早期Page.captureScreenshot超时，未计为截图成功。通过官方欢迎页「添加API Key → 稍后配置」进入可见窗口，未填写凭据。可见截图与功能验收使用后续记录。
- 早期矩阵驱动等待了无关帮助按钮，下一字段可能在上一保存结束前编辑；该驱动失败不记通过。改为等待当前所有者保存按钮／状态和后端值，重新完整8字段验证通过；没有自动重放超时写操作。

## 真实旧数据副本

默认旧目录1个命令任务、1个每日触发器、15次历史运行，读取一致性副本到隔离目录；副本启动前禁用任务。预览、固定系统时区、应用和恢复后任务／触发器／运行ID与15历史保留，禁用状态保留。原数据库未写入；不执行复制来的命令。旧模型动作采用合成数据验证原会话选择、多触发器关联、不等价规则拒绝、失败补偿／恢复与已投递恢复冲突。

## 分发与边界

构建产物随Git提交，包元信息与精确宿主peer保留。Desktop安装包CLI／pnpm11.7.0从固定本地Git提交安装成功，实际包版本保留完整+automation.1，lib／client／Skill均来自安装来源；真实carrier匹配及8字段保存／读回／重置、直接执行无新Session、忙碌和CSRF保护、迁移恢复再验通过。公开GitHub固定URL需先有用户授权推送／tag后再验，当前不声明远端已可下载本版。

测试记录在维护仓库忽略的.local/desktop-automation-020和.local/desktop-automation-final-020，含host-verification、daily-copy-verification、actual-official-migration、all-eight-invalid-conflict、robust-ui-matrix、robust-drafts、visible-theme-layout及可见截图。凭据、URL令牌和原始私人任务不提交。

历史environment.json／versions.lock.json保持原组合；新组合单列候选，不作为安装／恢复输入。全仓7天完整巡检仍待办，本次局部开发不代替全量兼容验证。
